// Service Worker - Sistema SOLAR PWA
// Versão do cache
const CACHE_VERSION = 'solar-v1';
const CACHE_NAME = `${CACHE_VERSION}-assets`;

// Assets para cache offline (apenas shell do app)
const PRECACHE_ASSETS = [
  '/',
  '/mobile',
];

// ============================================================
// INSTALL: Pré-cache dos assets principais
// ============================================================
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch(() => {
        // Silenciar erros de pré-cache (assets podem não existir ainda)
      });
    }).then(() => self.skipWaiting())
  );
});

// ============================================================
// ACTIVATE: Limpar caches antigos
// ============================================================
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// ============================================================
// FETCH: Network-first para API, Cache-first para assets
// ============================================================
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Ignorar requisições de extensões e não-HTTP
  if (!url.protocol.startsWith('http')) return;

  // API sempre vai para a rede (sem cache)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Assets estáticos: cache-first
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        // Cachear apenas respostas válidas de assets estáticos
        if (response.ok && (
          url.pathname.match(/\.(js|css|png|jpg|svg|woff2|ico)$/)
        )) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Fallback para o index.html em caso de erro de rede
        return caches.match('/') || new Response('Offline', { status: 503 });
      });
    })
  );
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
      // Se já há uma janela aberta, focar nela
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // Caso contrário, abrir nova janela
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
