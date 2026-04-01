import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { LogIn, Eye, EyeOff, Loader2, ExternalLink } from "lucide-react";
import { useLocation } from "wouter";
import { getLoginUrl } from "@/const";

const LOGO_URL =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663227720411/Us3Q3oBA5LqqATDWwyHq5k/icon2-512_56ba32c6.png";

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

  useEffect(() => {
    if (!oauthPending) return;
    const checkClosed = setInterval(() => {
      if (oauthWindowRef.current?.closed) {
        clearInterval(checkClosed);
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
    if (!email.trim()) { toast.error("Informe o e-mail"); return; }
    if (!password) { toast.error("Informe a senha"); return; }
    loginMutation.mutate({ email: email.trim(), password });
  };

  const handleOAuthLogin = () => {
    const loginUrl = getLoginUrl();
    const w = 520, h = 620;
    const left = window.screenX + (window.outerWidth - w) / 2;
    const top = window.screenY + (window.outerHeight - h) / 2;
    const popup = window.open(
      loginUrl,
      "manus-oauth",
      `width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );
    if (!popup) {
      window.open(loginUrl, "_blank");
      toast.info("Uma nova aba foi aberta para login. Após entrar, volte aqui e recarregue a página.");
      return;
    }
    oauthWindowRef.current = popup;
    setOauthPending(true);
    popup.focus();
  };

  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;

  return (
    <div className="min-h-screen flex bg-slate-900">
      {/* Painel esquerdo — identidade visual */}
      <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center bg-gradient-to-br from-amber-800 via-amber-700 to-amber-900 p-12 relative overflow-hidden">
        {/* Círculos decorativos de fundo */}
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-white/5" />
        <div className="absolute -bottom-32 -right-32 w-[500px] h-[500px] rounded-full bg-black/10" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-white/[0.03]" />

        {/* Conteúdo central */}
        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="w-40 h-40 rounded-3xl overflow-hidden shadow-2xl mb-8 border-4 border-white/20">
            <img src={LOGO_URL} alt="Dourado Gestão e Negócios" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-2 tracking-wide">Sistema SOLAR</h1>
          <div className="flex items-center gap-3 mb-3">
            <p className="text-amber-200 text-lg font-semibold">Dourado Gestão e Negócios</p>
            <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white/30 shadow-lg flex-shrink-0">
              <img src="https://d2xsxph8kpxj0f.cloudfront.net/310519663227720411/Us3Q3oBA5LqqATDWwyHq5k/logo-solar-pedreira_7ccf55d9.png" alt="Solar Pedreira" className="w-full h-full object-cover" />
            </div>
          </div>
          <p className="text-amber-100/70 text-sm max-w-xs leading-relaxed">
            Gestão Operacional Integrada da Pedreira Solar — controle de equipamentos, combustível, produção e custos em um só lugar.
          </p>
        </div>

        {/* Rodapé do painel */}
        <p className="absolute bottom-6 text-amber-200/40 text-xs">Pedreira Solar © 2025</p>
      </div>

      {/* Painel direito — formulário */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 lg:p-12">
        {/* Logo visível apenas em mobile (telas < lg) */}
        <div className="flex flex-col items-center mb-8 lg:hidden">
          <div className="w-20 h-20 rounded-2xl overflow-hidden shadow-xl mb-4 border-2 border-amber-500/40">
            <img src={LOGO_URL} alt="SOLAR" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-2xl font-bold text-white">Sistema SOLAR</h1>
          <div className="flex items-center gap-2">
            <p className="text-amber-400 text-sm font-semibold">Dourado Gestão e Negócios</p>
            <div className="w-7 h-7 rounded-full overflow-hidden border border-amber-500/40 flex-shrink-0">
              <img src="https://d2xsxph8kpxj0f.cloudfront.net/310519663227720411/Us3Q3oBA5LqqATDWwyHq5k/logo-solar-pedreira_7ccf55d9.png" alt="Solar Pedreira" className="w-full h-full object-cover" />
            </div>
          </div>
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-8 hidden lg:block">
            <h2 className="text-2xl font-bold text-white mb-1">Bem-vindo de volta</h2>
            <p className="text-slate-400 text-sm">Entre com suas credenciais para acessar o sistema</p>
          </div>

          {/* Formulário */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-300 text-sm font-medium">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu.email@exemplo.com"
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 h-11 focus:border-amber-500 focus:ring-amber-500/20"
                autoComplete="email"
                autoFocus
                disabled={oauthPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-300 text-sm font-medium">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 h-11 pr-10 focus:border-amber-500 focus:ring-amber-500/20"
                  autoComplete="current-password"
                  disabled={oauthPending}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-amber-400 transition-colors"
                  disabled={oauthPending}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-11 bg-amber-600 hover:bg-amber-500 text-white font-semibold text-sm transition-colors shadow-lg shadow-amber-900/40"
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
                  Entrar no Sistema
                </>
              )}
            </Button>
          </form>

          {/* OAuth */}
          {oauthPortalUrl && (
            <>
              <div className="relative my-5">
                <Separator className="bg-slate-700" />
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-900 px-3 text-xs text-slate-500">
                  ou
                </span>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full h-11 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white hover:border-amber-500/50 bg-transparent transition-colors"
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
                <p className="text-center text-slate-400 text-xs mt-3">
                  Complete o login na janela que foi aberta. Esta tela será atualizada automaticamente.
                </p>
              )}
            </>
          )}

          <p className="text-center text-slate-600 text-xs mt-8">
            Não possui acesso? Solicite à Consultoria.
          </p>
        </div>
      </div>
    </div>
  );
}
