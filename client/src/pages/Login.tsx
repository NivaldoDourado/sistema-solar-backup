import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { LogIn, Eye, EyeOff, Loader2, ExternalLink } from "lucide-react";
import { useLocation } from "wouter";
import { getLoginUrl } from "@/const";

export default function Login() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [oauthPending, setOauthPending] = useState(false);
  const oauthWindowRef = useRef<Window | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loginMutation = trpc.authLocal.login.useMutation({
    onSuccess: (data) => {
      if (data.mustChangePassword) {
        toast.info("Você precisa definir uma nova senha antes de continuar.");
        setLocation("/trocar-senha?primeiro=1");
      } else {
        toast.success("Login realizado com sucesso!");
        window.location.href = "/";
      }
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const meQuery = trpc.auth.me.useQuery(undefined, {
    enabled: oauthPending,
    refetchInterval: oauthPending ? 2000 : false,
  });

  // Quando o polling detectar que o usuário está autenticado, redirecionar
  useEffect(() => {
    if (oauthPending && meQuery.data) {
      setOauthPending(false);
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (oauthWindowRef.current && !oauthWindowRef.current.closed) {
        oauthWindowRef.current.close();
      }
      toast.success("Login realizado com sucesso!");
      window.location.href = "/";
    }
  }, [oauthPending, meQuery.data]);

  // Detectar se a janela OAuth foi fechada sem completar o login
  useEffect(() => {
    if (!oauthPending) return;
    const checkClosed = setInterval(() => {
      if (oauthWindowRef.current?.closed) {
        clearInterval(checkClosed);
        // Dar mais 3 segundos para o callback processar antes de desistir
        setTimeout(() => {
          if (oauthPending) {
            setOauthPending(false);
            toast.info("Janela de login fechada. Tente novamente se necessário.");
          }
        }, 3000);
      }
    }, 500);
    return () => clearInterval(checkClosed);
  }, [oauthPending]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Informe o e-mail");
      return;
    }
    if (!password) {
      toast.error("Informe a senha");
      return;
    }
    loginMutation.mutate({ email: email.trim(), password });
  };

  const handleOAuthLogin = () => {
    const loginUrl = getLoginUrl();
    // Abrir em nova aba para evitar problemas de CAPTCHA e iframe
    const w = 520;
    const h = 620;
    const left = window.screenX + (window.outerWidth - w) / 2;
    const top = window.screenY + (window.outerHeight - h) / 2;
    const popup = window.open(
      loginUrl,
      "manus-oauth",
      `width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );
    if (!popup) {
      // Se popup foi bloqueado, abrir em nova aba normalmente
      window.open(loginUrl, "_blank");
      toast.info("Uma nova aba foi aberta para login. Após entrar, volte aqui e recarregue a página.");
      return;
    }
    oauthWindowRef.current = popup;
    setOauthPending(true);
    popup.focus();
  };

  const appTitle = import.meta.env.VITE_APP_TITLE || "Sistema SOLAR";
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">{appTitle}</h1>
          <p className="text-slate-400">PEDREIRA IRMÃOS SOLAR</p>
        </div>

        <Card className="border-slate-700 bg-slate-800/50 backdrop-blur">
          <CardHeader className="text-center">
            <CardTitle className="text-white text-xl">Acesso ao Sistema</CardTitle>
            <CardDescription className="text-slate-400">
              Entre com suas credenciais para acessar
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Login local com email/senha */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-300">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu.email@exemplo.com"
                  className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
                  autoComplete="email"
                  autoFocus
                  disabled={oauthPending}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-300">Senha</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 pr-10"
                    autoComplete="current-password"
                    disabled={oauthPending}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    disabled={oauthPending}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={loginMutation.isPending || oauthPending}
              >
                {loginMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  <>
                    <LogIn className="h-4 w-4 mr-2" />
                    Entrar
                  </>
                )}
              </Button>
            </form>

            {/* Separador e botão OAuth — exibido apenas quando o portal OAuth está configurado */}
            {oauthPortalUrl && (
              <>
                <div className="relative">
                  <Separator className="bg-slate-600" />
                  <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-800 px-3 text-xs text-slate-400">
                    ou
                  </span>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white bg-transparent"
                  onClick={handleOAuthLogin}
                  disabled={oauthPending}
                >
                  {oauthPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Aguardando login na janela aberta...
                    </>
                  ) : (
                    <>
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Entrar com conta Manus
                    </>
                  )}
                </Button>

                {oauthPending && (
                  <p className="text-center text-slate-400 text-xs">
                    Complete o login na janela que foi aberta. Esta tela será atualizada automaticamente.
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-slate-500 text-sm mt-6">
          Não possui acesso? Solicite à Consultoria.
        </p>
      </div>
    </div>
  );
}
