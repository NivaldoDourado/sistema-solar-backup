import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { getLoginUrl } from "./const";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Não retentar em erros de autenticação
      retry: (failureCount, error) => {
        if (error instanceof TRPCClientError && error.message === UNAUTHED_ERR_MSG) return false;
        return failureCount < 2;
      },
      // Revalidar ao voltar ao foco (reabrir app)
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  },
});

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  // Redirecionar sempre para a tela de login personalizada
  if (window.location.pathname !== "/login") {
    window.location.href = "/login";
  }
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

// ============================================================
// DETECÇÃO DE SESSÃO EXPIRADA AO REABRIR O APP
// Quando o usuário volta ao app após período inativo,
// verificamos silenciosamente se a sessão ainda é válida.
// Se não for, redirecionamos para o login antes de qualquer render.
// ============================================================
let sessionCheckInProgress = false;

async function checkSessionValidity() {
  if (sessionCheckInProgress) return;
  if (window.location.pathname === "/login") return;

  sessionCheckInProgress = true;
  try {
    const response = await fetch("/api/trpc/auth.me?batch=1&input=%7B%220%22%3A%7B%22json%22%3Anull%7D%7D", {
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });

    if (response.ok) {
      const data = await response.json();
      // tRPC batch retorna array; verificar se há erro de UNAUTHORIZED
      const result = Array.isArray(data) ? data[0] : data;
      const errorCode = result?.error?.data?.code || result?.error?.json?.data?.code;
      if (errorCode === "UNAUTHORIZED" || errorCode === "UNAUTHENTICATED") {
        console.log("[Session] Sessão expirada detectada ao reabrir app, redirecionando...");
        window.location.href = "/login";
        return;
      }
    } else if (response.status === 401) {
      console.log("[Session] 401 ao verificar sessão, redirecionando para login...");
      window.location.href = "/login";
      return;
    }

    // Sessão válida: invalidar queries para forçar refetch com dados frescos
    queryClient.invalidateQueries();
  } catch (err) {
    // Falha de rede: não redirecionar (pode ser offline)
    console.warn("[Session] Falha ao verificar sessão (possível offline):", err);
  } finally {
    sessionCheckInProgress = false;
  }
}

// Verificar sessão quando o app volta ao foco (reabrir do background)
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    checkSessionValidity();
  }
});

// Verificar sessão quando a janela ganha foco
window.addEventListener("focus", () => {
  checkSessionValidity();
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
