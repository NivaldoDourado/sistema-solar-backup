import { useState, useCallback, useMemo } from "react";
import { Link } from "wouter";
import { useDropzone } from "react-dropzone";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Upload, RefreshCw, AlertCircle, CheckCircle2, FileSpreadsheet, PieChart, Factory, Building2, TrendingUp, Calculator, Truck } from "lucide-react";
import { toast } from "sonner";
import { exportRelatorioToExcel, exportRelatorioToPDF } from "@/lib/export-utils";
import { DonutChartModal } from "@/components/DonutChartModal";
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// Formatadores
const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
const fmtTon = (v: number) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = (v: number) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";

// Paleta de cores para os grupos (ordem fixa)
const GRUPO_PALETA: Record<string, string> = {
  "DESMONTE DE ROCHA":    "#f59e0b",
  "CARGA E TRANSPORTE":   "#3b82f6",
  "BRITAGEM":             "#22c55e",
  "EXPEDIÇÃO":            "#a855f7",
  "SERVIÇOS AUXILIARES":  "#f97316",
  "ADMINISTRAÇÃO":        "#6b7280",
};

// Cores de fundo/borda dos cards de grupo
const GRUPO_CORES: Record<string, string> = {
  "DESMONTE DE ROCHA":    "bg-amber-50 border-amber-200",
  "CARGA E TRANSPORTE":   "bg-blue-50 border-blue-200",
  "BRITAGEM":             "bg-green-50 border-green-200",
  "EXPEDIÇÃO":            "bg-purple-50 border-purple-200",
  "SERVIÇOS AUXILIARES":  "bg-orange-50 border-orange-200",
  "ADMINISTRAÇÃO":        "bg-gray-50 border-gray-200",
};

const GRUPO_HEADER_CORES: Record<string, string> = {
  "DESMONTE DE ROCHA":    "bg-amber-100 text-amber-800",
  "CARGA E TRANSPORTE":   "bg-blue-100 text-blue-800",
  "BRITAGEM":             "bg-green-100 text-green-800",
  "EXPEDIÇÃO":            "bg-purple-100 text-purple-800",
  "SERVIÇOS AUXILIARES":  "bg-orange-100 text-orange-800",
  "ADMINISTRAÇÃO":        "bg-gray-100 text-gray-800",
};

// Tooltip customizado do gráfico
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const d = payload[0].payload;
    return (
      <div className="bg-white border border-border rounded-lg shadow-lg px-4 py-3 text-sm">
        <p className="font-semibold text-foreground mb-1">{d.name}</p>
        <p className="text-muted-foreground">
          Total: <span className="font-medium text-foreground">{fmtBRL(d.value)}</span>
        </p>
        <p className="text-muted-foreground">
          Participação: <span className="font-medium text-foreground">{fmtPct(d.pct)}</span>
        </p>
        <p className="text-muted-foreground">
          Custo/t: <span className="font-medium text-foreground">R$ {fmtTon(d.custoTon)}</span>
        </p>
      </div>
    );
  }
  return null;
};

// Label customizado dentro das fatias (só exibe se fatia >= 5%)
const renderCustomLabel = ({
  cx, cy, midAngle, innerRadius, outerRadius, pct,
}: any) => {
  if (pct < 5) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central"
      fontSize={12} fontWeight={600}>
      {fmtPct(pct)}
    </text>
  );
};

export default function CustoSetor() {
  const [periodoSelecionado, setPeriodoSelecionado] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);

  // Buscar períodos disponíveis
  const { data: periodos } = trpc.periodoCusto.list.useQuery();

  // Buscar relatório do período selecionado
  const { data: relatorio, isLoading: loadingRelatorio, refetch } = trpc.custoSetor.relatorio.useQuery(
    { periodoCustoId: periodoSelecionado! },
    { enabled: !!periodoSelecionado }
  );

  // Selecionar automaticamente o período mais recente
  if (periodos && periodos.length > 0 && !periodoSelecionado) {
    setPeriodoSelecionado(periodos[0].id);
  }

  // Upload da planilha RSSET
  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;
      setUploading(true);
      setUploadResult(null);
      try {
        const formData = new FormData();
        formData.append("file", file);
        const response = await fetch("/api/importacao-custo-setor", {
          method: "POST",
          body: formData,
          credentials: "include",
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Erro ao importar planilha");
        setUploadResult(data);
        toast.success(
          `Importação concluída: ${data.subsetoresImportados} subsetores (${data.criados} criados, ${data.atualizados} atualizados)`
        );
        if (data.periodoCustoId) {
          setPeriodoSelecionado(data.periodoCustoId);
          refetch();
        }
      } catch (err: any) {
        toast.error(err.message || "Erro ao importar planilha");
      } finally {
        setUploading(false);
      }
    },
    [refetch]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
    },
    maxFiles: 1,
    disabled: uploading,
  });

  // Destinatários WhatsApp
  const { data: destinatariosWpp } = trpc.destinatariosWhatsapp.list.useQuery();
  const destinatariosAtivos = useMemo(
    () => (destinatariosWpp || []).filter((d: any) => d.ativo === "sim").map((d: any) => d.telefone),
    [destinatariosWpp]
  );

  // Período atual
  const periodoAtual = useMemo(
    () => periodos?.find((p: any) => p.id === periodoSelecionado) ?? null,
    [periodos, periodoSelecionado]
  );
  const periodoLabel = periodoAtual
    ? `${String(periodoAtual.mes).padStart(2, "0")}/${periodoAtual.ano}`
    : "";

  // Buscar produção do módulo para o período selecionado
  const { data: producaoModulo } = trpc.periodoCusto.getProducaoDoModulo.useQuery(
    { mes: periodoAtual?.mes ?? 1, ano: periodoAtual?.ano ?? 2026 },
    { enabled: !!periodoAtual }
  );
  const producaoTotal = producaoModulo?.total ?? parseFloat(periodoAtual?.producaoTotal ?? "0") ?? 0;
  const vendasTotal = parseFloat(periodoAtual?.quantidadeVendida ?? "0") || 0;

  // Buscar lançamentos de custo para calcular KPIs detalhados
  const { data: lancamentosCusto } = trpc.lancamentoCusto.listByPeriodo.useQuery(
    { periodoCustoId: periodoSelecionado! },
    { enabled: !!periodoSelecionado }
  );

  // Buscar vendas ERP
  const periodoVendasDatas = useMemo(() => {
    if (!periodoAtual) return null;
    const mes = String(periodoAtual.mes).padStart(2, "0");
    const ano = periodoAtual.ano;
    const lastDay = new Date(ano, periodoAtual.mes, 0).getDate();
    return {
      periodoInicio: `${ano}-${mes}-01`,
      periodoFim: `${ano}-${mes}-${String(lastDay).padStart(2, "0")}`,
    };
  }, [periodoAtual]);
  const { data: resumoVendasERP } = trpc.vendas.resumoVendasParaPeriodoCusto.useQuery(
    { periodoInicio: periodoVendasDatas?.periodoInicio ?? "", periodoFim: periodoVendasDatas?.periodoFim ?? "" },
    { enabled: !!periodoVendasDatas }
  );

  // KPIs calculados (mesma lógica da Apuração de Custo)
  const kpisCalculados = useMemo(() => {
    if (!lancamentosCusto || !periodoAtual) return null;
    const producao = producaoTotal;
    const vendas = parseFloat(periodoAtual.quantidadeVendida ?? "0") || (resumoVendasERP?.totalQuantidade ?? 0);
    let totalCustoVariavel = 0;
    let totalDespesaVariavel = 0;
    let totalDespesasIndiretas = 0;
    let totalGeralCalc = 0;
    // Agrupar lançamentos da mesma conta
    const agrupado = new Map<number, { nome: string; valor: number; divisor: string; classificacao: string }>();
    for (const l of lancamentosCusto as any[]) {
      const valor = parseFloat(String(l.valor || "0"));
      if (valor === 0) continue;
      const existing = agrupado.get(l.contaCustoId);
      if (existing) {
        existing.valor += valor;
      } else {
        agrupado.set(l.contaCustoId, {
          nome: l.contaNome ?? "—",
          valor,
          divisor: l.contaDivisor ?? "producao",
          classificacao: l.contaClassificacao ?? "custo_variavel",
        });
      }
    }
    for (const [, { valor, divisor, classificacao }] of Array.from(agrupado.entries())) {
      if (classificacao === "despesa_variavel" && divisor === "producao") {
        totalDespesasIndiretas += valor;
      } else if (divisor === "vendas") {
        totalDespesaVariavel += valor;
      } else {
        totalCustoVariavel += valor;
      }
      totalGeralCalc += valor;
    }
    const custoPorTonProducao = producao > 0 ? totalCustoVariavel / producao : 0;
    const custoPorTonVendas = vendas > 0 ? totalDespesaVariavel / vendas : 0;
    const custoMedio = custoPorTonProducao + custoPorTonVendas;
    const custoPorTonDespesasIndiretas = producao > 0 ? totalDespesasIndiretas / producao : 0;
    const custoMedioComDI = custoMedio + custoPorTonDespesasIndiretas;
    return {
      producao,
      vendas,
      totalCustoVariavel,
      totalDespesaVariavel,
      totalDespesasIndiretas,
      totalGeral: totalGeralCalc,
      custoMedio,
      custoMedioComDI,
    };
  }, [lancamentosCusto, periodoAtual, producaoTotal, resumoVendasERP]);

  // Totais gerais
  const totalGeral = relatorio?.totalGeral ?? 0;
  const totalCustoTon = relatorio?.totalCustoTon ?? 0;

  // Dados de exportação
  const exportOptions = useMemo(() => {
    if (!relatorio || !relatorio.grupos.length) return null;
    const rows: Record<string, any>[] = [];
    for (const grupo of relatorio.grupos) {
      for (const sub of grupo.subsetores) {
        const sCustoFixo = parseFloat(String(sub.custoFixo ?? 0));
        const sCustoVar = parseFloat(String(sub.custoVariavel ?? 0));
        const sTotalCusto = parseFloat(String(sub.totalCusto ?? 0));
        const sDespFixa = parseFloat(String(sub.despesaFixa ?? 0));
        const sDespVar = parseFloat(String(sub.despesaVariavel ?? 0));
        const sTotalDesp = parseFloat(String(sub.totalDespesa ?? 0));
        const sTotalGeral = parseFloat(String(sub.totalGeral ?? 0));
        const sCustoTon = parseFloat(String(sub.custoTon ?? 0));
        const pctGrupo = grupo.subtotalGeral > 0 ? (sTotalGeral / grupo.subtotalGeral) * 100 : 0;
        rows.push({
          grupo: grupo.grupoNome,
          subsetor: sub.subsetorNome,
          custoFixo: sCustoFixo > 0 ? fmtBRL(sCustoFixo) : "",
          custoVariavel: sCustoVar > 0 ? fmtBRL(sCustoVar) : "",
          totalCusto: fmtBRL(sTotalCusto),
          despesaFixa: sDespFixa > 0 ? fmtBRL(sDespFixa) : "",
          despesaVariavel: sDespVar > 0 ? fmtBRL(sDespVar) : "",
          totalDespesa: sTotalDesp > 0 ? fmtBRL(sTotalDesp) : "",
          totalGeral: fmtBRL(sTotalGeral),
          custoTon: `R$ ${fmtTon(sCustoTon)}`,
          percentual: fmtPct(pctGrupo),
        });
      }
      rows.push({
        grupo: `SUBTOTAL ${grupo.grupoNome}`,
        subsetor: "",
        custoFixo: "",
        custoVariavel: "",
        totalCusto: "",
        despesaFixa: "",
        despesaVariavel: "",
        totalDespesa: "",
        totalGeral: fmtBRL(grupo.subtotalGeral),
        custoTon: `R$ ${fmtTon(grupo.subtotalCustoTon)}`,
        percentual: fmtPct(totalGeral > 0 ? (grupo.subtotalGeral / totalGeral) * 100 : 0),
      });
    }
    rows.push({
      grupo: "TOTAL GERAL",
      subsetor: "",
      custoFixo: "",
      custoVariavel: "",
      totalCusto: "",
      despesaFixa: "",
      despesaVariavel: "",
      totalDespesa: "",
      totalGeral: fmtBRL(totalGeral),
      custoTon: `R$ ${fmtTon(totalCustoTon)}`,
      percentual: "100,0%",
    });
    return {
      columns: [
        { key: "grupo", header: "Grupo", width: 22 },
        { key: "subsetor", header: "Subsetor", width: 26 },
        { key: "totalCusto", header: "Total Custo", width: 18 },
        { key: "totalDespesa", header: "Total Despesa", width: 18 },
        { key: "totalGeral", header: "Total Geral", width: 18 },
        { key: "custoTon", header: "Custo/t", width: 16 },
        { key: "percentual", header: "% do Grupo", width: 14 },
      ],
      data: rows,
    };
  }, [relatorio, totalGeral, totalCustoTon]);

  // Mensagem WhatsApp
  const whatsappMessage = useMemo(() => {
    if (!relatorio || !relatorio.grupos.length) return undefined;
    let msg = `🏭 *Custo Sintético por Setor — ${periodoLabel}*\n`;
    if (kpisCalculados) {
      msg += `Produção: ${producaoTotal > 0 ? fmtTon(producaoTotal) + " t" : "—"} | Vendas: ${kpisCalculados.vendas > 0 ? fmtTon(kpisCalculados.vendas) + " t" : "—"}\n`;
      msg += `Total s/ DI: ${fmtBRL(kpisCalculados.totalCustoVariavel + kpisCalculados.totalDespesaVariavel)} | Total c/ DI: ${fmtBRL(kpisCalculados.totalGeral)}\n`;
      msg += `C.M. s/ DI: R$ ${fmtTon(kpisCalculados.custoMedio)} | C.M. c/ DI: R$ ${fmtTon(kpisCalculados.custoMedioComDI)}\n\n`;
    } else {
      msg += `Total Geral: ${fmtBRL(totalGeral)} | Custo/t: R$ ${fmtTon(totalCustoTon)}\n\n`;
    }
    for (const g of relatorio.grupos) {
      const pct = totalGeral > 0 ? (g.subtotalGeral / totalGeral) * 100 : 0;
      msg += `*${g.grupoNome}:* ${fmtBRL(g.subtotalGeral)} (${fmtPct(pct)}) | R$ ${fmtTon(g.subtotalCustoTon)}/t\n`;
    }
    return msg;
   }, [relatorio, totalGeral, totalCustoTon, periodoLabel, kpisCalculados, producaoTotal]);
  // Dados para o gráfico de rosca — subsetores individuais (ordem decrescente por totalGeral)
  const dadosGrafico = useMemo(() => {
    if (!relatorio?.grupos?.length) return [];
    const subsetores: any[] = [];
    for (const g of relatorio.grupos) {
      const corBase = GRUPO_PALETA[g.grupoNome] ?? "#94a3b8";
      for (const s of g.subsetores ?? []) {
        const totalSub = parseFloat(String(s.totalGeral ?? 0));
        const custoTon = parseFloat(String(s.custoTon ?? 0));
        subsetores.push({
          name: s.subsetorNome,
          value: totalSub,
          pct: totalGeral > 0 ? (totalSub / totalGeral) * 100 : 0,
          custoTon,
          subtitle: `R$ ${fmtTon(custoTon)}/t`,
          fill: corBase,
          grupo: g.grupoNome,
          details: [
            { label: "Grupo", value: g.grupoNome },
            { label: "Total R$", value: fmtBRL(totalSub) },
            { label: "Custo/t", value: `R$ ${fmtTon(custoTon)}/t` },
          ],
        });
      }
    }
    return subsetores.sort((a, b) => b.value - a.value);
  }, [relatorio, totalGeral]);

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-4 md:space-y-6 w-full max-w-full overflow-x-hidden">
        {/* Cabeçalho */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 md:h-6 md:w-6 text-primary shrink-0" />
              <span className="truncate">Custo Sintético por Setor</span>
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Relatório de custos distribuídos por setor produtivo
            </p>
            {periodoAtual && (
              <div className="flex items-center gap-3 flex-wrap mt-2">
                <Badge variant={periodoAtual.fechado === "sim" ? "secondary" : "default"}>
                  {periodoAtual.fechado === "sim" ? "Fechado" : "Aberto"}
                </Badge>
                {producaoTotal > 0 && (
                  <span className="text-sm text-muted-foreground">
                    Produção: <strong>{producaoTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} t</strong>
                  </span>
                )}
                {vendasTotal > 0 && (
                  <span className="text-sm text-muted-foreground">
                    Vendas: <strong>{vendasTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} t</strong>
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {periodos && periodos.length > 0 && (
              <Select
                value={periodoSelecionado?.toString() ?? ""}
                onValueChange={(v) => setPeriodoSelecionado(Number(v))}
              >
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Selecionar período" />
                </SelectTrigger>
                <SelectContent>
                  {periodos.map((p: any) => (
                    <SelectItem key={p.id} value={p.id.toString()}>
                      {String(p.mes).padStart(2, "0")}/{p.ano}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={loadingRelatorio}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loadingRelatorio ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            {relatorio && relatorio.grupos.length > 0 && (() => {
              const buildKpis = () => [
                { label: "Produção (t)", value: producaoTotal > 0 ? fmtTon(producaoTotal) + " t" : "—" },
                { label: "Vendas (t)", value: (kpisCalculados?.vendas ?? vendasTotal) > 0 ? fmtTon(kpisCalculados?.vendas ?? vendasTotal) + " t" : "—" },
                { label: "Total Desp. s/ Desp. Indiretas", value: kpisCalculados ? fmtBRL(kpisCalculados.totalCustoVariavel + kpisCalculados.totalDespesaVariavel) : fmtBRL(totalGeral) },
                { label: "Total Desp. c/ Despesas Indiretas", value: fmtBRL(kpisCalculados?.totalGeral ?? totalGeral) },
                { label: "C.M. s/ Despesas Indiretas", value: kpisCalculados && kpisCalculados.custoMedio > 0 ? `R$ ${fmtTon(kpisCalculados.custoMedio)}` : "—" },
                { label: "C.M. c/ Desp. Indiretas", value: kpisCalculados && kpisCalculados.custoMedioComDI > 0 ? `R$ ${fmtTon(kpisCalculados.custoMedioComDI)}` : "—" },
              ];
              const buildSecoes = () => {
                // Seção 1: Resumo Consolidado por Subsetor (todos os subsetores juntos)
                const resumoConsolidado = {
                  titulo: "Resumo Consolidado por Subsetor",
                  corCabecalho: [15, 23, 42] as [number, number, number],
                  linhas: [
                    ...relatorio.grupos.flatMap((g: any) =>
                      g.subsetores.map((s: any) => ({
                        conta: s.subsetorNome,
                        divisor: g.grupoNome,
                        valor: fmtBRL(parseFloat(s.totalCusto ?? "0")),
                        custoPorTon: `R$ ${fmtTon(parseFloat(s.custoTon ?? "0"))}`,
                        percentual: fmtPct(totalGeral > 0 ? (parseFloat(s.totalGeral ?? "0") / totalGeral) * 100 : 0),
                      }))
                    ),
                    { conta: "TOTAL DOS DESEMBOLSOS", valor: fmtBRL(totalGeral), custoPorTon: `R$ ${fmtTon(totalCustoTon)}`, percentual: "100,0%", isTotal: true },
                  ],
                };
                // Seções por grupo
                const secoesGrupos = relatorio.grupos.map((g: any) => ({
                  titulo: g.grupoNome,
                  corCabecalho: (
                    g.grupoNome === "DESMONTE DE ROCHA" ? [180, 100, 0] :
                    g.grupoNome === "CARGA E TRANSPORTE" ? [30, 64, 175] :
                    g.grupoNome === "BRITAGEM" ? [22, 101, 52] :
                    g.grupoNome === "EXPEDIÇÃO" ? [126, 34, 206] :
                    g.grupoNome === "SERVIÇOS AUXILIARES" ? [180, 60, 0] :
                    [50, 50, 80]
                  ) as [number, number, number],
                  linhas: [
                    ...g.subsetores.map((s: any) => ({
                      conta: s.subsetorNome,
                      valor: fmtBRL(parseFloat(s.totalCusto ?? "0")),
                      custoPorTon: `R$ ${fmtTon(parseFloat(s.custoTon ?? "0"))}`,
                      percentual: fmtPct(totalGeral > 0 ? (parseFloat(s.totalGeral ?? "0") / totalGeral) * 100 : 0),
                    })),
                    { conta: `SUBTOTAL ${g.grupoNome}`, valor: fmtBRL(g.subtotalGeral), custoPorTon: `R$ ${fmtTon(g.subtotalCustoTon)}`, isSubtotal: true },
                  ],
                }));
                return [resumoConsolidado, ...secoesGrupos];
              };
              return (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => exportRelatorioToExcel({
                      titulo: `Custo Sintético por Setor — ${periodoLabel}`,
                      periodo: periodoLabel,
                      kpis: buildKpis(),
                      secoes: buildSecoes(),
                      filename: `custo-setor-${periodoLabel.replace("/", "-")}`,
                    })}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                    Excel
                  </button>
                  <button
                    onClick={async () => exportRelatorioToPDF({
                      titulo: `Custo Sintético por Setor — ${periodoLabel}`,
                      periodo: periodoLabel,
                      kpis: buildKpis(),
                      secoes: buildSecoes(),
                      filename: `custo-setor-${periodoLabel.replace("/", "-")}`,
                    })}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-600"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                    PDF
                  </button>
                  {whatsappMessage && destinatariosAtivos.length > 0 && (
                    <button
                      onClick={() => {
                        const encoded = encodeURIComponent(whatsappMessage);
                        destinatariosAtivos.forEach((tel, idx) => {
                          const numero = tel.replace(/\D/g, "");
                          setTimeout(() => window.open(`https://wa.me/${numero}?text=${encoded}`, "_blank"), idx * 800);
                        });
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-500"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                      WhatsApp
                    </button>
                  )}
                </div>
              );
            })()}
          </div>
        </div>

        {/* Upload da planilha */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Importar Planilha RSSET
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                isDragActive
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/30"
              } ${uploading ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <input {...getInputProps()} />
              {uploading ? (
                <div className="flex flex-col items-center gap-2">
                  <RefreshCw className="h-8 w-8 text-primary animate-spin" />
                  <p className="text-sm text-muted-foreground">Importando planilha...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm font-medium">
                    {isDragActive ? "Solte o arquivo aqui" : "Arraste a planilha CUSTOSOLAR ou clique para selecionar"}
                  </p>
                  <p className="text-xs text-muted-foreground">Arquivo .xlsx — aba RSSET</p>
                </div>
              )}
            </div>

            {uploadResult && (
              <div className="mt-4 p-4 rounded-lg bg-muted/50 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-green-700">
                  <CheckCircle2 className="h-4 w-4" />
                  Importação concluída com sucesso
                </div>
                <div className="flex gap-4 text-sm text-muted-foreground">
                  <span>
                    <strong className="text-foreground">{uploadResult.subsetoresImportados}</strong> subsetores importados
                  </span>
                  <span>
                    <strong className="text-green-600">{uploadResult.criados}</strong> criados
                  </span>
                  <span>
                    <strong className="text-blue-600">{uploadResult.atualizados}</strong> atualizados
                  </span>
                </div>
                {uploadResult.erros?.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {uploadResult.erros.map((e: string, i: number) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-red-600">
                        <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                        {e}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Loading */}
        {loadingRelatorio && (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-6 w-6 animate-spin text-primary mr-2" />
            <span className="text-muted-foreground">Carregando relatório...</span>
          </div>
        )}

        {/* Sem dados */}
        {relatorio && relatorio.grupos.length === 0 && !loadingRelatorio && (
          <Card>
            <CardContent className="py-12 text-center">
              <FileSpreadsheet className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">
                Nenhum dado encontrado para este período. Importe a planilha RSSET para visualizar o relatório.
              </p>
            </CardContent>
          </Card>
        )}

        {relatorio && relatorio.grupos.length > 0 && (
          <>
            {/* Cards KPIs — mesmos 6 da Apuração de Custo */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {/* 1. Produção */}
              <Card className="border-emerald-200 bg-emerald-50">
                <CardContent className="pt-3 pb-3">
                  <div className="flex items-center gap-1 mb-1">
                    <Truck className="h-3 w-3 text-emerald-600" />
                    <p className="text-[10px] text-muted-foreground font-medium uppercase">Produção (t)</p>
                  </div>
                  <p className="text-sm font-bold text-emerald-700 font-mono">
                    {producaoTotal > 0 ? fmtTon(producaoTotal) + " t" : "—"}
                  </p>
                </CardContent>
              </Card>
              {/* 2. Vendas */}
              <Card className="border-sky-200 bg-sky-50">
                <CardContent className="pt-3 pb-3">
                  <div className="flex items-center gap-1 mb-1">
                    <TrendingUp className="h-3 w-3 text-sky-600" />
                    <p className="text-[10px] text-muted-foreground font-medium uppercase">Vendas (t)</p>
                  </div>
                  <p className="text-sm font-bold text-sky-700 font-mono">
                    {(kpisCalculados?.vendas ?? vendasTotal) > 0 ? fmtTon(kpisCalculados?.vendas ?? vendasTotal) + " t" : "—"}
                  </p>
                </CardContent>
              </Card>
              {/* 3. Total Desp. s/ Desp. Indiretas */}
              <Card className="border-blue-200 bg-blue-50">
                <CardContent className="pt-3 pb-3">
                  <div className="flex items-center gap-1 mb-1">
                    <Factory className="h-3 w-3 text-blue-600" />
                    <p className="text-[10px] text-muted-foreground font-medium uppercase">Total s/ Desp. Indir.</p>
                  </div>
                  <p className="text-sm font-bold text-blue-700 font-mono">
                    {kpisCalculados ? fmtBRL(kpisCalculados.totalCustoVariavel + kpisCalculados.totalDespesaVariavel) : fmtBRL(totalGeral)}
                  </p>
                </CardContent>
              </Card>
              {/* 4. Total Desp. c/ Despesas Indiretas */}
              <Card className="border-orange-200 bg-orange-50">
                <CardContent className="pt-3 pb-3">
                  <div className="flex items-center gap-1 mb-1">
                    <Building2 className="h-3 w-3 text-orange-600" />
                    <p className="text-[10px] text-muted-foreground font-medium uppercase">Total c/ Desp. Indir.</p>
                  </div>
                  <p className="text-sm font-bold text-orange-700 font-mono">
                    {fmtBRL(kpisCalculados?.totalGeral ?? totalGeral)}
                  </p>
                </CardContent>
              </Card>
              {/* 5. C.M. s/ Despesas Indiretas */}
              <Card className="border-violet-200 bg-violet-50">
                <CardContent className="pt-3 pb-3">
                  <div className="flex items-center gap-1 mb-1">
                    <Calculator className="h-3 w-3 text-violet-600" />
                    <p className="text-[10px] text-muted-foreground font-medium uppercase">C.M. s/ Desp. Indir.</p>
                  </div>
                  <p className="text-sm font-bold text-violet-700 font-mono">
                    {kpisCalculados && (kpisCalculados.producao > 0 || kpisCalculados.vendas > 0) ? `R$ ${fmtTon(kpisCalculados.custoMedio)}` : "—"}
                  </p>
                </CardContent>
              </Card>
              {/* 6. C.M. c/ Desp. Indiretas */}
              <Card className="border-orange-200 bg-orange-50">
                <CardContent className="pt-3 pb-3">
                  <div className="flex items-center gap-1 mb-1">
                    <Building2 className="h-3 w-3 text-orange-600" />
                    <p className="text-[10px] text-muted-foreground font-medium uppercase">C.M. c/ Desp. Indir.</p>
                  </div>
                  <p className="text-sm font-bold text-orange-700 font-mono">
                    {kpisCalculados && (kpisCalculados.producao > 0 || kpisCalculados.vendas > 0) ? `R$ ${fmtTon(kpisCalculados.custoMedioComDI)}` : "—"}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Gráfico de Rosca + Legenda lateral */}
            <Card className="relative">
              {/* Botão de expansão */}
              <DonutChartModal
                title={`Distribuição por Subsetor — ${periodoLabel}`}
                data={dadosGrafico}
                centerLabel="Total Geral"
                centerValue={fmtBRL(totalGeral)}
                formatValue={fmtBRL}
                formatPct={fmtPct}
              />
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <PieChart className="h-4 w-4 text-primary" />
                  Distribuição por Subsetor
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="flex flex-col lg:flex-row items-start gap-4">
                  {/* Gráfico — tamanho fixo e compacto */}
                  <div className="w-full lg:w-[260px] h-[240px] flex-shrink-0 mx-auto lg:mx-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie
                          data={dadosGrafico}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={105}
                          paddingAngle={2}
                          dataKey="value"
                          labelLine={false}
                          label={renderCustomLabel}
                        >
                          {dadosGrafico.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} stroke="white" strokeWidth={2} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                        <text x="50%" y="46%" textAnchor="middle" dominantBaseline="middle" fontSize={10} fill="#6b7280">Total</text>
                        <text x="50%" y="56%" textAnchor="middle" dominantBaseline="middle" fontSize={11} fontWeight={700} fill="#1e293b">{fmtBRL(totalGeral)}</text>
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Legenda detalhada — grade de 2 colunas em telas médias */}
                  <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {dadosGrafico.map((d) => (
                      <div key={d.name} className="flex items-start gap-2 py-1.5 px-2.5 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-0.5" style={{ backgroundColor: d.fill }} />
                        <div className="flex-1 min-w-0">
                          <span className="block text-xs font-medium text-foreground truncate">{d.name}</span>
                          <span className="block text-xs text-muted-foreground">R$ {fmtTon(d.custoTon)}/t</span>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <span className="block text-xs font-bold text-foreground">{fmtPct(d.pct)}</span>
                          <span className="block text-xs text-muted-foreground">{fmtBRL(d.value)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tabela Resumo Consolidada — todos os subsetores juntos */}
            <Card className="border border-slate-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-primary" />
                  Resumo Consolidado por Subsetor
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-muted/50 bg-muted/30">
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">Setor/Processo</th>
                      <th className="text-right px-4 py-2 font-medium text-muted-foreground">Total Custo</th>
                      <th className="text-right px-4 py-2 font-medium text-muted-foreground">Total Geral</th>
                      <th className="text-right px-4 py-2 font-medium text-muted-foreground">R$/t</th>
                      <th className="text-right px-4 py-2 font-medium text-muted-foreground">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {relatorio.grupos.flatMap((grupo) =>
                      grupo.subsetores.map((s: any, idx: number) => {
                        const pct = totalGeral > 0 ? (parseFloat(s.totalGeral ?? "0") / totalGeral) * 100 : 0;
                        const corGrupo = GRUPO_PALETA[grupo.grupoNome] ?? "#94a3b8";
                        return (
                          <tr
                            key={s.id}
                            className={`border-b border-muted/20 hover:bg-muted/30 transition-colors ${
                              idx % 2 === 0 ? "bg-white" : "bg-muted/10"
                            }`}
                          >
                            <td className="px-4 py-2">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: corGrupo }} />
                                <Link
                                  href={`/custo-setor-analitico?subsetor=${encodeURIComponent(s.subsetorNome)}${periodoSelecionado ? '&periodo=' + periodoSelecionado : ''}`}
                                  className="font-medium text-blue-700 hover:text-blue-900 hover:underline flex items-center gap-1 group"
                                  onClick={(e: React.MouseEvent) => e.stopPropagation()}
                                >
                                  {s.subsetorNome}
                                  <span className="opacity-0 group-hover:opacity-100 text-xs text-blue-500 transition-opacity">↗</span>
                                </Link>
                              </div>
                            </td>
                            <td className="px-4 py-2 text-right text-muted-foreground">
                              {fmtBRL(parseFloat(s.totalCusto ?? "0"))}
                            </td>
                            <td className="px-4 py-2 text-right font-bold text-foreground">
                              {fmtBRL(parseFloat(s.totalGeral ?? "0"))}
                            </td>
                            <td className="px-4 py-2 text-right font-medium text-primary">
                              {fmtTon(parseFloat(s.custoTon ?? "0"))}
                            </td>
                            <td className="px-4 py-2 text-right text-muted-foreground">
                              {fmtPct(pct)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="font-bold bg-slate-800 text-white">
                      <td className="px-4 py-2 uppercase tracking-wide">Total dos Desembolsos</td>
                      <td className="px-4 py-2 text-right"></td>
                      <td className="px-4 py-2 text-right">{fmtBRL(totalGeral)}</td>
                      <td className="px-4 py-2 text-right text-green-400">R$ {fmtTon(totalCustoTon)}</td>
                      <td className="px-4 py-2 text-right text-blue-400">100,0%</td>
                    </tr>
                  </tfoot>
                </table>
              </CardContent>
            </Card>

            {/* Tabelas por grupo */}
            {relatorio.grupos.map((grupo) => {
              const cardCor = GRUPO_CORES[grupo.grupoNome] ?? "bg-gray-50 border-gray-200";
              const headerCor = GRUPO_HEADER_CORES[grupo.grupoNome] ?? "bg-gray-100 text-gray-800";
              const pctGrupo = totalGeral > 0 ? (grupo.subtotalGeral / totalGeral) * 100 : 0;
              const corGrupo = GRUPO_PALETA[grupo.grupoNome] ?? "#94a3b8";

              return (
                <Card key={grupo.grupoNome} className={`border ${cardCor}`}>
                  {/* Cabeçalho do grupo */}
                  <div className={`px-4 py-3 rounded-t-lg flex items-center justify-between ${headerCor}`}>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: corGrupo }} />
                      <Link
                        href={`/custo-setor-analitico?grupo=${encodeURIComponent(grupo.grupoNome)}${periodoSelecionado ? `&periodo=${periodoSelecionado}` : ''}`}
                        className="font-semibold text-sm uppercase tracking-wide hover:underline flex items-center gap-1 group"
                        onClick={(e: React.MouseEvent) => e.stopPropagation()}
                      >
                        {grupo.grupoNome}
                        <span className="opacity-0 group-hover:opacity-100 text-xs transition-opacity">↗</span>
                      </Link>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="font-bold">{fmtBRL(grupo.subtotalGeral)}</span>
                      <Badge variant="secondary" className="text-xs">
                        {fmtPct(pctGrupo)}
                      </Badge>
                    </div>
                  </div>

                  {/* Tabela de subsetores — colunas simplificadas para caber sem scroll */}
                  <CardContent className="p-0">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-muted/50 bg-white/60">
                          <th className="text-left px-4 py-2 font-medium text-muted-foreground">Setor/Processo</th>
                          <th className="text-right px-4 py-2 font-medium text-muted-foreground">Total Custo</th>
                          <th className="text-right px-4 py-2 font-medium text-muted-foreground">Total Desp.</th>
                          <th className="text-right px-4 py-2 font-medium text-muted-foreground">Total Geral</th>
                          <th className="text-right px-4 py-2 font-medium text-muted-foreground">R$/t</th>
                          <th className="text-right px-4 py-2 font-medium text-muted-foreground">%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {grupo.subsetores.map((s, idx) => {
                          const pct = totalGeral > 0 ? (parseFloat(s.totalGeral ?? "0") / totalGeral) * 100 : 0;
                          const tDesp = parseFloat(s.totalDespesa ?? "0");
                          return (
                            <tr
                              key={s.id}
                              className={`border-b border-muted/30 hover:bg-white/80 transition-colors ${
                                idx % 2 === 0 ? "bg-white/40" : "bg-white/20"
                              }`}
                            >
                              <td className="px-4 py-2 font-medium">
                                <Link
                                href={`/custo-setor-analitico?subsetor=${encodeURIComponent(s.subsetorNome)}${periodoSelecionado ? '&periodo=' + periodoSelecionado : ''}`}
                                  className="text-blue-700 hover:text-blue-900 hover:underline font-medium flex items-center gap-1 group"
                                  onClick={(e: React.MouseEvent) => e.stopPropagation()}
                                >
                                  {s.subsetorNome}
                                  <span className="opacity-0 group-hover:opacity-100 text-xs text-blue-500 transition-opacity">↗</span>
                                </Link>
                              </td>
                              <td className="px-4 py-2 text-right text-muted-foreground">
                                {fmtBRL(parseFloat(s.totalCusto ?? "0"))}
                              </td>
                              <td className="px-4 py-2 text-right text-muted-foreground">
                                {tDesp > 0 ? fmtBRL(tDesp) : <span className="text-muted-foreground/40">—</span>}
                              </td>
                              <td className="px-4 py-2 text-right font-bold text-foreground">
                                {fmtBRL(parseFloat(s.totalGeral ?? "0"))}
                              </td>
                              <td className="px-4 py-2 text-right font-medium text-primary">
                                {fmtTon(parseFloat(s.custoTon ?? "0"))}
                              </td>
                              <td className="px-4 py-2 text-right text-muted-foreground">
                                {fmtPct(pct)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className={`font-semibold ${headerCor}`}>
                          <td className="px-4 py-2">Subtotal {grupo.grupoNome}</td>
                          <td className="px-4 py-2 text-right">{fmtBRL(grupo.subtotalCusto)}</td>
                          <td className="px-4 py-2 text-right">{grupo.subtotalDespesa > 0 ? fmtBRL(grupo.subtotalDespesa) : <span className="opacity-40">—</span>}</td>
                          <td className="px-4 py-2 text-right">{fmtBRL(grupo.subtotalGeral)}</td>
                          <td className="px-4 py-2 text-right">{fmtTon(grupo.subtotalCustoTon)}</td>
                          <td className="px-4 py-2 text-right">{fmtPct(pctGrupo)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </CardContent>
                </Card>
              );
            })}

            {/* Total Geral */}
            <Card className="bg-slate-800 border-slate-700 text-white">
              <CardContent className="py-4">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <span className="font-bold text-lg uppercase tracking-wide">Total dos Desembolsos</span>
                  <div className="flex items-center gap-8">
                    <div className="text-right">
                      <p className="text-xs text-slate-400 uppercase">Total Geral</p>
                      <p className="text-xl font-bold text-white">{fmtBRL(totalGeral)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-400 uppercase">Custo/t</p>
                      <p className="text-xl font-bold text-green-400">R$ {fmtTon(totalCustoTon)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-400 uppercase">% Total</p>
                      <p className="text-xl font-bold text-blue-400">100,0%</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
