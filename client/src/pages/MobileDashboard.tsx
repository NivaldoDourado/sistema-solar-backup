/**
 * MobileDashboard.tsx
 * Dashboard PWA otimizado para celular - PEDREIRA SOLAR
 * Exibe os mesmos KPIs e cards do Dashboard web com filtros de período
 */
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useState, useMemo, useEffect, useCallback } from "react";
import { DashboardExportMenu } from "@/components/DashboardExportMenu";
import { formatters } from "@/lib/export-utils";
import {
  Fuel,
  DollarSign,
  Package,
  PackageX,
  Wrench,
  Truck,
  TrendingUp,
  TrendingDown,
  Bell,
  BellOff,
  Settings,
  LogOut,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  CalendarRange,
  Scale,
  ShieldCheck,
  Settings2,
  Factory,
  ShoppingCart,
  Layers,
  ClipboardList,
  Clock,
  Circle,
} from "lucide-react";
import { toast } from "sonner";
import { CardSkeletonMobile } from "@/components/CardSkeleton";

const LOGO_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663227720411/Us3Q3oBA5LqqATDWwyHq5k/dgsolar-icon-192-v1774802666_01352d9a.png";
const LOGO_SOLAR_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663227720411/Us3Q3oBA5LqqATDWwyHq5k/logo-solar-horizontal_c2527f96.png";

// ============================================================
// Tipos e helpers
// ============================================================
type Periodo = "semana" | "mes" | "trimestre" | "ano" | "personalizado";

function getPeriodoDates(periodo: Periodo, customInicio?: string, customFim?: string): { dataInicio: string; dataFim: string; label: string } {
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
    case "personalizado": {
      const inicio = customInicio || fmt(new Date(now.getFullYear(), now.getMonth(), 1));
      const fim = customFim || fmt(now);
      const fmtDisplay = (s: string) => {
        const [y, m, d] = s.split("-");
        return `${d}/${m}/${y.slice(2)}`;
      };
      return {
        dataInicio: inicio,
        dataFim: fim,
        label: `${fmtDisplay(inicio)} a ${fmtDisplay(fim)}`,
      };
    }
  }
}

function formatNumber(n: number | undefined | null, decimals = 0): string {
  const v = Number(n);
  if (isNaN(v) || n === undefined || n === null) return '0,' + '0'.repeat(decimals);
  return v.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function formatCurrency(n: number | undefined | null): string {
  const v = Number(n);
  if (isNaN(v) || n === undefined || n === null) return 'R$\u00a00,00';
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtPct(value: number | undefined | null): string {
  const n = Number(value);
  if (isNaN(n) || value === undefined || value === null) return '0,0';
  return n.toFixed(1);
}

function formatDateBR(dateStr: string) {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
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

  // Estado para período personalizado
  const today = new Date().toISOString().split("T")[0];
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .split("T")[0];
  const [customInicio, setCustomInicio] = useState(firstOfMonth);
  const [customFim, setCustomFim] = useState(today);
  const [appliedInicio, setAppliedInicio] = useState(firstOfMonth);
  const [appliedFim, setAppliedFim] = useState(today);

  // Expandir/recolher listas
  const [expandSetor, setExpandSetor] = useState(false);
  const [expandServico, setExpandServico] = useState(false);
  const [expandEquipamento, setExpandEquipamento] = useState(false);
  const [expandHorasTrabalhadasMobile, setExpandHorasTrabalhadasMobile] = useState(false);

  const { dataInicio, dataFim, label: periodoLabel } = useMemo(
    () => getPeriodoDates(periodo, appliedInicio, appliedFim),
    [periodo, appliedInicio, appliedFim]
  );

  const filtroParams = useMemo(() => ({ dataInicio, dataFim }), [dataInicio, dataFim]);

  // ---- Queries ----
  const abastecimentoTotais = trpc.abastecimento.totais.useQuery(filtroParams);
  const custosTotais = trpc.custos.totais.useQuery(filtroParams);
  const manutencaoTotais = trpc.manutencao.totais.useQuery(filtroParams);
  const producaoTotais = trpc.producao.totais.useQuery(filtroParams);
  const equipamentosLista = trpc.equipamentos.list.useQuery();
  const producaoBalancasData = trpc.parteDiaria.producaoBalancasIntegradoras.useQuery(filtroParams);
  const producaoMetodoCaminhoes = trpc.parteDiaria.producaoMetodoCaminhoes.useQuery(filtroParams);
  const producaoPerfuracao = trpc.parteDiaria.producaoPerfuracao.useQuery(filtroParams);
  const medicaoPilhasData = trpc.medicaoPilhas.producaoPorProduto.useQuery(filtroParams as any);
  const producaoMotoristasData = trpc.parteDiaria.producaoMotoristas.useQuery(filtroParams);
  const revisoesPreventivas = trpc.manutencao.revisoesPreventivas.useQuery();
  const vendasData = trpc.vendas.vendasList.useQuery();
  const producaoUltimoDia = trpc.parteDiaria.producaoUltimoDia.useQuery();
  const estoqueMinimoPecas = trpc.pecasDesgaste.estoqueMinimoDashboard.useQuery();
  const producaoPorSetor = trpc.parteDiaria.producaoPorSetor.useQuery(filtroParams);
  const producaoPorServico = trpc.parteDiaria.producaoPorServico.useQuery(filtroParams);
  const producaoPorEquipamento = trpc.parteDiaria.producaoPorEquipamento.useQuery(filtroParams);
  const horasTrabalhadasMobile = trpc.parteDiaria.horasTrabalhadas.useQuery(filtroParams);
  const metaCaminhoesConfig = trpc.configuracoes.get.useQuery({ chave: "meta_producao_caminhoes" });
  const metaDiariaConfig = trpc.configuracoes.get.useQuery({ chave: "meta_diaria_caminhoes" });
  const metasList = trpc.metas.list.useQuery();
  const verificarAlerta = trpc.metas.verificarAlertas.useMutation();
  const destinatariosWpp = trpc.destinatariosWhatsapp.list.useQuery();
  const rotinasStatus = trpc.rotinas.statusHoje.useQuery();
  const atualizarStatusMutation = trpc.rotinas.marcarStatus.useMutation({
    onSuccess: () => { rotinasStatus.refetch(); },
    onError: () => toast.error("Erro ao atualizar status da rotina."),
  });
  const userRole = user?.role;

  const isLoading =
    abastecimentoTotais.isLoading ||
    custosTotais.isLoading ||
    manutencaoTotais.isLoading ||
    producaoTotais.isLoading;

  const equipamentosAtivos = useMemo(
    () => (equipamentosLista.data ?? []).filter((e) => e.ativo === "sim").length,
    [equipamentosLista.data]
  );

  // Vendas filtradas por período
  const vendasFiltradas = useMemo(() => {
    if (!vendasData.data) return [];
    return vendasData.data.filter((v: any) => {
      const d = typeof v.data === "string" ? v.data.split("T")[0] : new Date(v.data).toISOString().split("T")[0];
      if (dataInicio && d < dataInicio) return false;
      if (dataFim && d > dataFim) return false;
      return true;
    });
  }, [vendasData.data, dataInicio, dataFim]);

  const vendasPorTipo = useMemo(() => {
    const r = {
      venda: { totalM3: 0, totalTon: 0, valor: 0 },
      amortizacao: { totalM3: 0, totalTon: 0, valor: 0 },
      doacao: { totalM3: 0, totalTon: 0, valor: 0 },
    };
    vendasFiltradas.forEach((v: any) => {
      const tipo = (v.tipo || "venda") as keyof typeof r;
      if (r[tipo]) {
        const qtdM3 = parseFloat(String(v.pesoTotal || "0"));
        r[tipo].totalM3 += qtdM3;
        r[tipo].valor += parseFloat(String(v.valorTotal || "0"));
        if (v.itens && Array.isArray(v.itens)) {
          v.itens.forEach((item: any) => {
            const qtdItem = parseFloat(String(item.quantidade || "0"));
            const densidade = item.produto?.densidade ? parseFloat(String(item.produto.densidade)) : 0;
            r[tipo].totalTon += qtdItem * densidade;
          });
        }
      }
    });
    return r;
  }, [vendasFiltradas]);

  const totalProducaoCaminhoes = producaoMetodoCaminhoes.data?.total || 0;
  const totalPerfuracao = producaoPerfuracao.data?.total || 0;
  const totalFuros = producaoPerfuracao.data?.totalFuros || 0;
  const totalMetrosPerfurados = producaoPerfuracao.data?.totalMetros || 0;
  const metaCaminhoesVal = parseFloat(metaCaminhoesConfig.data?.valor || "0");
  const metaDiariaVal = parseFloat(metaDiariaConfig.data?.valor || "0");

  const maxProducaoSetor = Math.max(...(producaoPorSetor.data?.map((s: any) => s.producaoTotal) || [1]));
  const maxProducaoServico = Math.max(...(producaoPorServico.data?.map((s: any) => s.producaoTotal) || [1]));
  const maxProducaoEquipamento = Math.max(...(producaoPorEquipamento.data?.map((e: any) => e.producaoTotal) || [1]));

  const refetchAll = () => {
    abastecimentoTotais.refetch();
    custosTotais.refetch();
    manutencaoTotais.refetch();
    producaoTotais.refetch();
    equipamentosLista.refetch();
    producaoBalancasData.refetch();
    producaoMetodoCaminhoes.refetch();
    producaoPerfuracao.refetch();
    medicaoPilhasData.refetch();
    producaoMotoristasData.refetch();
    revisoesPreventivas.refetch();
    vendasData.refetch();
    producaoUltimoDia.refetch();
    estoqueMinimoPecas.refetch();
    producaoPorSetor.refetch();
    producaoPorServico.refetch();
    producaoPorEquipamento.refetch();
    horasTrabalhadasMobile.refetch();
  };

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
  }, [abastecimentoTotais.data, custosTotais.data, producaoTotais.data, manutencaoTotais.data]);

  // ---- Auth Guard ----
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 rounded-2xl overflow-hidden mx-auto mb-4 animate-pulse shadow-lg">
            <img src={LOGO_URL} alt="SOLAR" className="w-full h-full object-cover" />
          </div>
          <p className="text-white/60 text-sm">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6">
        <div className="w-32 h-32 rounded-3xl overflow-hidden mb-6 shadow-2xl border-2 border-amber-500/30">
          <img src={LOGO_URL} alt="Dourado Gestão e Negócios" className="w-full h-full object-cover" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-1 tracking-wide">GEM - Sistema de Gestão Estratégica em Mineração</h1>
        <p className="text-amber-400 text-sm mb-1">SOLAR PEDREIRA</p>
        <p className="text-white/50 text-xs mb-10 text-center">Gestão Operacional da Pedreira Solar</p>
        <a
          href="/login"
          className="w-full max-w-xs bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-900 font-bold py-4 px-6 rounded-2xl text-center text-base transition-colors shadow-lg shadow-amber-500/30"
        >
          Entrar no Sistema
        </a>
        <p className="text-slate-600 text-xs mt-10">Pedreira Solar © 2025</p>
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
            <img src={LOGO_SOLAR_URL} alt="SOLAR - Pedreira Solar" className="h-10 object-contain" />
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
                periodo === p.key ? "bg-white text-amber-700 shadow-md" : "bg-white/20 text-white"
              }`}
            >
              {p.label}
            </button>
          ))}
          <button
            onClick={() => setPeriodo("personalizado")}
            className={`px-2 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1 ${
              periodo === "personalizado" ? "bg-white text-amber-700 shadow-md" : "bg-white/20 text-white"
            }`}
            title="Período personalizado"
          >
            <CalendarRange className="w-3.5 h-3.5" />
          </button>
        </div>

        {periodo === "personalizado" && (
          <div className="mt-3 bg-white/15 rounded-2xl p-3 space-y-2">
            <div className="flex gap-2 items-center">
              <div className="flex-1">
                <p className="text-amber-100 text-xs mb-1">Data inicial</p>
                <input
                  type="date"
                  value={customInicio}
                  max={customFim}
                  onChange={(e) => setCustomInicio(e.target.value)}
                  className="w-full bg-white/20 text-white text-sm rounded-xl px-3 py-2 border border-white/30 focus:outline-none focus:border-white"
                  style={{ colorScheme: "dark" }}
                />
              </div>
              <div className="flex-1">
                <p className="text-amber-100 text-xs mb-1">Data final</p>
                <input
                  type="date"
                  value={customFim}
                  min={customInicio}
                  max={today}
                  onChange={(e) => setCustomFim(e.target.value)}
                  className="w-full bg-white/20 text-white text-sm rounded-xl px-3 py-2 border border-white/30 focus:outline-none focus:border-white"
                  style={{ colorScheme: "dark" }}
                />
              </div>
            </div>
            <button
              onClick={() => {
                if (!customInicio || !customFim) { toast.error("Preencha as duas datas"); return; }
                if (customInicio > customFim) { toast.error("A data inicial deve ser anterior à data final"); return; }
                setAppliedInicio(customInicio);
                setAppliedFim(customFim);
                refetchAll();
              }}
              className="w-full py-2 bg-white text-amber-700 font-semibold rounded-xl text-sm transition-all active:scale-95"
            >
              Aplicar filtro
            </button>
          </div>
        )}

        <p className="text-amber-100/70 text-xs mt-2">{periodoLabel}</p>
      </div>

      {/* Painel de Configurações */}
      {showSettings && (
        <div className="mx-4 mt-4 bg-slate-800 rounded-2xl p-4 border border-slate-700">
          <h3 className="text-white font-semibold mb-3 text-sm">Configurações</h3>
          {push.isPushSupported ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {push.isSubscribed ? <Bell className="w-4 h-4 text-green-400" /> : <BellOff className="w-4 h-4 text-slate-400" />}
                  <div>
                    <p className="text-white text-sm font-medium">Notificações Push</p>
                    <p className="text-slate-400 text-xs">{push.isSubscribed ? "Ativas neste dispositivo" : "Desativadas"}</p>
                  </div>
                </div>
                <button
                  onClick={push.isSubscribed ? push.unsubscribe : push.subscribe}
                  disabled={push.isLoading}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    push.isSubscribed ? "bg-red-500/20 text-red-400" : "bg-green-500/20 text-green-400"
                  }`}
                >
                  {push.isLoading ? "..." : push.isSubscribed ? "Desativar" : "Ativar"}
                </button>
              </div>
              {push.isSubscribed && (
                <button onClick={push.testPush} className="w-full py-2 bg-slate-700 rounded-xl text-slate-300 text-xs">
                  Enviar notificação de teste
                </button>
              )}
            </div>
          ) : (
            <p className="text-slate-400 text-xs">Notificações push não são suportadas neste navegador.</p>
          )}
          <div className="mt-3 pt-3 border-t border-slate-700">
            <button
              onClick={() => { logout().then(() => { window.location.href = "/login"; }).catch(() => { window.location.href = "/login"; }); }}
              className="flex items-center gap-2 text-red-400 text-sm"
            >
              <LogOut className="w-4 h-4" />
              Sair do sistema
            </button>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* KPIs Grid - Cards Básicos */}
      {/* ============================================================ */}
      {/* Card Status dos Lançamentos - substitui Equipamentos Ativos */}
      {rotinasStatus.data && rotinasStatus.data.length > 0 && (
        <div className="px-4 mt-4">
          <div className="rounded-2xl bg-slate-800 border border-slate-700 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-slate-700 flex items-center justify-center">
                  <ClipboardList className="w-4 h-4 text-slate-300" />
                </div>
                <span className="text-sm font-semibold text-white">Status dos Lançamentos</span>
              </div>
              <span className="text-xs text-slate-400">
                {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
              </span>
            </div>
            <div className="space-y-2">
              {rotinasStatus.data.map((rotina) => {
                const isUsuario = userRole === 'usuario';
                const status = rotina.status;
                return (
                  <div
                    key={rotina.id}
                    className={`flex items-center justify-between rounded-xl p-3 ${
                      status === 'concluido'
                        ? 'bg-green-900/40 border border-green-700/50'
                        : status === 'pendente'
                        ? 'bg-amber-900/40 border border-amber-700/50'
                        : 'bg-slate-700/50 border border-slate-600/50'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {status === 'concluido' ? (
                        <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                      ) : status === 'pendente' ? (
                        <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                      ) : (
                        <Circle className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">{rotina.nome}</p>
                        {rotina.descricao && (
                          <p className="text-xs text-slate-400 truncate">{rotina.descricao}</p>
                        )}
                      </div>
                    </div>
                    {isUsuario && (
                      <div className="flex gap-1 shrink-0 ml-2">
                        <button
                          onClick={() => atualizarStatusMutation.mutate({ rotinaId: rotina.id, status: 'concluido' })}
                          disabled={atualizarStatusMutation.isPending}
                          className={`rounded-lg px-2 py-1 text-xs font-medium transition-colors ${
                            status === 'concluido'
                              ? 'bg-green-600 text-white'
                              : 'bg-slate-600 text-slate-300 active:bg-green-700 active:text-white'
                          }`}
                        >
                          ✓
                        </button>
                        <button
                          onClick={() => atualizarStatusMutation.mutate({ rotinaId: rotina.id, status: 'pendente' })}
                          disabled={atualizarStatusMutation.isPending}
                          className={`rounded-lg px-2 py-1 text-xs font-medium transition-colors ${
                            status === 'pendente'
                              ? 'bg-amber-500 text-white'
                              : 'bg-slate-600 text-slate-300 active:bg-amber-600 active:text-white'
                          }`}
                        >
                          ⏳
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="px-4 mt-4 grid grid-cols-2 gap-3">
        <KpiCard
          icon={<Fuel className="w-5 h-5 text-white" />}
          label="Combustível (L)"
          value={formatNumber(Number(abastecimentoTotais.data?.totalQuantidade ?? 0), 0)}
          sub={`${formatNumber(Number(abastecimentoTotais.data?.totalRegistros ?? 0))} abastecimentos`}
          color="text-white"
          bgColor="bg-gradient-to-br from-orange-600 to-orange-800"
        />
        {/* Card Produção (m³) temporariamente desabilitado */}
        <KpiCard
          icon={<DollarSign className="w-5 h-5 text-white" />}
          label="Custos Totais"
          value={formatCurrency(Number(custosTotais.data?.totalValor ?? 0))}
          sub={`${formatNumber(Number(custosTotais.data?.totalRegistros ?? 0))} lançamentos`}
          color="text-white"
          bgColor="bg-gradient-to-br from-red-600 to-red-800"
        />
        {/* Card Manutenções temporariamente desabilitado */}
        <KpiCard
          icon={<DollarSign className="w-5 h-5 text-white" />}
          label="Custo Combustível"
          value={formatCurrency(Number(abastecimentoTotais.data?.totalValor ?? 0))}
          sub="valor total"
          color="text-white"
          bgColor="bg-gradient-to-br from-yellow-600 to-yellow-800"
        />
      </div>

      {/* ============================================================ */}
      {/* Estoque Mínimo de Peças */}
      {/* ============================================================ */}
      {estoqueMinimoPecas.data && estoqueMinimoPecas.data.length > 0 && (() => {
        const abaixoMinimo = estoqueMinimoPecas.data!.filter((p: any) => p.abaixoMinimo);
        return (
          <div className="px-4 mt-4">
            <div className={`rounded-2xl p-4 ${abaixoMinimo.length > 0 ? "bg-orange-900/80 border border-orange-600" : "bg-slate-800 border border-slate-700"}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${abaixoMinimo.length > 0 ? "bg-orange-500/20" : "bg-slate-700"}`}>
                    {abaixoMinimo.length > 0
                      ? <PackageX className="w-4 h-4 text-orange-400" />
                      : <Package className="w-4 h-4 text-slate-400" />}
                  </div>
                  <div>
                    <p className="text-white text-sm font-semibold">Estoque Mínimo de Peças</p>
                    {abaixoMinimo.length > 0 && (
                      <p className="text-orange-400 text-xs">{abaixoMinimo.length} peça{abaixoMinimo.length > 1 ? "s" : ""} abaixo do mínimo</p>
                    )}
                  </div>
                </div>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {estoqueMinimoPecas.data!.map((peca: any) => (
                  <div key={peca.id} className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs ${peca.abaixoMinimo ? "bg-orange-800/60 border border-orange-600" : "bg-slate-700/60"}`}>
                    <span className={`truncate max-w-[55%] font-medium ${peca.abaixoMinimo ? "text-orange-300" : "text-white"}`}>{peca.nome}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {peca.abaixoMinimo && <AlertTriangle className="w-3 h-3 text-orange-400" />}
                      <span className={`font-bold ${peca.abaixoMinimo ? "text-orange-300" : "text-white"}`}>{peca.estoqueAtual}</span>
                      <span className="text-white/50">{peca.unidade}</span>
                      {peca.estoqueMinimo > 0 && <span className="text-white/40">(mín: {peca.estoqueMinimo})</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ============================================================ */}
      {/* Cards de Vendas por Tipo */}
      {/* ============================================================ */}
      {(vendasPorTipo.venda.totalM3 > 0 || vendasPorTipo.amortizacao.totalM3 > 0 || vendasPorTipo.doacao.totalM3 > 0) && (
        <div className="px-4 mt-4">
          <h3 className="text-white/70 text-xs font-semibold uppercase tracking-wider mb-2">Vendas por Tipo</h3>
          <div className="space-y-3">
            {/* Vendas */}
            <div className="bg-blue-900/70 rounded-2xl p-4 border border-blue-700">
              <div className="flex items-center gap-2 mb-2">
                <ShoppingCart className="w-4 h-4 text-blue-400" />
                <p className="text-blue-300 text-sm font-semibold">Vendas</p>
              </div>
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-blue-400/70 text-xs">Qtd Total (m³)</p>
                  <p className="text-white text-xl font-bold">{formatNumber(vendasPorTipo.venda.totalM3, 2)}</p>
                </div>
                <div className="text-right">
                  <p className="text-blue-400/70 text-xs">Valor Total</p>
                  <p className="text-white text-base font-bold">{formatCurrency(vendasPorTipo.venda.valor)}</p>
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-blue-700">
                <p className="text-blue-400/70 text-xs">{formatNumber(vendasPorTipo.venda.totalM3, 2)} m³ = {formatNumber(vendasPorTipo.venda.totalTon, 2)} ton</p>
              </div>
            </div>
            {/* Amortizações */}
            <div className="bg-amber-900/70 rounded-2xl p-4 border border-amber-700">
              <div className="flex items-center gap-2 mb-2">
                <RefreshCw className="w-4 h-4 text-amber-400" />
                <p className="text-amber-300 text-sm font-semibold">Amortizações</p>
              </div>
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-amber-400/70 text-xs">Qtd Total (m³)</p>
                  <p className="text-white text-xl font-bold">{formatNumber(vendasPorTipo.amortizacao.totalM3, 2)}</p>
                </div>
                <div className="text-right">
                  <p className="text-amber-400/70 text-xs">Valor Total</p>
                  <p className="text-white text-base font-bold">{formatCurrency(vendasPorTipo.amortizacao.valor)}</p>
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-amber-700">
                <p className="text-amber-400/70 text-xs">{formatNumber(vendasPorTipo.amortizacao.totalM3, 2)} m³ = {formatNumber(vendasPorTipo.amortizacao.totalTon, 2)} ton</p>
              </div>
            </div>
            {/* Doações */}
            <div className="bg-green-900/70 rounded-2xl p-4 border border-green-700">
              <div className="flex items-center gap-2 mb-2">
                <Package className="w-4 h-4 text-green-400" />
                <p className="text-green-300 text-sm font-semibold">Doações</p>
              </div>
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-green-400/70 text-xs">Qtd Total (m³)</p>
                  <p className="text-white text-xl font-bold">{formatNumber(vendasPorTipo.doacao.totalM3, 2)}</p>
                </div>
                <div className="text-right">
                  <p className="text-green-400/70 text-xs">Valor Total</p>
                  <p className="text-white text-base font-bold">{formatCurrency(vendasPorTipo.doacao.valor)}</p>
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-green-700">
                <p className="text-green-400/70 text-xs">{formatNumber(vendasPorTipo.doacao.totalM3, 2)} m³ = {formatNumber(vendasPorTipo.doacao.totalTon, 2)} ton</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* Produção Método Caminhões */}
      {/* ============================================================ */}
      <div className="px-4 mt-4">
        {producaoMetodoCaminhoes.isLoading ? (
          <div className="bg-green-900/70 rounded-2xl border border-green-700 overflow-hidden">
            <CardSkeletonMobile rows={4} />
          </div>
        ) : (
        <div className="bg-green-900/70 rounded-2xl p-4 border border-green-700">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-400" />
              <p className="text-green-300 text-sm font-semibold">Produção Método Caminhões</p>
            </div>
            <DashboardExportMenu
              variant="mobile"
              title="Produção Método Caminhões"
              subtitle={`Período: ${dataInicio} a ${dataFim}`}
              filename="producao-caminhoes-mobile"
              exportOptions={{
                columns: [
                  { header: 'Caminhão', key: 'placa', width: 20 },
                  { header: 'Britagem', key: 'britagem', width: 15 },
                  { header: 'Produção (ton)', key: 'producao', width: 15, format: formatters.decimal },
                ],
                data: [
                  ...(producaoMetodoCaminhoes.data?.britagemFixa?.caminhoes || []).map((c: any) => ({ placa: c.placa, britagem: 'Fixa', producao: c.totalProducao || 0 })),
                  ...(producaoMetodoCaminhoes.data?.britagemMovel?.caminhoes || []).map((c: any) => ({ placa: c.placa, britagem: 'Móvel', producao: c.totalProducao || 0 })),
                ],
              }}
              whatsappMessage={`🚛 *Produção Método Caminhões*\nTotal: ${formatNumber(totalProducaoCaminhoes, 2)} ton`}
              whatsappDestinatarios={(destinatariosWpp.data || []).filter((d: any) => d.ativo === 'sim').map((d: any) => d.telefone)}
            />
          </div>
          <p className="text-white text-2xl font-bold">{formatNumber(totalProducaoCaminhoes, 2)} ton</p>
          {metaCaminhoesVal > 0 && (() => {
            const aProduzir = metaCaminhoesVal - totalProducaoCaminhoes;
            const perc = (totalProducaoCaminhoes / metaCaminhoesVal) * 100;
            return (
              <div className="mt-3 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-green-400/70">Meta:</span>
                  <span className="text-white font-semibold">{formatNumber(metaCaminhoesVal, 2)} ton</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-green-400/70">Produzido:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-semibold">{formatNumber(totalProducaoCaminhoes, 2)} ton</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${perc >= 100 ? "bg-green-700 text-green-200" : "bg-yellow-800 text-yellow-200"}`}>{fmtPct(perc)}%</span>
                  </div>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-green-400/70">A Produzir:</span>
                  <span className={`font-semibold ${aProduzir <= 0 ? "text-green-400" : "text-orange-400"}`}>
                    {aProduzir <= 0 ? "Meta atingida!" : `${formatNumber(aProduzir, 2)} ton`}
                  </span>
                </div>
                <div className="w-full bg-green-800 rounded-full h-2">
                  <div className={`h-2 rounded-full ${perc >= 100 ? "bg-green-400" : "bg-green-500"}`} style={{ width: `${Math.min(perc, 100)}%` }} />
                </div>
              </div>
            );
          })()}
          {/* Britagem Fixa */}
          {producaoMetodoCaminhoes.data?.britagemFixa?.caminhoes && producaoMetodoCaminhoes.data.britagemFixa.caminhoes.length > 0 && (
            <div className="mt-3 pt-3 border-t border-green-700 space-y-2">
              <div className="flex justify-between text-xs font-bold text-green-300 mb-2">
                <span>🏭 Britagem Fixa</span>
                <span>{formatNumber(producaoMetodoCaminhoes.data.britagemFixa.total, 2)} ton</span>
              </div>
              {/* Cabeçalho da tabela */}
              <div className="grid grid-cols-[44px_56px_68px_36px] text-[10px] text-green-500 font-medium border-b border-green-700 pb-1 mb-1 justify-items-end">
                <span>Viag.</span>
                <span>Peso(t)</span>
                <span>Prod.(t)</span>
                <span>%</span>
              </div>
              {producaoMetodoCaminhoes.data.britagemFixa.caminhoes.map((c: any, idx: number) => (
                <div key={idx} className="border-b border-green-800/50 pb-1.5 last:border-0">
                  {/* Nome do caminhão - linha completa */}
                  <p className="text-xs text-green-300 font-medium leading-tight mb-0.5">{c.placa}</p>
                  {/* Dados numéricos */}
                  <div className="grid grid-cols-[44px_56px_68px_36px] text-xs text-green-400/80 justify-items-end">
                    <span className="tabular-nums">{(c.totalViagens || 0).toLocaleString('pt-BR')}</span>
                    <span className="tabular-nums">{(c.capacidade || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    <span className="tabular-nums font-semibold text-green-300">{formatNumber(c.totalProduzido || 0, 2)}</span>
                    <span className="tabular-nums text-green-400">{(c.percentual || 0).toFixed(1)}%</span>
                  </div>
                </div>
              ))}
              {/* Subtotal */}
              <div className="flex items-center justify-between text-xs text-green-300 font-semibold border-t border-green-600 pt-1.5 mt-1">
                <span>Subtotal — {(producaoMetodoCaminhoes.data.britagemFixa.totalViagens || 0).toLocaleString('pt-BR')} viag.</span>
                <span className="tabular-nums">{formatNumber(producaoMetodoCaminhoes.data.britagemFixa.total, 2)} ton ({producaoMetodoCaminhoes.data.total > 0 ? ((producaoMetodoCaminhoes.data.britagemFixa.total / producaoMetodoCaminhoes.data.total) * 100).toFixed(1) : '0,0'}%)</span>
              </div>
            </div>
          )}
          {/* Britagem Móvel */}
          {producaoMetodoCaminhoes.data?.britagemMovel?.caminhoes && producaoMetodoCaminhoes.data.britagemMovel.caminhoes.length > 0 && (
            <div className="mt-3 pt-3 border-t border-green-700 space-y-2">
              <div className="flex justify-between text-xs font-bold text-green-300 mb-2">
                <span>🚛 Britagem Móvel</span>
                <span>{formatNumber(producaoMetodoCaminhoes.data.britagemMovel.total, 2)} ton</span>
              </div>
              {/* Cabeçalho da tabela */}
              <div className="grid grid-cols-[44px_56px_68px_36px] text-[10px] text-green-500 font-medium border-b border-green-700 pb-1 mb-1 justify-items-end">
                <span>Viag.</span>
                <span>Peso(t)</span>
                <span>Prod.(t)</span>
                <span>%</span>
              </div>
              {producaoMetodoCaminhoes.data.britagemMovel.caminhoes.map((c: any, idx: number) => (
                <div key={idx} className="border-b border-green-800/50 pb-1.5 last:border-0">
                  {/* Nome do caminhão - linha completa */}
                  <p className="text-xs text-green-300 font-medium leading-tight mb-0.5">{c.placa}</p>
                  {/* Dados numéricos */}
                  <div className="grid grid-cols-[44px_56px_68px_36px] text-xs text-green-400/80 justify-items-end">
                    <span className="tabular-nums">{(c.totalViagens || 0).toLocaleString('pt-BR')}</span>
                    <span className="tabular-nums">{(c.capacidade || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    <span className="tabular-nums font-semibold text-green-300">{formatNumber(c.totalProduzido || 0, 2)}</span>
                    <span className="tabular-nums text-green-400">{(c.percentual || 0).toFixed(1)}%</span>
                  </div>
                </div>
              ))}
              {/* Subtotal */}
              <div className="flex items-center justify-between text-xs text-green-300 font-semibold border-t border-green-600 pt-1.5 mt-1">
                <span>Subtotal — {(producaoMetodoCaminhoes.data.britagemMovel.totalViagens || 0).toLocaleString('pt-BR')} viag.</span>
                <span className="tabular-nums">{formatNumber(producaoMetodoCaminhoes.data.britagemMovel.total, 2)} ton ({producaoMetodoCaminhoes.data.total > 0 ? ((producaoMetodoCaminhoes.data.britagemMovel.total / producaoMetodoCaminhoes.data.total) * 100).toFixed(1) : '0,0'}%)</span>
              </div>
            </div>
          )}
        </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* Medição das Pilhas */}
      {/* ============================================================ */}
      {medicaoPilhasData.data && ((medicaoPilhasData.data as any).produtos?.length ?? 0) > 0 && (
        <div className="px-4 mt-4">
          <div className="bg-teal-900/70 rounded-2xl p-4 border border-teal-700">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-teal-400" />
                <p className="text-teal-300 text-sm font-semibold">Medição das Pilhas</p>
              </div>
              <DashboardExportMenu
                variant="mobile"
                title="Medição das Pilhas"
                subtitle={`Período: ${dataInicio} a ${dataFim}`}
                filename="medicao-pilhas-mobile"
                exportOptions={{
                  columns: [
                    { header: 'Produto', key: 'produto', width: 25 },
                    { header: 'Produção (m³)', key: 'producao', width: 15 },
                  ],
                  data: ((medicaoPilhasData.data as any).produtos ?? []).map((item: any) => ({ produto: item.produtoNome, producao: item.totalProducao })),
                }}
                whatsappMessage={(() => {
                  let msg = `📦 *Medição das Pilhas*\n`;
                  ((medicaoPilhasData.data as any).produtos ?? []).forEach((item: any) => { msg += `  ${item.produtoNome}: ${formatNumber(item.totalProducao, 2)} m³\n`; });
                  return msg;
                })()}
                whatsappDestinatarios={(destinatariosWpp.data || []).filter((d: any) => d.ativo === 'sim').map((d: any) => d.telefone)}
              />
            </div>
            <div className="space-y-2">
              {((medicaoPilhasData.data as any).produtos ?? []).map((item: any) => (
                <div key={item.produtoId} className="flex justify-between text-xs">
                  <span className="text-teal-300/80 truncate max-w-[60%]">{item.produtoNome}</span>
                  <span className="text-white font-semibold">{formatNumber(item.totalProducao, 2)} m³</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* Produção Último Dia Caminhões */}
      {/* ============================================================ */}
      <div className="px-4 mt-4">
        {producaoUltimoDia.isLoading ? (
          <div className="bg-cyan-900/70 rounded-2xl border border-cyan-700 overflow-hidden"><CardSkeletonMobile rows={4} /></div>
        ) : (
        <div className="bg-cyan-900/70 rounded-2xl p-4 border border-cyan-700">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-cyan-400" />
              <p className="text-cyan-300 text-sm font-semibold">Produção Último Dia Caminhões</p>
            </div>
            <DashboardExportMenu
              variant="mobile"
              title="Produção Último Dia Caminhões"
              subtitle={producaoUltimoDia.data?.dataReferencia ? `Data: ${formatDateBR(producaoUltimoDia.data.dataReferencia)}` : undefined}
              filename="producao-ultimo-dia-mobile"
              exportOptions={{
                columns: [
                  { header: 'Caminhão', key: 'placa', width: 20 },
                  { header: 'Produção (ton)', key: 'producao', width: 15, format: formatters.decimal },
                  { header: '%', key: 'percentual', width: 8 },
                ],
                data: (producaoUltimoDia.data?.caminhoes || []).map((c: any) => ({ placa: c.placa, producao: c.totalProduzido, percentual: `${fmtPct(c.percentual)}%` })),
              }}
              whatsappMessage={producaoUltimoDia.data?.total ? `📅 *Produção Último Dia*\nTotal: ${formatNumber(producaoUltimoDia.data.total, 2)} ton` : undefined}
              whatsappDestinatarios={(destinatariosWpp.data || []).filter((d: any) => d.ativo === 'sim').map((d: any) => d.telefone)}
            />
          </div>
          {producaoUltimoDia.data?.dataReferencia && (
            <p className="text-cyan-400/60 text-xs mb-2">Referência: {formatDateBR(producaoUltimoDia.data.dataReferencia)}</p>
          )}
          <p className="text-white text-2xl font-bold">{formatNumber(producaoUltimoDia.data?.total || 0, 2)} ton</p>
          {metaDiariaVal > 0 && (() => {
            const totalUltimoDia = producaoUltimoDia.data?.total || 0;
            const aProduzir = metaDiariaVal - totalUltimoDia;
            const perc = (totalUltimoDia / metaDiariaVal) * 100;
            const metaAtingida = totalUltimoDia >= metaDiariaVal;
            return (
              <div className="mt-3 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-cyan-400/70">Meta diária:</span>
                  <span className="text-white font-semibold">{formatNumber(metaDiariaVal, 2)} ton</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-cyan-400/70">A produzir:</span>
                  <span className={`font-semibold ${metaAtingida ? "text-green-400" : "text-red-400"}`}>
                    {metaAtingida ? "Meta atingida!" : `${formatNumber(aProduzir, 2)} ton`}
                  </span>
                </div>
                <div className="w-full bg-cyan-800 rounded-full h-2">
                  <div className={`h-2 rounded-full ${metaAtingida ? "bg-emerald-400" : "bg-cyan-400"}`} style={{ width: `${Math.min(perc, 100)}%` }} />
                </div>
              </div>
            );
          })()}
          {producaoUltimoDia.data?.caminhoes && producaoUltimoDia.data.caminhoes.length > 0 && (
            <div className="mt-3 pt-3 border-t border-cyan-700 space-y-1.5">
              {producaoUltimoDia.data.caminhoes.map((c: any, idx: number) => (
                <div key={idx} className="flex justify-between text-xs">
                  <span className="text-cyan-300/80 truncate max-w-[60%]">{c.placa}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-semibold">{formatNumber(c.totalProduzido, 2)}</span>
                    <span className="text-cyan-400/60 bg-cyan-800/60 px-1.5 py-0.5 rounded text-[10px]">{fmtPct(c.percentual)}%</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* Produção de Perfuração */}
      {/* ============================================================ */}
      <div className="px-4 mt-4">
        {producaoPerfuracao.isLoading ? (
          <div className="bg-amber-900/70 rounded-2xl border border-amber-700 overflow-hidden"><CardSkeletonMobile rows={2} /></div>
        ) : (
        <div className="bg-amber-900/70 rounded-2xl p-4 border border-amber-700">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-amber-400" />
              <p className="text-amber-300 text-sm font-semibold">Produção de Perfuração</p>
            </div>
            <DashboardExportMenu
              variant="mobile"
              title="Produção de Perfuração"
              subtitle={`Período: ${dataInicio} a ${dataFim}`}
              filename="producao-perfuracao-mobile"
              exportOptions={{
                columns: [
                  { header: 'Métrica', key: 'metrica', width: 20 },
                  { header: 'Valor', key: 'valor', width: 15 },
                ],
                data: [
                  { metrica: 'Total (m)', valor: totalPerfuracao },
                  { metrica: 'Furos', valor: totalFuros },
                  { metrica: 'Metros Perfurados', valor: totalMetrosPerfurados },
                ],
              }}
              whatsappMessage={`⛏️ *Produção de Perfuração*\nTotal: ${formatNumber(totalPerfuracao, 2)} m\nFuros: ${formatNumber(totalFuros)}\nMetros: ${formatNumber(totalMetrosPerfurados, 2)} m`}
              whatsappDestinatarios={(destinatariosWpp.data || []).filter((d: any) => d.ativo === 'sim').map((d: any) => d.telefone)}
            />
          </div>
          <p className="text-white text-2xl font-bold">{formatNumber(totalPerfuracao, 2)} m</p>
          <div className="flex gap-4 mt-1">
            <p className="text-amber-400/70 text-xs">{formatNumber(totalFuros)} furos</p>
            <p className="text-amber-400/70 text-xs">{formatNumber(totalMetrosPerfurados, 2)} m perfurados</p>
          </div>
        </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* Revisões Preventivas */}
      {/* ============================================================ */}
      {revisoesPreventivas.data && revisoesPreventivas.data.length > 0 && (
        <div className="px-4 mt-4">
          <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-slate-400" />
                <p className="text-white text-sm font-semibold">Revisões Preventivas</p>
              </div>
              <DashboardExportMenu
                variant="mobile"
                title="Revisões Preventivas"
                filename="revisoes-preventivas-mobile"
                exportOptions={{
                  columns: [
                    { header: 'Equipamento', key: 'equipamento', width: 20 },
                    { header: 'Próx. Revisão', key: 'proxima', width: 15 },
                    { header: 'Hor/Km Atual', key: 'horKmAtual', width: 15 },
                    { header: 'Faltam (h)', key: 'faltam', width: 12 },
                    { header: 'Status', key: 'status', width: 12 },
                  ],
                  data: (revisoesPreventivas.data || []).map((rev: any) => ({ equipamento: rev.equipamentoTag, proxima: rev.horKmProximaRevisao, horKmAtual: rev.horaKmFinalAtual > 0 ? rev.horaKmFinalAtual : '-', faltam: rev.faltam, status: rev.faltam <= 0 ? 'Vencida' : rev.faltam <= 25 ? 'Próxima' : 'OK' })),
                }}
                whatsappMessage={(() => {
                  const vencidas = (revisoesPreventivas.data || []).filter((r: any) => r.faltam <= 0);
                  const proximas = (revisoesPreventivas.data || []).filter((r: any) => r.faltam > 0 && r.faltam <= 25);
                  let msg = `🔧 *Revisões Preventivas*\n`;
                  if (vencidas.length > 0) msg += `⚠️ Vencidas: ${vencidas.length}\n`;
                  if (proximas.length > 0) msg += `⏰ Próximas: ${proximas.length}\n`;
                  return msg;
                })()}
                whatsappDestinatarios={(destinatariosWpp.data || []).filter((d: any) => d.ativo === 'sim').map((d: any) => d.telefone)}
              />
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {revisoesPreventivas.data.map((rev: any, idx: number) => {
                const faltam = rev.faltam;
                const isVencida = faltam <= 0;
                const isProxima = faltam > 0 && faltam <= 25;
                return (
                  <div key={idx} className={`rounded-xl px-3 py-2 text-xs ${isVencida ? "bg-red-900/60 border border-red-700" : isProxima ? "bg-orange-900/60 border border-orange-700" : "bg-slate-700/60"}`}>
                    <div className="flex justify-between items-center">
                      <span className={`truncate max-w-[55%] font-medium ${isVencida ? "text-red-300" : isProxima ? "text-orange-300" : "text-white"}`}>{rev.equipamentoTag}</span>
                      <span className={`font-bold ${isVencida ? "text-red-400" : isProxima ? "text-orange-400" : "text-green-400"}`}>
                        {faltam > 0 ? `+${formatNumber(faltam, 1)}` : formatNumber(faltam, 1)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-white/40 text-[10px]">Próx. Rev.: <span className="text-white/60">{rev.horKmProximaRevisao ? formatNumber(rev.horKmProximaRevisao, 0) : '-'}</span></span>
                      <span className="text-blue-400 text-[10px]">Atual: <span className="font-semibold">{rev.horaKmFinalAtual > 0 ? formatNumber(rev.horaKmFinalAtual, 0) : '-'}</span></span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* Produção dos Motoristas */}
      {/* ============================================================ */}
      {producaoMotoristasData.isLoading ? (
        <div className="px-4 mt-4"><div className="bg-cyan-900/70 rounded-2xl border border-cyan-700 overflow-hidden"><CardSkeletonMobile rows={4} /></div></div>
      ) : (producaoMotoristasData.data?.motoristas && producaoMotoristasData.data.motoristas.length > 0) ? (
        <div className="px-4 mt-4">
          <div className="bg-cyan-900/70 rounded-2xl p-4 border border-cyan-700">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-cyan-400" />
                <p className="text-cyan-300 text-sm font-semibold">Produção dos Motoristas</p>
              </div>
              <DashboardExportMenu
                variant="mobile"
                title="Produção dos Motoristas"
                subtitle={`Período: ${dataInicio} a ${dataFim}`}
                filename="producao-motoristas-mobile"
                exportOptions={{
                  columns: [
                    { header: 'Motorista', key: 'motorista', width: 25 },
                    { header: 'Viagens', key: 'viagens', width: 10 },
                    { header: 'Produção (ton)', key: 'producao', width: 15, format: formatters.decimal },
                    { header: '%', key: 'percentual', width: 8 },
                  ],
                  data: (producaoMotoristasData.data?.motoristas || []).map((m: any) => ({ motorista: m.motoristaNome, viagens: m.totalViagens, producao: m.totalProducao, percentual: `${fmtPct(m.percentual)}%` })),
                }}
                whatsappMessage={`🚛 *Produção dos Motoristas*\nTotal: ${formatNumber(producaoMotoristasData.data?.totalProducao || 0, 2)} ton\n${formatNumber(producaoMotoristasData.data?.totalViagens || 0)} viagens`}
                whatsappDestinatarios={(destinatariosWpp.data || []).filter((d: any) => d.ativo === 'sim').map((d: any) => d.telefone)}
              />
            </div>
            <p className="text-white text-xl font-bold">{formatNumber(producaoMotoristasData.data.totalProducao || 0, 2)} ton</p>
            <p className="text-cyan-400/70 text-xs mb-3">{formatNumber(producaoMotoristasData.data.totalViagens || 0)} viagens no total</p>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {producaoMotoristasData.data.motoristas.map((m: any, idx: number) => (
                <div key={idx} className="bg-cyan-800/40 rounded-xl p-3 border border-cyan-700/50">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-white text-xs font-semibold truncate max-w-[55%]">{m.motoristaNome}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-cyan-400/70 text-xs">{formatNumber(m.totalViagens)} viag.</span>
                      <span className="text-white text-xs font-bold">{formatNumber(m.totalProducao, 2)}</span>
                      <span className="text-cyan-400/60 bg-cyan-800 px-1.5 py-0.5 rounded text-[10px]">{fmtPct(m.percentual)}%</span>
                    </div>
                  </div>
                  <div className="space-y-0.5 pl-2 border-l border-cyan-700">
                    {m.servicos.map((s: any, sIdx: number) => (
                      <div key={sIdx} className="flex justify-between text-[11px]">
                        <span className="text-cyan-400/70 truncate max-w-[55%]">{s.servicoNome}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-cyan-500">{formatNumber(s.viagens)} viag.</span>
                          <span className="text-white/80 font-medium">{formatNumber(s.producao, 2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {/* ============================================================ */}
      {/* Balanças Integradoras */}
      {/* ============================================================ */}
      {producaoBalancasData.data && producaoBalancasData.data.equipamentos.length > 0 && (
        <div className="px-4 mt-4">
          <div className="bg-teal-900/80 rounded-2xl p-4 border border-teal-700">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-teal-500/20 flex items-center justify-center">
                  <Scale className="w-4 h-4 text-teal-400" />
                </div>
                <div>
                  <p className="text-white text-sm font-semibold">Produção Balanças</p>
                  <p className="text-teal-400 text-xs">Integradoras</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {producaoBalancasData.data.equipamentos.some((e: any) => e.divergencia) && (
                  <div className="flex items-center gap-1 bg-orange-500/20 rounded-lg px-2 py-1">
                    <AlertTriangle className="w-3 h-3 text-orange-400" />
                    <span className="text-orange-400 text-xs font-semibold">Divergência</span>
                  </div>
                )}
                <DashboardExportMenu
                  variant="mobile"
                  title="Produção Balanças Integradoras"
                  subtitle={`Período: ${dataInicio} a ${dataFim}`}
                  filename="producao-balancas-mobile"
                  exportOptions={{
                    columns: [
                      { header: 'Equipamento', key: 'equipamento', width: 25 },
                      { header: 'Leit. Inicial', key: 'leitInicial', width: 15 },
                      { header: 'Leit. Final', key: 'leitFinal', width: 15 },
                      { header: 'Produção', key: 'producao', width: 15 },
                      { header: 'Divergência', key: 'divergencia', width: 12 },
                    ],
                    data: producaoBalancasData.data.equipamentos.map((e: any) => ({ equipamento: e.nome, leitInicial: e.leituraInicial, leitFinal: e.leituraFinal, producao: e.producaoBalanca, divergencia: e.divergencia ? 'SIM' : 'Não' })),
                  }}
                  whatsappMessage={(() => {
                    const total = producaoBalancasData.data!.equipamentos.reduce((acc: number, e: any) => acc + e.producaoBalanca, 0);
                    return `⚖️ *Produção Balanças*\nTotal: ${formatNumber(total, 2)} ton`;
                  })()}
                  whatsappDestinatarios={(destinatariosWpp.data || []).filter((d: any) => d.ativo === 'sim').map((d: any) => d.telefone)}
                />
              </div>
            </div>
            <div className="space-y-2">
              {producaoBalancasData.data.equipamentos.map((eq: any) => (
                <div key={eq.equipamentoId} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      {eq.divergencia && <AlertTriangle className="w-3 h-3 text-orange-400 shrink-0" />}
                      <span className={`text-xs truncate max-w-[160px] ${eq.divergencia ? "text-orange-300" : "text-teal-300"}`} title={eq.nome}>{eq.nome}</span>
                    </div>
                    <span className={`text-sm font-bold ${eq.divergencia ? "text-orange-300" : "text-white"}`}>
                      {formatNumber(eq.producaoBalanca, 2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] text-teal-500 pl-4">
                    <span>Ini: {formatNumber(eq.leituraInicial, 2)}</span>
                    <span>Fin: {formatNumber(eq.leituraFinal, 2)}</span>
                  </div>
                  {eq.divergencia && (
                    <div className="ml-4 text-[10px] text-orange-400 bg-orange-900/40 rounded px-2 py-1">
                      ⚠ Conferência: {formatNumber(eq.producaoConferencia, 2)} ≠ Soma: {formatNumber(eq.producaoBalanca, 2)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* Produção por Setor */}
      {/* ============================================================ */}
      {producaoPorSetor.isLoading ? (
        <div className="px-4 mt-4"><div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden"><CardSkeletonMobile rows={5} /></div></div>
      ) : producaoPorSetor.data && producaoPorSetor.data.length > 0 ? (
        <div className="px-4 mt-4">
          <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Factory className="w-4 h-4 text-blue-400" />
                <p className="text-white text-sm font-semibold">Produção por Setor</p>
              </div>
              <DashboardExportMenu
                variant="mobile"
                title="Produção por Setor"
                subtitle={`Período: ${dataInicio} a ${dataFim}`}
                filename="producao-setor-mobile"
                exportOptions={{
                  columns: [
                    { header: 'Setor', key: 'setor', width: 25 },
                    { header: 'Produção (ton)', key: 'producao', width: 15, format: formatters.decimal },
                  ],
                  data: (producaoPorSetor.data || []).map((item: any) => ({ setor: item.setorNome, producao: item.producaoTotal })),
                }}
                whatsappMessage={`🏭 *Produção por Setor*\n${(producaoPorSetor.data || []).map((item: any) => `  ${item.setorNome}: ${formatNumber(item.producaoTotal)}`).join('\n')}`}
                whatsappDestinatarios={(destinatariosWpp.data || []).filter((d: any) => d.ativo === 'sim').map((d: any) => d.telefone)}
              />
            </div>
            <div className="space-y-2">
              {(producaoPorSetor.data.length <= 8 ? producaoPorSetor.data : expandSetor ? producaoPorSetor.data : producaoPorSetor.data.slice(0, 8)).map((item: any) => (
                <div key={item.setorId} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-white/80 truncate max-w-[65%]">{item.setorNome}</span>
                    <span className="text-blue-400 font-semibold shrink-0">{formatNumber(item.producaoTotal)}</span>
                  </div>
                  <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(item.producaoTotal / maxProducaoSetor) * 100}%` }} />
                  </div>
                </div>
              ))}
              {producaoPorSetor.data.length > 8 && (
                <button onClick={() => setExpandSetor(!expandSetor)} className="flex items-center justify-center gap-1 w-full text-xs text-blue-400 pt-1">
                  {expandSetor ? <><ChevronUp className="w-3 h-3" /> Recolher</> : <><ChevronDown className="w-3 h-3" /> Ver mais {producaoPorSetor.data.length - 8} setores</>}
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* ============================================================ */}
      {/* Produção por Serviço */}
      {/* ============================================================ */}
      {producaoPorServico.isLoading ? (
        <div className="px-4 mt-4"><div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden"><CardSkeletonMobile rows={5} /></div></div>
      ) : producaoPorServico.data && producaoPorServico.data.length > 0 ? (
        <div className="px-4 mt-4">
          <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-purple-400" />
                <p className="text-white text-sm font-semibold">Produção por Serviço</p>
              </div>
              <DashboardExportMenu
                variant="mobile"
                title="Produção por Serviço"
                subtitle={`Período: ${dataInicio} a ${dataFim}`}
                filename="producao-servico-mobile"
                exportOptions={{
                  columns: [
                    { header: 'Serviço', key: 'servico', width: 25 },
                    { header: 'Produção (ton)', key: 'producao', width: 15, format: formatters.decimal },
                  ],
                  data: (producaoPorServico.data || []).map((item: any) => ({ servico: item.servicoNome, producao: item.producaoTotal })),
                }}
                whatsappMessage={`⚙️ *Produção por Serviço*\n${(producaoPorServico.data || []).map((item: any) => `  ${item.servicoNome}: ${formatNumber(item.producaoTotal)}`).join('\n')}`}
                whatsappDestinatarios={(destinatariosWpp.data || []).filter((d: any) => d.ativo === 'sim').map((d: any) => d.telefone)}
              />
            </div>
            <div className="space-y-2">
              {(producaoPorServico.data.length <= 8 ? producaoPorServico.data : expandServico ? producaoPorServico.data : producaoPorServico.data.slice(0, 8)).map((item: any) => (
                <div key={item.servicoId} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-white/80 truncate max-w-[65%]">{item.servicoNome}</span>
                    <span className="text-purple-400 font-semibold shrink-0">{formatNumber(item.producaoTotal)}</span>
                  </div>
                  <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-purple-500 rounded-full" style={{ width: `${(item.producaoTotal / maxProducaoServico) * 100}%` }} />
                  </div>
                </div>
              ))}
              {producaoPorServico.data.length > 8 && (
                <button onClick={() => setExpandServico(!expandServico)} className="flex items-center justify-center gap-1 w-full text-xs text-purple-400 pt-1">
                  {expandServico ? <><ChevronUp className="w-3 h-3" /> Recolher</> : <><ChevronDown className="w-3 h-3" /> Ver mais {producaoPorServico.data.length - 8} serviços</>}
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* ============================================================ */}
      {/* Produção por Equipamento */}
      {/* ============================================================ */}
      {producaoPorEquipamento.isLoading ? (
        <div className="px-4 mt-4"><div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden"><CardSkeletonMobile rows={5} /></div></div>
      ) : producaoPorEquipamento.data && producaoPorEquipamento.data.length > 0 ? (
        <div className="px-4 mt-4">
          <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-green-400" />
                <p className="text-white text-sm font-semibold">Produção por Equipamento</p>
              </div>
              <DashboardExportMenu
                variant="mobile"
                title="Produção por Equipamento"
                subtitle={`Período: ${dataInicio} a ${dataFim}`}
                filename="producao-equipamento-mobile"
                exportOptions={{
                  columns: [
                    { header: 'Equipamento', key: 'equipamento', width: 25 },
                    { header: 'Produção (ton)', key: 'producao', width: 15, format: formatters.decimal },
                  ],
                  data: (producaoPorEquipamento.data || []).map((item: any) => ({ equipamento: item.equipamentoTag || item.equipamentoNome, producao: item.producaoTotal })),
                }}
                whatsappMessage={`🚛 *Produção por Equipamento*\n${(producaoPorEquipamento.data || []).map((item: any) => `  ${item.equipamentoTag || item.equipamentoNome}: ${formatNumber(item.producaoTotal)}`).join('\n')}`}
                whatsappDestinatarios={(destinatariosWpp.data || []).filter((d: any) => d.ativo === 'sim').map((d: any) => d.telefone)}
              />
            </div>
            <div className="space-y-2">
              {(producaoPorEquipamento.data.length <= 8 ? producaoPorEquipamento.data : expandEquipamento ? producaoPorEquipamento.data : producaoPorEquipamento.data.slice(0, 8)).map((item: any) => (
                <div key={item.equipamentoId} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-white/80 truncate max-w-[65%]">{item.equipamentoTag || item.equipamentoNome}</span>
                    <span className="text-green-400 font-semibold shrink-0">{formatNumber(item.producaoTotal)}</span>
                  </div>
                  <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full" style={{ width: `${(item.producaoTotal / maxProducaoEquipamento) * 100}%` }} />
                  </div>
                </div>
              ))}
              {producaoPorEquipamento.data.length > 8 && (
                <button onClick={() => setExpandEquipamento(!expandEquipamento)} className="flex items-center justify-center gap-1 w-full text-xs text-green-400 pt-1">
                  {expandEquipamento ? <><ChevronUp className="w-3 h-3" /> Recolher</> : <><ChevronDown className="w-3 h-3" /> Ver mais {producaoPorEquipamento.data.length - 8} equipamentos</>}
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* ============================================================ */}
      {/* Horas Trabalhadas */}
      {/* ============================================================ */}
      {horasTrabalhadasMobile.isLoading ? (
        <div className="px-4 mt-4"><div className="bg-amber-900/70 rounded-2xl border border-amber-700 overflow-hidden"><CardSkeletonMobile rows={4} /></div></div>
      ) : (horasTrabalhadasMobile.data?.equipamentos && horasTrabalhadasMobile.data.equipamentos.length > 0) ? (
        <div className="px-4 mt-4">
          <div className="bg-amber-900/70 rounded-2xl p-4 border border-amber-700">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <p className="text-amber-300 text-sm font-semibold">Horas Trabalhadas</p>
              </div>
              <DashboardExportMenu
                variant="mobile"
                title="Horas Trabalhadas por Equipamento"
                subtitle={`Período: ${dataInicio} a ${dataFim}`}
                filename="horas-trabalhadas-mobile"
                exportOptions={{
                  columns: [
                    { header: 'Equipamento', key: 'equipamento', width: 30 },
                    { header: 'Hor/Km Trabalhados', key: 'horas', width: 20, format: formatters.decimal },
                  ],
                  data: (horasTrabalhadasMobile.data?.equipamentos || []).map((e: any) => ({ equipamento: e.equipamentoTag || e.equipamentoNome, horas: e.totalHoras })),
                }}
                whatsappMessage={`⏱️ *Horas Trabalhadas*\nTotal: ${formatNumber(horasTrabalhadasMobile.data?.totalHoras || 0, 2)} h/km\n${(horasTrabalhadasMobile.data?.equipamentos || []).map((e: any) => `  ${e.equipamentoTag || e.equipamentoNome}: ${formatNumber(e.totalHoras, 2)}`).join('\n')}`}
                whatsappDestinatarios={(destinatariosWpp.data || []).filter((d: any) => d.ativo === 'sim').map((d: any) => d.telefone)}
              />
            </div>
            <p className="text-white text-xl font-bold">{formatNumber(horasTrabalhadasMobile.data.totalHoras || 0, 2)} <span className="text-amber-400/70 text-sm font-normal">h/km</span></p>
            <p className="text-amber-400/70 text-xs mb-3">{horasTrabalhadasMobile.data.equipamentos.length} equipamento(s) no período</p>
            <div className="space-y-2">
              {(horasTrabalhadasMobile.data.equipamentos.length <= 8 ? horasTrabalhadasMobile.data.equipamentos : expandHorasTrabalhadasMobile ? horasTrabalhadasMobile.data.equipamentos : horasTrabalhadasMobile.data.equipamentos.slice(0, 8)).map((item: any) => (
                <div key={item.equipamentoId} className="bg-amber-800/40 rounded-xl p-3 border border-amber-700/50">
                  <div className="flex justify-between items-center">
                    <span className="text-white text-xs font-semibold truncate max-w-[65%]">{item.equipamentoTag || item.equipamentoNome}</span>
                    <span className="text-amber-300 text-xs font-bold">{formatNumber(item.totalHoras, 2)} h/km</span>
                  </div>
                  <div className="mt-1.5 h-1.5 bg-amber-900/60 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full"
                      style={{ width: `${(item.totalHoras / Math.max(...(horasTrabalhadasMobile.data?.equipamentos?.map((e: any) => e.totalHoras) || [1]))) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
              {horasTrabalhadasMobile.data.equipamentos.length > 8 && (
                <button onClick={() => setExpandHorasTrabalhadasMobile(!expandHorasTrabalhadasMobile)} className="flex items-center justify-center gap-1 w-full text-xs text-amber-400 pt-1">
                  {expandHorasTrabalhadasMobile ? <><ChevronUp className="w-3 h-3" /> Recolher</> : <><ChevronDown className="w-3 h-3" /> Ver mais {horasTrabalhadasMobile.data.equipamentos.length - 8} equipamentos</>}
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* ============================================================ */}
      {/* Metas configuradas */}
      {/* ============================================================ */}
      {metasList.data && metasList.data.filter((m: any) => m.ativo === "sim").length > 0 && (
        <div className="px-4 mt-4">
          <h3 className="text-white/70 text-xs font-semibold uppercase tracking-wider mb-2">Metas Configuradas</h3>
          <div className="space-y-2">
            {metasList.data.filter((m: any) => m.ativo === "sim").map((meta: any) => (
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
        <a href="/" className="flex items-center justify-between bg-slate-800 rounded-2xl p-4 border border-slate-700">
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
