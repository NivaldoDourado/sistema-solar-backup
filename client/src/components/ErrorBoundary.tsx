import { cn } from "@/lib/utils";
import { AlertTriangle, RotateCcw, LogIn } from "lucide-react";
import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  isSessionError: boolean;
}

// Mensagens/padrões que indicam sessão expirada ou não autenticado
const SESSION_ERROR_PATTERNS = [
  "unauthorized",
  "unauthenticated",
  "not authenticated",
  "session expired",
  "invalid session",
  "jwt expired",
  "token expired",
  "UNAUTHORIZED",
  "UNAUTHENTICATED",
  "Não autenticado",
  "Sessão expirada",
];

function isSessionExpiredError(error: Error | null): boolean {
  if (!error) return false;
  const msg = (error.message || "").toLowerCase();
  return SESSION_ERROR_PATTERNS.some((p) => msg.includes(p.toLowerCase()));
}

class ErrorBoundary extends Component<Props, State> {
  private redirectTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, isSessionError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    const isSessionError = isSessionExpiredError(error);
    return { hasError: true, error, isSessionError };
  }

  componentDidUpdate(_: Props, prevState: State) {
    // Se for erro de sessão, redireciona automaticamente após 2s
    if (this.state.isSessionError && !prevState.isSessionError) {
      this.redirectTimeout = setTimeout(() => {
        window.location.href = "/login";
      }, 2000);
    }
  }

  componentWillUnmount() {
    if (this.redirectTimeout) clearTimeout(this.redirectTimeout);
  }

  render() {
    if (this.state.hasError) {
      // Erro de sessão expirada: mostrar mensagem amigável e redirecionar
      if (this.state.isSessionError) {
        return (
          <div className="flex items-center justify-center min-h-screen p-8 bg-background">
            <div className="flex flex-col items-center w-full max-w-sm p-8 text-center">
              <LogIn size={48} className="text-primary mb-6" />
              <h2 className="text-xl font-semibold mb-2">Sessão expirada</h2>
              <p className="text-muted-foreground mb-6">
                Sua sessão expirou. Você será redirecionado para o login em instantes...
              </p>
              <button
                onClick={() => { window.location.href = "/login"; }}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg",
                  "bg-primary text-primary-foreground",
                  "hover:opacity-90 cursor-pointer"
                )}
              >
                <LogIn size={16} />
                Ir para o Login
              </button>
            </div>
          </div>
        );
      }

      // Outros erros: mostrar stack trace com botão de reload
      return (
        <div className="flex items-center justify-center min-h-screen p-8 bg-background">
          <div className="flex flex-col items-center w-full max-w-2xl p-8">
            <AlertTriangle
              size={48}
              className="text-destructive mb-6 flex-shrink-0"
            />

            <h2 className="text-xl mb-4">Ocorreu um erro inesperado.</h2>

            <div className="p-4 w-full rounded bg-muted overflow-auto mb-6">
              <pre className="text-sm text-muted-foreground whitespace-break-spaces">
                {this.state.error?.stack}
              </pre>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => window.location.reload()}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg",
                  "bg-primary text-primary-foreground",
                  "hover:opacity-90 cursor-pointer"
                )}
              >
                <RotateCcw size={16} />
                Recarregar
              </button>
              <button
                onClick={() => { window.location.href = "/login"; }}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg",
                  "border border-border bg-background text-foreground",
                  "hover:bg-muted cursor-pointer"
                )}
              >
                <LogIn size={16} />
                Ir para o Login
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
