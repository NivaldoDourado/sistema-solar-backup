// Service Worker - Sistema SOLAR PWA
// ESTRATÉGIA: Network-First para TUDO.
// O app sempre busca a versão mais recente do servidor.
// Cache é usado APENAS como fallback quando não há conexão.
// Isso garante que qualquer atualização do sistema apareça
// imediatamente no celular, sem precisar reinstalar o app.

const CACHE_VERSION = 'solar-v5';
const CACHE_NAME = `${CACHE_VERSION}-shell`;

// ============================================================
// INSTALL: Instala novo SW imediatamente, sem esperar
// ============================================================
self.addEventListener('install', (event) => {
  // skipWaiting faz o novo SW assumir o controle imediatamente,
  // sem esperar o usuário fechar todas as abas.
  event.waitUntil(self.skipWaiting());
});

// ============================================================
// ACTIVATE: Limpa todos os caches antigos e assume controle
// ============================================================
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Removendo cache antigo:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      // clients.claim() faz o SW controlar as abas abertas imediatamente
      return self.clients.claim();
    }).then(() => {
      // Notifica todas as abas abertas para recarregar
      return self.clients.matchAll({ type: 'window' }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'SW_UPDATED' });
        });
      });
    })
  );
});

// ============================================================
// FETCH: Network-First para TUDO
// O servidor sempre é consultado primeiro.
// O cache só é usado se a rede falhar (modo offline).
// ============================================================
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Ignorar requisições não-HTTP (extensões, chrome-extension, etc.)
  if (!url.protocol.startsWith('http')) return;

  // Ignorar requisições de outros domínios (CDN, analytics, etc.)
  if (url.origin !== self.location.origin) return;

  // Para requisições GET: Network-First com fallback de cache
  if (event.request.method === 'GET') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          // Resposta da rede recebida com sucesso
          // Atualiza o cache com a versão mais recente
          if (networkResponse.ok) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Rede falhou → tenta servir do cache (modo offline)
          return caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // Fallback final: retorna a página principal do app
            return caches.match('/mobile') || caches.match('/') ||
              new Response(
                '<html><body style="font-family:sans-serif;text-align:center;padding:2rem">' +
                '<h2>Sem conexão</h2><p>Verifique sua internet e tente novamente.</p>' +
                '<button onclick="location.reload()">Tentar novamente</button>' +
                '</body></html>',
                { headers: { 'Content-Type': 'text/html' } }
              );
          });
        })
    );
    return;
  }

  // Para requisições de API (/api/trpc): sempre rede, sem cache,
  // e notifica o app se a resposta for 401 (sessão expirada)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request.clone()).then((response) => {
        // Se a API retornar 401, notifica todas as abas para redirecionar ao login
        if (response.status === 401) {
          self.clients.matchAll({ type: 'window' }).then((clients) => {
            clients.forEach((client) => {
              client.postMessage({ type: 'SESSION_EXPIRED' });
            });
          });
        }
        return response;
      }).catch(() => {
        // Falha de rede: deixa o browser tratar
        return fetch(event.request);
      })
    );
    return;
  }

  // Para POST/PUT/DELETE não-API: sempre vai para a rede, sem cache
  // Não interceptamos — deixamos o browser tratar normalmente
});

// ============================================================
// MESSAGE: Receber comandos do app principal
// ============================================================
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then((names) => Promise.all(names.map((n) => caches.delete(n))));
  }
});

// ============================================================
// PUSH: Receber e exibir notificações push
// ============================================================
self.addEventListener('push', (event) => {
  let data = {
    title: 'SOLAR - Pedreira Solar',
    body: 'Nova notificação do sistema.',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: 'solar-alert',
    data: { url: '/mobile' },
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      data = { ...data, ...payload };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || '/icons/icon-192.png',
      badge: data.badge || '/icons/icon-192.png',
      tag: data.tag || 'solar-alert',
      data: data.data || { url: '/mobile' },
      requireInteraction: data.requireInteraction || false,
      vibrate: [200, 100, 200],
    })
  );
});

// ============================================================
// NOTIFICATION CLICK: Abrir o app ao clicar na notificação
// ============================================================
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/mobile';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
