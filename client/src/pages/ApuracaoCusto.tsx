import { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { BarChart3, Lock, Info, Factory, TrendingUp, Calculator, Building2, PieChart } from "lucide-react";
import { DashboardExportMenu } from "@/components/DashboardExportMenu";
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function fmt(val: number) {
  return val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct(val: number) {
  return val.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";
}

// Paleta de cores para os gráficos
const COLORS_CONTAS = [
  "#2563eb", "#16a34a", "#9333ea", "#ea580c", "#0891b2", "#dc2626",
  "#ca8a04", "#db2777", "#059669", "#7c3aed", "#0284c7", "#65a30d",
  "#c2410c", "#a21caf", "#0d9488", "#b45309",
];

const COLORS_CUSTO_MEDIO = ["#2563eb", "#9333ea", "#ea580c"];

// Tooltip customizado para gráficos de rosca
function CustomTooltip({ active, payload, label: _label }: any) {
  if (active && payload && payload.length) {
    const d = payload[0].payload;
    return (
      <div className="bg-white border border-border rounded-lg shadow-lg p-3 text-xs">
        <p className="font-semibold text-foreground mb-1">{d.name}</p>
        <p className="text-muted-foreground">Valor: <span className="font-mono font-medium text-foreground">R$ {fmt(d.value)}</span></p>
        <p className="text-muted-foreground">Participação: <span className="font-medium text-foreground">{fmtPct(d.pct)}</span></p>
        {d.custoPorTon !== undefined && (
          <p className="text-muted-foreground">Custo/t: <span className="font-mono font-medium text-foreground">R$ {fmt(d.custoPorTon)}</span></p>
        )}
      </div>
    );
  }
  return null;
}

// Label nas fatias
function renderCustomLabel({ cx, cy, midAngle, innerRadius, outerRadius, pct }: any) {
  if (pct < 5) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.6;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight="600">
      {fmtPct(pct)}
    </text>
  );
}

export default function ApuracaoCusto() {
  const [selectedPeriodoId, setSelectedPeriodoId] = useState<number | null>(null);

  const { data: periodos } = trpc.periodoCusto.list.useQuery();
  const { data: lancamentos } = trpc.lancamentoCusto.listByPeriodo.useQuery(
    { periodoCustoId: selectedPeriodoId! },
    { enabled: !!selectedPeriodoId }
  );
  const { data: destinatariosWpp } = trpc.destinatariosWhatsapp.list.useQuery();

  const periodoAtual = useMemo(
    () => periodos?.find((p) => p.id === selectedPeriodoId) ?? null,
    [periodos, selectedPeriodoId]
  );

  const { data: producaoModulo } = trpc.periodoCusto.getProducaoDoModulo.useQuery(
    { mes: periodoAtual?.mes ?? 1, ano: periodoAtual?.ano ?? 2026 },
    { enabled: !!periodoAtual }
  );

  useEffect(() => {
    if (periodos && periodos.length > 0 && !selectedPeriodoId) {
      setSelectedPeriodoId(periodos[0].id);
    }
  }, [periodos, selectedPeriodoId]);

  const relatorio = useMemo(() => {
    if (!lancamentos || !periodoAtual) return null;

    const producao = producaoModulo?.total ?? parseFloat(periodoAtual.producaoTotal ?? "0") ?? 0;
    const vendas = parseFloat(periodoAtual.quantidadeVendida ?? "0") || 0;

    type ContaItem = {
      id: number;
      nome: string;
      valor: number;
      custoPorTon: number;
      percentualGrupo: number;
      percentualTotal: number;
    };

    const custoVariavel: ContaItem[] = [];
    const despesaVariavel: ContaItem[] = [];
    const despesasIndiretas: ContaItem[] = [];
    let totalCustoVariavel = 0;
    let totalDespesaVariavel = 0;
    let totalDespesasIndiretas = 0;
    let totalGeral = 0;

    for (const l of lancamentos) {
      const valor = parseFloat(String(l.valor || "0"));
      if (valor === 0) continue;
      const divisor = l.contaDivisor ?? "producao";
      const classificacao = l.contaClassificacao ?? "custo_variavel";
      const item: ContaItem = {
        id: l.contaCustoId,
        nome: l.contaNome ?? "—",
        valor,
        custoPorTon: 0,
        percentualGrupo: 0,
        percentualTotal: 0,
      };
      if (classificacao === "despesa_variavel" && divisor === "producao") {
        despesasIndiretas.push(item);
        totalDespesasIndiretas += valor;
      } else if (divisor === "vendas") {
        despesaVariavel.push(item);
        totalDespesaVariavel += valor;
      } else {
        custoVariavel.push(item);
        totalCustoVariavel += valor;
      }
      totalGeral += valor;
    }

    for (const c of custoVariavel) {
      c.custoPorTon = producao > 0 ? c.valor / producao : 0;
      c.percentualGrupo = totalCustoVariavel > 0 ? (c.valor / totalCustoVariavel) * 100 : 0;
      c.percentualTotal = totalGeral > 0 ? (c.valor / totalGeral) * 100 : 0;
    }
    for (const c of despesaVariavel) {
      c.custoPorTon = vendas > 0 ? c.valor / vendas : 0;
      c.percentualGrupo = totalDespesaVariavel > 0 ? (c.valor / totalDespesaVariavel) * 100 : 0;
      c.percentualTotal = totalGeral > 0 ? (c.valor / totalGeral) * 100 : 0;
    }
    for (const c of despesasIndiretas) {
      c.custoPorTon = producao > 0 ? c.valor / producao : 0;
      c.percentualGrupo = totalDespesasIndiretas > 0 ? (c.valor / totalDespesasIndiretas) * 100 : 0;
      c.percentualTotal = totalGeral > 0 ? (c.valor / totalGeral) * 100 : 0;
    }

    const custoPorTonProducao = producao > 0 ? totalCustoVariavel / producao : 0;
    const custoPorTonVendas = vendas > 0 ? totalDespesaVariavel / vendas : 0;
    const custoPorTonDespesasIndiretas = producao > 0 ? totalDespesasIndiretas / producao : 0;
    const custoMedio = custoPorTonProducao + custoPorTonVendas;
    const custoMedioComDI = custoMedio + custoPorTonDespesasIndiretas;

    return {
      custoVariavel,
      despesaVariavel,
      despesasIndiretas,
      totalCustoVariavel,
      totalDespesaVariavel,
      totalDespesasIndiretas,
      totalGeral,
      producao,
      vendas,
      custoPorTonProducao,
      custoPorTonVendas,
      custoPorTonDespesasIndiretas,
      custoMedio,
      custoMedioComDI,
    };
  }, [lancamentos, periodoAtual, producaoModulo]);

  // ── Dados para gráficos ──────────────────────────────────────────────────────

  // Gráfico 1: Distribuição por Plano de Contas (todas as contas juntas)
  const dadosPlanoContas = useMemo(() => {
    if (!relatorio) return [];
    const todasContas = [
      ...relatorio.custoVariavel,
      ...relatorio.despesaVariavel,
      ...relatorio.despesasIndiretas,
    ];
    return todasContas.map(c => ({
      name: c.nome,
      value: c.valor,
      pct: relatorio.totalGeral > 0 ? (c.valor / relatorio.totalGeral) * 100 : 0,
      custoPorTon: c.custoPorTon,
    }));
  }, [relatorio]);

  // Gráfico 2: Custo Médio — composição Custo Variável vs Despesa Variável
  const dadosCustoMedio = useMemo(() => {
    if (!relatorio) return [];
    const items = [];
    if (relatorio.totalCustoVariavel > 0) {
      items.push({
        name: "Custo Variável (÷ Produção)",
        value: relatorio.custoPorTonProducao,
        pct: relatorio.custoMedio > 0 ? (relatorio.custoPorTonProducao / relatorio.custoMedio) * 100 : 0,
        custoPorTon: relatorio.custoPorTonProducao,
      });
    }
    if (relatorio.totalDespesaVariavel > 0) {
      items.push({
        name: "Despesa Variável (÷ Vendas)",
        value: relatorio.custoPorTonVendas,
        pct: relatorio.custoMedio > 0 ? (relatorio.custoPorTonVendas / relatorio.custoMedio) * 100 : 0,
        custoPorTon: relatorio.custoPorTonVendas,
      });
    }
    return items;
  }, [relatorio]);

  // Gráfico 3: Custo Médio com Despesas Indiretas — composição dos três grupos
  const dadosCustoMedioComDI = useMemo(() => {
    if (!relatorio) return [];
    const items = [];
    if (relatorio.totalCustoVariavel > 0) {
      items.push({
        name: "Custo Variável (÷ Produção)",
        value: relatorio.custoPorTonProducao,
        pct: relatorio.custoMedioComDI > 0 ? (relatorio.custoPorTonProducao / relatorio.custoMedioComDI) * 100 : 0,
        custoPorTon: relatorio.custoPorTonProducao,
      });
    }
    if (relatorio.totalDespesaVariavel > 0) {
      items.push({
        name: "Despesa Variável (÷ Vendas)",
        value: relatorio.custoPorTonVendas,
        pct: relatorio.custoMedioComDI > 0 ? (relatorio.custoPorTonVendas / relatorio.custoMedioComDI) * 100 : 0,
        custoPorTon: relatorio.custoPorTonVendas,
      });
    }
    if (relatorio.totalDespesasIndiretas > 0) {
      items.push({
        name: "Despesas Indiretas (÷ Produção)",
        value: relatorio.custoPorTonDespesasIndiretas,
        pct: relatorio.custoMedioComDI > 0 ? (relatorio.custoPorTonDespesasIndiretas / relatorio.custoMedioComDI) * 100 : 0,
        custoPorTon: relatorio.custoPorTonDespesasIndiretas,
      });
    }
    return items;
  }, [relatorio]);

  // ── Dados para exportação ────────────────────────────────────────────────────
  const periodoLabel = periodoAtual
    ? `${MESES[(periodoAtual.mes ?? 1) - 1]}/${periodoAtual.ano}`
    : "";

  const exportOptions = useMemo(() => {
    if (!relatorio || !periodoAtual) return null;
    const rows: Record<string, any>[] = [];

    for (const c of relatorio.custoVariavel) {
      rows.push({
        grupo: "Custo Variável",
        conta: c.nome,
        divisor: "Produção",
        valor: fmt(c.valor),
        custoPorTon: c.custoPorTon > 0 ? fmt(c.custoPorTon) : "",
        percentual: fmtPct(c.percentualGrupo),
      });
    }
    rows.push({
      grupo: "SUBTOTAL Custo Variável",
      conta: "",
      divisor: "",
      valor: fmt(relatorio.totalCustoVariavel),
      custoPorTon: relatorio.producao > 0 ? fmt(relatorio.custoPorTonProducao) : "",
      percentual: fmtPct(relatorio.totalGeral > 0 ? (relatorio.totalCustoVariavel / relatorio.totalGeral) * 100 : 0),
    });

    for (const c of relatorio.despesaVariavel) {
      rows.push({
        grupo: "Despesa Variável",
        conta: c.nome,
        divisor: "Vendas",
        valor: fmt(c.valor),
        custoPorTon: c.custoPorTon > 0 ? fmt(c.custoPorTon) : "",
        percentual: fmtPct(c.percentualGrupo),
      });
    }
    rows.push({
      grupo: "SUBTOTAL Despesa Variável",
      conta: "",
      divisor: "",
      valor: fmt(relatorio.totalDespesaVariavel),
      custoPorTon: relatorio.vendas > 0 ? fmt(relatorio.custoPorTonVendas) : "",
      percentual: fmtPct(relatorio.totalGeral > 0 ? (relatorio.totalDespesaVariavel / relatorio.totalGeral) * 100 : 0),
    });

    if (relatorio.despesasIndiretas.length > 0) {
      for (const c of relatorio.despesasIndiretas) {
        rows.push({
          grupo: "Despesas Indiretas",
          conta: c.nome,
          divisor: "Produção",
          valor: fmt(c.valor),
          custoPorTon: c.custoPorTon > 0 ? fmt(c.custoPorTon) : "",
          percentual: fmtPct(c.percentualGrupo),
        });
      }
      rows.push({
        grupo: "SUBTOTAL Despesas Indiretas",
        conta: "",
        divisor: "",
        valor: fmt(relatorio.totalDespesasIndiretas),
        custoPorTon: relatorio.producao > 0 ? fmt(relatorio.custoPorTonDespesasIndiretas) : "",
        percentual: fmtPct(relatorio.totalGeral > 0 ? (relatorio.totalDespesasIndiretas / relatorio.totalGeral) * 100 : 0),
      });
    }

    rows.push({
      grupo: "TOTAL GERAL",
      conta: "",
      divisor: "",
      valor: fmt(relatorio.totalGeral),
      custoPorTon: "",
      percentual: "100,0%",
    });
    rows.push({
      grupo: "CUSTO MÉDIO",
      conta: "",
      divisor: "",
      valor: "",
      custoPorTon: fmt(relatorio.custoMedio),
      percentual: "",
    });
    rows.push({
      grupo: "C.M. c/ Despesas Indiretas",
      conta: "",
      divisor: "",
      valor: "",
      custoPorTon: fmt(relatorio.custoMedioComDI),
      percentual: "",
    });

    return {
      columns: [
        { key: "grupo", header: "Grupo", width: 28 },
        { key: "conta", header: "Conta de Custo", width: 35 },
        { key: "divisor", header: "Divisor", width: 12 },
        { key: "valor", header: "Valor (R$)", width: 18 },
        { key: "custoPorTon", header: "Custo/t (R$)", width: 18 },
        { key: "percentual", header: "% do Grupo", width: 14 },
      ],
      data: rows,
    };
  }, [relatorio, periodoAtual]);

  // Mensagem WhatsApp
  const whatsappMessage = useMemo(() => {
    if (!relatorio || !periodoAtual) return undefined;
    let msg = `📊 *Apuração de Custo — ${periodoLabel}*\n`;
    msg += `Produção: ${relatorio.producao > 0 ? fmt(relatorio.producao) + " t" : "—"} | Vendas: ${relatorio.vendas > 0 ? fmt(relatorio.vendas) + " t" : "—"}\n\n`;
    msg += `💰 *Custo Total:* R$ ${fmt(relatorio.totalGeral)}\n`;
    msg += `  • Custo Variável: R$ ${fmt(relatorio.totalCustoVariavel)} (${fmtPct(relatorio.totalGeral > 0 ? (relatorio.totalCustoVariavel / relatorio.totalGeral) * 100 : 0)})\n`;
    msg += `  • Despesa Variável: R$ ${fmt(relatorio.totalDespesaVariavel)} (${fmtPct(relatorio.totalGeral > 0 ? (relatorio.totalDespesaVariavel / relatorio.totalGeral) * 100 : 0)})\n`;
    if (relatorio.totalDespesasIndiretas > 0) {
      msg += `  • Despesas Indiretas: R$ ${fmt(relatorio.totalDespesasIndiretas)} (${fmtPct(relatorio.totalGeral > 0 ? (relatorio.totalDespesasIndiretas / relatorio.totalGeral) * 100 : 0)})\n`;
    }
    msg += `\n📈 *Custo Médio:* R$ ${fmt(relatorio.custoMedio)}/t`;
    if (relatorio.totalDespesasIndiretas > 0) {
      msg += `\n📈 *C.M. c/ Desp. Indiretas:* R$ ${fmt(relatorio.custoMedioComDI)}/t`;
    }
    return msg;
  }, [relatorio, periodoAtual, periodoLabel]);

  const destinatariosAtivos = useMemo(
    () => (destinatariosWpp || []).filter(d => d.ativo === "sim").map(d => d.telefone),
    [destinatariosWpp]
  );

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <PieChart className="h-8 w-8 text-primary" />
            Apuração de Custo
          </h1>
          <p className="text-muted-foreground mt-1">
            Relatório de custo por tonelada por classificação e período
          </p>
        </div>
        {exportOptions && periodoAtual && (
          <DashboardExportMenu
            title={`Apuração de Custo — ${periodoLabel}`}
            subtitle={`Produção: ${relatorio?.producao ? fmt(relatorio.producao) + " t" : "—"} | Vendas: ${relatorio?.vendas ? fmt(relatorio.vendas) + " t" : "—"}`}
            filename={`apuracao-custo-${periodoAtual.mes}-${periodoAtual.ano}`}
            exportOptions={exportOptions}
            whatsappMessage={whatsappMessage}
            whatsappDestinatarios={destinatariosAtivos}
          />
        )}
      </div>

      {/* Seletor de Período */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Selecionar Período</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="w-64">
              <Select
                value={selectedPeriodoId ? String(selectedPeriodoId) : ""}
                onValueChange={(v) => setSelectedPeriodoId(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um período..." />
                </SelectTrigger>
                <SelectContent>
                  {periodos?.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {MESES[p.mes - 1]}/{p.ano}
                      {p.fechado === "sim" ? " 🔒" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {periodoAtual && (
              <div className="flex items-center gap-3 flex-wrap">
                <Badge variant={periodoAtual.fechado === "sim" ? "secondary" : "default"}>
                  {periodoAtual.fechado === "sim" ? <><Lock className="h-3 w-3 mr-1" />Fechado</> : "Aberto"}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  Vendas: <strong>{periodoAtual.quantidadeVendida ? fmt(parseFloat(periodoAtual.quantidadeVendida)) : "—"} t</strong>
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* KPIs Principais */}
      {relatorio && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Custo Total</p>
                <p className="text-2xl font-bold text-primary font-mono">
                  R$ {fmt(relatorio.totalGeral)}
                </p>
              </CardContent>
            </Card>

            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="pt-4">
                <div className="flex items-center gap-1 mb-1">
                  <Factory className="h-3 w-3 text-blue-600" />
                  <p className="text-xs text-muted-foreground">Custo/t (Produção)</p>
                </div>
                <p className="text-2xl font-bold text-blue-700 font-mono">
                  {relatorio.producao > 0 ? `R$ ${fmt(relatorio.custoPorTonProducao)}` : "—"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Base: {relatorio.producao > 0 ? `${fmt(relatorio.producao)} t` : "sem produção"}
                </p>
              </CardContent>
            </Card>

            <Card className="border-green-200 bg-green-50">
              <CardContent className="pt-4">
                <div className="flex items-center gap-1 mb-1">
                  <TrendingUp className="h-3 w-3 text-green-600" />
                  <p className="text-xs text-muted-foreground">Custo/t (Vendas)</p>
                </div>
                <p className="text-2xl font-bold text-green-700 font-mono">
                  {relatorio.vendas > 0 ? `R$ ${fmt(relatorio.custoPorTonVendas)}` : "—"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Base: {relatorio.vendas > 0 ? `${fmt(relatorio.vendas)} t` : "sem vendas"}
                </p>
              </CardContent>
            </Card>

            <Card className="border-violet-200 bg-violet-50">
              <CardContent className="pt-4">
                <div className="flex items-center gap-1 mb-1">
                  <Calculator className="h-3 w-3 text-violet-600" />
                  <p className="text-xs text-muted-foreground">Custo Médio</p>
                </div>
                <p className="text-2xl font-bold text-violet-700 font-mono">
                  {(relatorio.producao > 0 || relatorio.vendas > 0) ? `R$ ${fmt(relatorio.custoMedio)}` : "—"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Custo/t Prod. + Custo/t Vendas
                </p>
              </CardContent>
            </Card>

            <Card className="border-orange-200 bg-orange-50">
              <CardContent className="pt-4">
                <div className="flex items-center gap-1 mb-1">
                  <Building2 className="h-3 w-3 text-orange-600" />
                  <p className="text-xs text-muted-foreground">C.M. c/ Desp. Indiretas</p>
                </div>
                <p className="text-2xl font-bold text-orange-700 font-mono">
                  {(relatorio.producao > 0 || relatorio.vendas > 0) ? `R$ ${fmt(relatorio.custoMedioComDI)}` : "—"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Custo Médio + Desp. Indiretas
                </p>
              </CardContent>
            </Card>
          </div>

          {/* ── Gráficos de Rosca ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Gráfico 1: Distribuição por Plano de Contas */}
            {dadosPlanoContas.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-foreground">
                    Distribuição por Plano de Contas
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">Participação de cada conta no custo total</p>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="relative h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie
                          data={dadosPlanoContas}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={85}
                          paddingAngle={2}
                          dataKey="value"
                          labelLine={false}
                          label={renderCustomLabel}
                        >
                          {dadosPlanoContas.map((_, idx) => (
                            <Cell key={idx} fill={COLORS_CONTAS[idx % COLORS_CONTAS.length]} />
                          ))}
                        </Pie>
                        <text
                          x="50%" y="46%" textAnchor="middle" dominantBaseline="middle"
                          className="fill-muted-foreground" fontSize={10}
                        >
                          Total
                        </text>
                        <text
                          x="50%" y="58%" textAnchor="middle" dominantBaseline="middle"
                          className="fill-foreground" fontSize={12} fontWeight="700"
                        >
                          R$ {fmt(relatorio.totalGeral)}
                        </text>
                        <Tooltip content={<CustomTooltip />} />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </div>
                  {/* Legenda */}
                  <div className="mt-2 space-y-1 max-h-40 overflow-y-auto pr-1">
                    {dadosPlanoContas.map((d, idx) => (
                      <div key={idx} className="flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className="h-2.5 w-2.5 rounded-full shrink-0"
                            style={{ background: COLORS_CONTAS[idx % COLORS_CONTAS.length] }}
                          />
                          <span className="truncate text-muted-foreground">{d.name}</span>
                        </div>
                        <span className="font-mono font-medium shrink-0">{fmtPct(d.pct)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Gráfico 2: Custo Médio */}
            {dadosCustoMedio.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-violet-700">
                    Custo Médio (R$/t)
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">Composição do custo médio por tonelada</p>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="relative h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie
                          data={dadosCustoMedio}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={85}
                          paddingAngle={2}
                          dataKey="value"
                          labelLine={false}
                          label={renderCustomLabel}
                        >
                          {dadosCustoMedio.map((_, idx) => (
                            <Cell key={idx} fill={COLORS_CUSTO_MEDIO[idx % COLORS_CUSTO_MEDIO.length]} />
                          ))}
                        </Pie>
                        <text
                          x="50%" y="43%" textAnchor="middle" dominantBaseline="middle"
                          className="fill-muted-foreground" fontSize={10}
                        >
                          Custo Médio
                        </text>
                        <text
                          x="50%" y="54%" textAnchor="middle" dominantBaseline="middle"
                          className="fill-violet-700" fontSize={13} fontWeight="700"
                        >
                          R$ {fmt(relatorio.custoMedio)}
                        </text>
                        <text
                          x="50%" y="65%" textAnchor="middle" dominantBaseline="middle"
                          className="fill-muted-foreground" fontSize={9}
                        >
                          por tonelada
                        </text>
                        <Tooltip content={<CustomTooltip />} />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-2 space-y-1">
                    {dadosCustoMedio.map((d, idx) => (
                      <div key={idx} className="flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className="h-2.5 w-2.5 rounded-full shrink-0"
                            style={{ background: COLORS_CUSTO_MEDIO[idx % COLORS_CUSTO_MEDIO.length] }}
                          />
                          <span className="truncate text-muted-foreground">{d.name}</span>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <span className="font-mono text-muted-foreground">{fmtPct(d.pct)}</span>
                          <span className="font-mono font-medium">R$ {fmt(d.value)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Gráfico 3: Custo Médio com Despesas Indiretas */}
            {dadosCustoMedioComDI.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-orange-700">
                    C.M. c/ Despesas Indiretas (R$/t)
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">Composição incluindo despesas indiretas</p>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="relative h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie
                          data={dadosCustoMedioComDI}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={85}
                          paddingAngle={2}
                          dataKey="value"
                          labelLine={false}
                          label={renderCustomLabel}
                        >
                          {dadosCustoMedioComDI.map((_, idx) => (
                            <Cell key={idx} fill={COLORS_CUSTO_MEDIO[idx % COLORS_CUSTO_MEDIO.length]} />
                          ))}
                        </Pie>
                        <text
                          x="50%" y="40%" textAnchor="middle" dominantBaseline="middle"
                          className="fill-muted-foreground" fontSize={9}
                        >
                          C.M. c/ D.I.
                        </text>
                        <text
                          x="50%" y="52%" textAnchor="middle" dominantBaseline="middle"
                          className="fill-orange-700" fontSize={13} fontWeight="700"
                        >
                          R$ {fmt(relatorio.custoMedioComDI)}
                        </text>
                        <text
                          x="50%" y="63%" textAnchor="middle" dominantBaseline="middle"
                          className="fill-muted-foreground" fontSize={9}
                        >
                          por tonelada
                        </text>
                        <Tooltip content={<CustomTooltip />} />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-2 space-y-1">
                    {dadosCustoMedioComDI.map((d, idx) => (
                      <div key={idx} className="flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className="h-2.5 w-2.5 rounded-full shrink-0"
                            style={{ background: COLORS_CUSTO_MEDIO[idx % COLORS_CUSTO_MEDIO.length] }}
                          />
                          <span className="truncate text-muted-foreground">{d.name}</span>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <span className="font-mono text-muted-foreground">{fmtPct(d.pct)}</span>
                          <span className="font-mono font-medium">R$ {fmt(d.value)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* ── Tabelas de Apuração ───────────────────────────────────────────── */}
          <div className="space-y-4">

            {/* Grupo 1: Custo Variável (÷ Produção) */}
            {relatorio.custoVariavel.length > 0 && (
              <Card>
                <CardHeader className="pb-2 rounded-t-lg bg-green-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Factory className="h-4 w-4 text-green-700" />
                      <CardTitle className="text-base text-green-700">Custo Variável</CardTitle>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-green-700">
                        {fmtPct(relatorio.totalGeral > 0 ? (relatorio.totalCustoVariavel / relatorio.totalGeral) * 100 : 0)} do total
                      </span>
                      <span className="font-bold text-base font-mono text-green-700">
                        R$ {fmt(relatorio.totalCustoVariavel)}
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Conta de Custo</TableHead>
                        <TableHead className="text-right w-36">Valor (R$)</TableHead>
                        <TableHead className="text-right w-36">Custo/t Prod. (R$)</TableHead>
                        <TableHead className="text-right w-24">% do Grupo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {relatorio.custoVariavel.map((conta) => (
                        <TableRow key={conta.id}>
                          <TableCell>{conta.nome}</TableCell>
                          <TableCell className="text-right font-mono">{fmt(conta.valor)}</TableCell>
                          <TableCell className="text-right font-mono">
                            {conta.custoPorTon > 0 ? fmt(conta.custoPorTon) : "—"}
                          </TableCell>
                          <TableCell className="text-right font-mono text-muted-foreground">
                            {fmtPct(conta.percentualGrupo)}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="font-semibold bg-green-50">
                        <TableCell>Subtotal Custo Variável</TableCell>
                        <TableCell className="text-right font-mono">{fmt(relatorio.totalCustoVariavel)}</TableCell>
                        <TableCell className="text-right font-mono text-green-700">
                          {relatorio.producao > 0 ? fmt(relatorio.custoPorTonProducao) : "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono">100,0%</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Grupo 2: Despesa Variável (÷ Vendas) */}
            {relatorio.despesaVariavel.length > 0 && (
              <Card>
                <CardHeader className="pb-2 rounded-t-lg bg-purple-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-purple-700" />
                      <CardTitle className="text-base text-purple-700">Despesa Variável</CardTitle>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-purple-700">
                        {fmtPct(relatorio.totalGeral > 0 ? (relatorio.totalDespesaVariavel / relatorio.totalGeral) * 100 : 0)} do total
                      </span>
                      <span className="font-bold text-base font-mono text-purple-700">
                        R$ {fmt(relatorio.totalDespesaVariavel)}
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Conta de Custo</TableHead>
                        <TableHead className="text-right w-36">Valor (R$)</TableHead>
                        <TableHead className="text-right w-36">Custo/t Vendas (R$)</TableHead>
                        <TableHead className="text-right w-24">% do Grupo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {relatorio.despesaVariavel.map((conta) => (
                        <TableRow key={conta.id}>
                          <TableCell>{conta.nome}</TableCell>
                          <TableCell className="text-right font-mono">{fmt(conta.valor)}</TableCell>
                          <TableCell className="text-right font-mono">
                            {conta.custoPorTon > 0 ? fmt(conta.custoPorTon) : "—"}
                          </TableCell>
                          <TableCell className="text-right font-mono text-muted-foreground">
                            {fmtPct(conta.percentualGrupo)}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="font-semibold bg-purple-50">
                        <TableCell>Subtotal Despesa Variável</TableCell>
                        <TableCell className="text-right font-mono">{fmt(relatorio.totalDespesaVariavel)}</TableCell>
                        <TableCell className="text-right font-mono text-purple-700">
                          {relatorio.vendas > 0 ? fmt(relatorio.custoPorTonVendas) : "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono">100,0%</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Grupo 3: Despesas Indiretas (÷ Produção) */}
            {relatorio.despesasIndiretas.length > 0 && (
              <Card>
                <CardHeader className="pb-2 rounded-t-lg bg-orange-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-orange-700" />
                      <CardTitle className="text-base text-orange-700">Despesas Indiretas</CardTitle>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-orange-700">
                        {fmtPct(relatorio.totalGeral > 0 ? (relatorio.totalDespesasIndiretas / relatorio.totalGeral) * 100 : 0)} do total
                      </span>
                      <span className="font-bold text-base font-mono text-orange-700">
                        R$ {fmt(relatorio.totalDespesasIndiretas)}
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Conta de Custo</TableHead>
                        <TableHead className="text-right w-36">Valor (R$)</TableHead>
                        <TableHead className="text-right w-36">Custo/t Prod. (R$)</TableHead>
                        <TableHead className="text-right w-24">% do Grupo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {relatorio.despesasIndiretas.map((conta) => (
                        <TableRow key={conta.id}>
                          <TableCell>{conta.nome}</TableCell>
                          <TableCell className="text-right font-mono">{fmt(conta.valor)}</TableCell>
                          <TableCell className="text-right font-mono">
                            {conta.custoPorTon > 0 ? fmt(conta.custoPorTon) : "—"}
                          </TableCell>
                          <TableCell className="text-right font-mono text-muted-foreground">
                            {fmtPct(conta.percentualGrupo)}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="font-semibold bg-orange-50">
                        <TableCell>Subtotal Despesas Indiretas</TableCell>
                        <TableCell className="text-right font-mono">{fmt(relatorio.totalDespesasIndiretas)}</TableCell>
                        <TableCell className="text-right font-mono text-orange-700">
                          {relatorio.producao > 0 ? fmt(relatorio.custoPorTonDespesasIndiretas) : "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono">100,0%</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Resumo Final — Custo Médio */}
            <Card className="border-2 border-violet-300 bg-violet-50">
              <CardContent className="pt-4">
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-green-700">Custo Variável (÷ Produção)</span>
                    <div className="flex gap-6">
                      <span className="font-mono text-muted-foreground w-28 text-right">
                        {fmtPct(relatorio.totalGeral > 0 ? (relatorio.totalCustoVariavel / relatorio.totalGeral) * 100 : 0)}
                      </span>
                      <span className="font-mono font-medium w-32 text-right">
                        R$ {fmt(relatorio.totalCustoVariavel)}
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-purple-700">Despesa Variável (÷ Vendas)</span>
                    <div className="flex gap-6">
                      <span className="font-mono text-muted-foreground w-28 text-right">
                        {fmtPct(relatorio.totalGeral > 0 ? (relatorio.totalDespesaVariavel / relatorio.totalGeral) * 100 : 0)}
                      </span>
                      <span className="font-mono font-medium w-32 text-right">
                        R$ {fmt(relatorio.totalDespesaVariavel)}
                      </span>
                    </div>
                  </div>
                  {relatorio.despesasIndiretas.length > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-orange-700">Despesas Indiretas (÷ Produção)</span>
                      <div className="flex gap-6">
                        <span className="font-mono text-muted-foreground w-28 text-right">
                          {fmtPct(relatorio.totalGeral > 0 ? (relatorio.totalDespesasIndiretas / relatorio.totalGeral) * 100 : 0)}
                        </span>
                        <span className="font-mono font-medium w-32 text-right">
                          R$ {fmt(relatorio.totalDespesasIndiretas)}
                        </span>
                      </div>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total Geral</span>
                    <span className="font-mono text-primary">R$ {fmt(relatorio.totalGeral)}</span>
                  </div>

                  <div className="mt-4 pt-3 border-t grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="text-center p-3 bg-blue-50 rounded-md border border-blue-200">
                      <p className="text-xs text-muted-foreground">Custo/t (Produção)</p>
                      <p className="font-bold text-blue-700 font-mono text-xl">
                        {relatorio.producao > 0 ? `R$ ${fmt(relatorio.custoPorTonProducao)}` : "—"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Base: {relatorio.producao > 0 ? `${fmt(relatorio.producao)} t` : "—"}
                      </p>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-md border border-green-200">
                      <p className="text-xs text-muted-foreground">Custo/t (Vendas)</p>
                      <p className="font-bold text-green-700 font-mono text-xl">
                        {relatorio.vendas > 0 ? `R$ ${fmt(relatorio.custoPorTonVendas)}` : "—"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Base: {relatorio.vendas > 0 ? `${fmt(relatorio.vendas)} t` : "—"}
                      </p>
                    </div>
                    <div className="text-center p-3 bg-violet-100 rounded-md border-2 border-violet-300">
                      <p className="text-xs font-semibold text-violet-700">Custo Médio</p>
                      <p className="font-bold text-violet-700 font-mono text-2xl">
                        {(relatorio.producao > 0 || relatorio.vendas > 0) ? `R$ ${fmt(relatorio.custoMedio)}` : "—"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Prod. + Vendas</p>
                    </div>
                    <div className="text-center p-3 bg-orange-100 rounded-md border-2 border-orange-300">
                      <p className="text-xs font-semibold text-orange-700">C.M. c/ Desp. Indiretas</p>
                      <p className="font-bold text-orange-700 font-mono text-2xl">
                        {(relatorio.producao > 0 || relatorio.vendas > 0) ? `R$ ${fmt(relatorio.custoMedioComDI)}` : "—"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Custo Médio + DI</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {selectedPeriodoId && lancamentos?.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Info className="h-8 w-8 mx-auto mb-3 opacity-40" />
            Nenhum lançamento encontrado para este período. Acesse{" "}
            <strong>Lançamento de Custos</strong> para registrar os valores.
          </CardContent>
        </Card>
      )}

      {!selectedPeriodoId && periodos?.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum período de custo cadastrado. Acesse <strong>Cadastros → Períodos de Custo</strong> para criar um período.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
