import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { KeyRound, Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { useLocation, useSearch } from "wouter";

const LOGO_URL =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663227720411/Us3Q3oBA5LqqATDWwyHq5k/icon2-512_56ba32c6.png";

export default function TrocarSenha() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const isPrimeiroLogin = searchString.includes("primeiro=1");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const changePasswordMutation = trpc.authLocal.changePassword.useMutation({
    onSuccess: () => {
      toast.success("Senha alterada com sucesso!");
      if (isPrimeiroLogin) {
        window.location.href = "/";
      } else {
        setLocation("/meu-perfil");
      }
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPrimeiroLogin && !currentPassword) {
      toast.error("Informe a senha atual");
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      toast.error("A nova senha deve ter pelo menos 6 caracteres");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }
    changePasswordMutation.mutate({
      currentPassword: isPrimeiroLogin ? undefined : currentPassword,
      newPassword,
      confirmPassword,
    });
  };

  const passwordsMatch = !confirmPassword || newPassword === confirmPassword;

  return (
    <div className="min-h-screen flex bg-slate-900">
      {/* Painel esquerdo — identidade visual */}
      <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center bg-gradient-to-br from-amber-800 via-amber-700 to-amber-900 p-12 relative overflow-hidden">
        {/* Círculos decorativos */}
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-white/5" />
        <div className="absolute -bottom-32 -right-32 w-[500px] h-[500px] rounded-full bg-black/10" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-white/[0.03]" />

        {/* Conteúdo central */}
        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="w-40 h-40 rounded-3xl overflow-hidden shadow-2xl mb-8 border-4 border-white/20">
            <img src={LOGO_URL} alt="Dourado Gestão e Negócios" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-2 tracking-wide">Sistema SOLAR</h1>
          <p className="text-amber-200 text-lg font-semibold mb-3">Dourado Gestão e Negócios</p>
          <p className="text-amber-100/70 text-sm max-w-xs leading-relaxed">
            {isPrimeiroLogin
              ? "Defina sua senha pessoal para acessar o sistema com segurança."
              : "Mantenha sua conta segura com uma senha forte e exclusiva."}
          </p>
        </div>

        <p className="absolute bottom-6 text-amber-200/40 text-xs">Pedreira Solar © 2025</p>
      </div>

      {/* Painel direito — formulário */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 lg:p-12">
        {/* Logo visível apenas em mobile */}
        <div className="flex flex-col items-center mb-8 lg:hidden">
          <div className="w-20 h-20 rounded-2xl overflow-hidden shadow-xl mb-4 border-2 border-amber-500/40">
            <img src={LOGO_URL} alt="SOLAR" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-2xl font-bold text-white">Sistema SOLAR</h1>
          <p className="text-amber-400 text-sm font-semibold">Dourado Gestão e Negócios</p>
        </div>

        <div className="w-full max-w-sm">
          {/* Cabeçalho do formulário */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                <ShieldCheck className="h-5 w-5 text-amber-400" />
              </div>
              <h2 className="text-2xl font-bold text-white">
                {isPrimeiroLogin ? "Defina sua Senha" : "Alterar Senha"}
              </h2>
            </div>
            <p className="text-slate-400 text-sm">
              {isPrimeiroLogin
                ? "Por segurança, defina uma senha pessoal antes de acessar o sistema."
                : "Informe sua senha atual e escolha uma nova senha."}
            </p>
          </div>

          {/* Formulário */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {!isPrimeiroLogin && (
              <div className="space-y-2">
                <Label htmlFor="currentPassword" className="text-slate-300 text-sm font-medium">
                  Senha Atual
                </Label>
                <div className="relative">
                  <Input
                    id="currentPassword"
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 h-11 pr-10 focus:border-amber-500 focus:ring-amber-500/20"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-amber-400 transition-colors"
                  >
                    {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="newPassword" className="text-slate-300 text-sm font-medium">
                Nova Senha
              </Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 h-11 pr-10 focus:border-amber-500 focus:ring-amber-500/20"
                  autoFocus={isPrimeiroLogin}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-amber-400 transition-colors"
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {newPassword && newPassword.length < 6 && (
                <p className="text-xs text-amber-400">A senha deve ter pelo menos 6 caracteres</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-slate-300 text-sm font-medium">
                Confirmar Nova Senha
              </Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a nova senha"
                  className={`bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 h-11 pr-10 focus:ring-amber-500/20 transition-colors ${
                    !passwordsMatch ? "border-red-500 focus:border-red-500" : "focus:border-amber-500"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-amber-400 transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {!passwordsMatch && (
                <p className="text-xs text-red-400">As senhas não coincidem</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full h-11 bg-amber-600 hover:bg-amber-500 text-white font-semibold text-sm transition-colors shadow-lg shadow-amber-900/40 mt-2"
              disabled={changePasswordMutation.isPending}
            >
              {changePasswordMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <KeyRound className="h-4 w-4 mr-2" />
                  {isPrimeiroLogin ? "Definir Senha e Acessar" : "Alterar Senha"}
                </>
              )}
            </Button>
          </form>

          {!isPrimeiroLogin && (
            <p className="text-center text-slate-600 text-xs mt-8">
              Após alterar a senha, você será redirecionado ao seu perfil.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
