/**
 * MobileDashboard.tsx
 * Dashboard PWA otimizado para celular - PEDREIRA SOLAR
 * Exibe os mesmos KPIs do Dashboard web com filtros de período
 */
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Fuel,
  DollarSign,
  Package,
  Wrench,
  Truck,
  TrendingUp,
  TrendingDown,
  Bell,
  BellOff,
  Settings,
  LogOut,
  RefreshCw,
  Sun,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

// ============================================================
// Tipos e helpers
// ============================================================
type Periodo = "semana" | "mes" | "trimestre" | "ano";

function getPeriodoDates(periodo: Periodo): { dataInicio: string; dataFim: string; label: string } {
  const now = new Date();
  const fmt = (d: Date) => d.toISOString().split("T")[0];

  switch (periodo) {
    case "semana": {
      const start = new Date(now);
      start.setDate(now.getDate() - 6);
      return { dataInicio: fmt(start), dataFim: fmt(now), label: "Últimos 7 dias" };
    }
    case "mes": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { dataInicio: fmt(start), dataFim: fmt(now), label: "Este mês" };
    }
    case "trimestre": {
      const start = new Date(now);
      start.setMonth(now.getMonth() - 2);
      start.setDate(1);
      return { dataInicio: fmt(start), dataFim: fmt(now), label: "Últimos 3 meses" };
    }
    case "ano": {
      const start = new Date(now.getFullYear(), 0, 1);
      return { dataInicio: fmt(start), dataFim: fmt(now), label: "Este ano" };
    }
  }
}

function formatNumber(n: number, decimals = 0): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function formatCurrency(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ============================================================
// Hook de Push Notifications
// ============================================================
function usePushNotifications() {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const vapidQuery = trpc.push.getVapidKey.useQuery();
  const subscribeMutation = trpc.push.subscribe.useMutation();
  const unsubscribeMutation = trpc.push.unsubscribe.useMutation();
  const testPushMutation = trpc.push.testPush.useMutation();

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    navigator.serviceWorker.ready.then((reg) => {
      reg.pushManager.getSubscription().then((sub) => {
        setIsSubscribed(!!sub);
      });
    });
  }, []);

  const subscribe = useCallback(async () => {
    if (!vapidQuery.data?.publicKey) {
      toast.error("Chave VAPID não disponível");
      return;
    }
    setIsLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidQuery.data.publicKey,
      });
      const json = sub.toJSON();
      await subscribeMutation.mutateAsync({
        endpoint: json.endpoint!,
        p256dh: (json.keys as any).p256dh,
        auth: (json.keys as any).auth,
        userAgent: navigator.userAgent,
      });
      setIsSubscribed(true);
      toast.success("Notificações ativadas!");
    } catch (err) {
      toast.error("Erro ao ativar notificações");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [vapidQuery.data, subscribeMutation]);

  const unsubscribe = useCallback(async () => {
    setIsLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await unsubscribeMutation.mutateAsync({ endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
      setIsSubscribed(false);
      toast.success("Notificações desativadas");
    } catch (err) {
      toast.error("Erro ao desativar notificações");
    } finally {
      setIsLoading(false);
    }
  }, [unsubscribeMutation]);

  const testPush = useCallback(async () => {
    try {
      await testPushMutation.mutateAsync();
      toast.success("Notificação de teste enviada!");
    } catch {
      toast.error("Erro ao enviar notificação de teste");
    }
  }, [testPushMutation]);

  const isPushSupported = "serviceWorker" in navigator && "PushManager" in window;

  return { isSubscribed, isLoading, subscribe, unsubscribe, testPush, isPushSupported };
}

// ============================================================
// Componente KPI Card
// ============================================================
interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  color: string;
  bgColor: string;
  trend?: "up" | "down" | "neutral";
  alert?: boolean;
}

function KpiCard({ icon, label, value, sub, color, bgColor, trend, alert }: KpiCardProps) {
  return (
    <div className={`rounded-2xl p-4 ${bgColor} relative overflow-hidden`}>
      {alert && (
        <div className="absolute top-2 right-2">
          <AlertTriangle className="w-4 h-4 text-red-400 animate-pulse" />
        </div>
      )}
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${color} bg-white/20`}>
        {icon}
      </div>
      <p className="text-xs font-medium text-white/70 mb-1">{label}</p>
      <p className="text-xl font-bold text-white leading-tight">{value}</p>
      {sub && (
        <p className="text-xs text-white/60 mt-1 flex items-center gap-1">
          {trend === "up" && <TrendingUp className="w-3 h-3 text-green-300" />}
          {trend === "down" && <TrendingDown className="w-3 h-3 text-red-300" />}
          {sub}
        </p>
      )}
    </div>
  );
}

// ============================================================
// Componente Principal
// ============================================================
export default function MobileDashboard() {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [showSettings, setShowSettings] = useState(false);
  const push = usePushNotifications();

  const { dataInicio, dataFim, label: periodoLabel } = useMemo(
    () => getPeriodoDates(periodo),
    [periodo]
  );

  // Queries de totais
  const abastecimentoTotais = trpc.abastecimento.totais.useQuery({ dataInicio, dataFim });
  const custosTotais = trpc.custos.totais.useQuery({ dataInicio, dataFim });
  const manutencaoTotais = trpc.manutencao.totais.useQuery({ dataInicio, dataFim });
  const producaoTotais = trpc.producao.totais.useQuery({ dataInicio, dataFim });
  const equipamentosLista = trpc.equipamentos.list.useQuery();

  const isLoading =
    abastecimentoTotais.isLoading ||
    custosTotais.isLoading ||
    manutencaoTotais.isLoading ||
    producaoTotais.isLoading;

  const equipamentosAtivos = useMemo(
    () => (equipamentosLista.data ?? []).filter((e) => e.ativo === "sim").length,
    [equipamentosLista.data]
  );

  const refetchAll = () => {
    abastecimentoTotais.refetch();
    custosTotais.refetch();
    manutencaoTotais.refetch();
    producaoTotais.refetch();
    equipamentosLista.refetch();
  };

  // Verificar alertas de metas
  const verificarAlerta = trpc.metas.verificarAlertas.useMutation();
  const metasList = trpc.metas.list.useQuery();

  useEffect(() => {
    if (!abastecimentoTotais.data || !custosTotais.data || !producaoTotais.data) return;
    const indicadores = [
      { indicador: "combustivel_litros", valorAtual: Number(abastecimentoTotais.data.totalQuantidade) },
      { indicador: "custo_total", valorAtual: Number(custosTotais.data.totalValor) },
      { indicador: "producao_m3", valorAtual: Number(producaoTotais.data.totalQuantidade) },
      { indicador: "manutencoes_abertas", valorAtual: Number(manutencaoTotais.data?.totalRegistros ?? 0) },
    ];
    indicadores.forEach(({ indicador, valorAtual }) => {
      verificarAlerta.mutate({ indicador, valorAtual });
    });
  }, [
    abastecimentoTotais.data,
    custosTotais.data,
    producaoTotais.data,
    manutencaoTotais.data,
  ]);

  // ---- Auth Guard ----
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Sun className="w-8 h-8 text-amber-400" />
          </div>
          <p className="text-white/60 text-sm">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6">
        <div className="w-20 h-20 rounded-full bg-amber-500/20 flex items-center justify-center mb-6">
          <Sun className="w-10 h-10 text-amber-400" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">SOLAR</h1>
        <p className="text-white/60 text-sm mb-8 text-center">
          Gestão Operacional da Pedreira Solar
        </p>
        <a
          href={getLoginUrl()}
          className="w-full max-w-xs bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold py-4 px-6 rounded-2xl text-center text-base transition-colors"
        >
          Entrar no Sistema
        </a>
      </div>
    );
  }

  const periodos: { key: Periodo; label: string }[] = [
    { key: "semana", label: "7 dias" },
    { key: "mes", label: "Mês" },
    { key: "trimestre", label: "Trimestre" },
    { key: "ano", label: "Ano" },
  ];

  return (
    <div className="min-h-screen bg-slate-900 pb-8">
      {/* Header */}
      <div className="bg-gradient-to-br from-amber-600 to-amber-800 px-4 pt-12 pb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <Sun className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-white font-bold text-lg leading-tight">SOLAR</h1>
              <p className="text-amber-100 text-xs">Pedreira Solar</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={refetchAll}
              className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center"
              disabled={isLoading}
            >
              <RefreshCw className={`w-4 h-4 text-white ${isLoading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center"
            >
              <Settings className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>

        <p className="text-amber-100 text-sm mb-1">
          Olá, <span className="font-semibold">{user?.name?.split(" ")[0]}</span>
        </p>

        {/* Filtros de Período */}
        <div className="flex gap-2 mt-3">
          {periodos.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriodo(p.key)}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${
                periodo === p.key
                  ? "bg-white text-amber-700 shadow-md"
                  : "bg-white/20 text-white"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <p className="text-amber-100/70 text-xs mt-2">{periodoLabel}</p>
      </div>

      {/* Painel de Configurações (Push) */}
      {showSettings && (
        <div className="mx-4 mt-4 bg-slate-800 rounded-2xl p-4 border border-slate-700">
          <h3 className="text-white font-semibold mb-3 text-sm">Configurações</h3>

          {push.isPushSupported ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {push.isSubscribed ? (
                    <Bell className="w-4 h-4 text-green-400" />
                  ) : (
                    <BellOff className="w-4 h-4 text-slate-400" />
                  )}
                  <div>
                    <p className="text-white text-sm font-medium">Notificações Push</p>
                    <p className="text-slate-400 text-xs">
                      {push.isSubscribed ? "Ativas neste dispositivo" : "Desativadas"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={push.isSubscribed ? push.unsubscribe : push.subscribe}
                  disabled={push.isLoading}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    push.isSubscribed
                      ? "bg-red-500/20 text-red-400"
                      : "bg-green-500/20 text-green-400"
                  }`}
                >
                  {push.isLoading ? "..." : push.isSubscribed ? "Desativar" : "Ativar"}
                </button>
              </div>

              {push.isSubscribed && (
                <button
                  onClick={push.testPush}
                  className="w-full py-2 bg-slate-700 rounded-xl text-slate-300 text-xs"
                >
                  Enviar notificação de teste
                </button>
              )}
            </div>
          ) : (
            <p className="text-slate-400 text-xs">
              Notificações push não são suportadas neste navegador.
            </p>
          )}

          <div className="mt-3 pt-3 border-t border-slate-700">
            <button
              onClick={() => logout()}
              className="flex items-center gap-2 text-red-400 text-sm"
            >
              <LogOut className="w-4 h-4" />
              Sair do sistema
            </button>
          </div>
        </div>
      )}

      {/* KPIs Grid */}
      <div className="px-4 mt-4 grid grid-cols-2 gap-3">
        <KpiCard
          icon={<Truck className="w-5 h-5 text-white" />}
          label="Equipamentos Ativos"
          value={formatNumber(equipamentosAtivos)}
          sub={`de ${equipamentosLista.data?.length ?? 0} cadastrados`}
          color="text-white"
          bgColor="bg-gradient-to-br from-blue-600 to-blue-800"
        />

        <KpiCard
          icon={<Fuel className="w-5 h-5 text-white" />}
          label="Combustível (L)"
          value={formatNumber(Number(abastecimentoTotais.data?.totalQuantidade ?? 0), 0)}
          sub={`${formatNumber(Number(abastecimentoTotais.data?.totalRegistros ?? 0))} abastecimentos`}
          color="text-white"
          bgColor="bg-gradient-to-br from-orange-600 to-orange-800"
        />

        <KpiCard
          icon={<Package className="w-5 h-5 text-white" />}
          label="Produção (m³)"
          value={formatNumber(Number(producaoTotais.data?.totalQuantidade ?? 0), 1)}
          sub={`${formatNumber(Number(producaoTotais.data?.totalRegistros ?? 0))} registros`}
          color="text-white"
          bgColor="bg-gradient-to-br from-green-600 to-green-800"
        />

        <KpiCard
          icon={<DollarSign className="w-5 h-5 text-white" />}
          label="Custos Totais"
          value={formatCurrency(Number(custosTotais.data?.totalValor ?? 0))}
          sub={`${formatNumber(Number(custosTotais.data?.totalRegistros ?? 0))} lançamentos`}
          color="text-white"
          bgColor="bg-gradient-to-br from-red-600 to-red-800"
        />

        <KpiCard
          icon={<Wrench className="w-5 h-5 text-white" />}
          label="Manutenções"
          value={formatNumber(Number(manutencaoTotais.data?.totalRegistros ?? 0))}
          sub={`${formatNumber(Number(manutencaoTotais.data?.totalHorasParadas ?? 0), 1)}h paradas`}
          color="text-white"
          bgColor="bg-gradient-to-br from-purple-600 to-purple-800"
        />

        <KpiCard
          icon={<DollarSign className="w-5 h-5 text-white" />}
          label="Custo Combustível"
          value={formatCurrency(Number(abastecimentoTotais.data?.totalValor ?? 0))}
          sub="valor total"
          color="text-white"
          bgColor="bg-gradient-to-br from-yellow-600 to-yellow-800"
        />
      </div>

      {/* Metas configuradas */}
      {metasList.data && metasList.data.filter(m => m.ativo === "sim").length > 0 && (
        <div className="px-4 mt-4">
          <h3 className="text-white/70 text-xs font-semibold uppercase tracking-wider mb-2">
            Metas Configuradas
          </h3>
          <div className="space-y-2">
            {metasList.data.filter(m => m.ativo === "sim").map((meta) => (
              <div key={meta.id} className="bg-slate-800 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <p className="text-white text-sm font-medium">{meta.descricao || meta.indicador}</p>
                  <p className="text-slate-400 text-xs">
                    Alerta {meta.tipoAlerta === "acima" ? "acima de" : "abaixo de"}{" "}
                    {formatNumber(Number(meta.valorLimiteAlerta ?? 0))}
                  </p>
                </div>
                <CheckCircle2 className="w-4 h-4 text-green-400" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Link para versão web */}
      <div className="px-4 mt-6">
        <a
          href="/"
          className="flex items-center justify-between bg-slate-800 rounded-2xl p-4 border border-slate-700"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <p className="text-white text-sm font-medium">Abrir Sistema Completo</p>
              <p className="text-slate-400 text-xs">Acessar todos os módulos</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </a>
      </div>

      {/* Footer */}
      <div className="px-4 mt-6 text-center">
        <p className="text-slate-600 text-xs">Sistema SOLAR © Pedreira Solar</p>
      </div>
    </div>
  );
}
