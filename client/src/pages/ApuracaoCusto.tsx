import { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";

// Mapeamento: nome da conta → campo do equipamento no Relatório Analítico
const CONTA_NOME_PARA_CAMPO: Record<string, string> = {
  "Combustível": "combustivel",
  "Lubrificantes": "lubrificantes",
  "Peças de Desgaste": "pecasDesgaste",
  "Peças de Reposição / Itens de Consumo": "pecasReposicao",
  "Outras Despesas dos Equipamentos": "outrasDespesas",
  "RH - Salários da Operação": "salOperEncOper",
  "Sal.Oper./Enc. Oper.": "salOperEncOper",
  "Depreciação": "depreciacao",
};
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { BarChart3, Lock, Info, Factory, TrendingUp, Calculator, Building2, PieChart, ShoppingCart, DollarSign, Percent, ChevronDown, ChevronUp, Truck } from "lucide-react";
import { DashboardExportMenu } from "@/components/DashboardExportMenu";
import { DonutChartModal } from "@/components/DonutChartModal";
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { exportRelatorioToExcel, exportRelatorioToPDF } from "@/lib/export-utils";

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

// Contas que têm dados DESPSET (distribuição por subsetor)
// Qualquer conta que NÃO esteja em CONTA_NOME_PARA_CAMPO pode ter dados DESPSET
// Contas que possuem dados analíticos por subsetor na tabela custo_setor_despesa (aba MSET)
// Os nomes aqui devem corresponder exatamente ao campo conta_nome em lancamento_custo
const CONTAS_COM_DESPSET = new Set([
  "Energia Elétrica",
  "Explosivos e Acessórios",
  "Despesas Administrativas",      // mapeado para Desp.Admin.Telef.e Inform. no servidor
  "Frota/Man.Pat./Seg./Out.",
  "Consultorias Especializadas",   // mapeado para Juridíco/Cons.Esp./Serv.Ter. no servidor
  "Equipamentos de Apoio",         // mapeado para Equip.Apoio (Comb./Lub/Peças/Serv.) no servidor
  "Sal.Adm./Diretoria/Pró-Lab./Almox./Ofic./Serv./Aux./Encargos",
  "Imp., Trib., Taxas e CEFEM",
  "Desp.Admin.Telef.e Inform.",
  "Outras Desp.Setor/Proc.",
  "Equip.Apoio (Comb./Lub/Peças/Serv.)",
  "Jurídico/Cons.Esp./Serv.Ter.",  // variação de acento tratada no servidor
  "Comissão de Vendas",
  "Outras Despesas de Setores",   // mapeado para Outras Desp.Setor/Proc. no servidor
  "Sal.Adm./Diretoria/Pró-Lab./Almox./Ofic./Serv./Aux./Encargos",  // nome atual no banco
  "Impostos, CEFEM e Outras Taxas",           // mapeado para Imp., Trib., Taxas e CEFEM no servidor
]);

export default function ApuracaoCusto() {
  const [selectedPeriodoId, setSelectedPeriodoId] = useState<number | null>(null);
  const [despesaModal, setDespesaModal] = useState<{ descricao: string; total: number } | null>(null);
  const [showVendasDetalhe, setShowVendasDetalhe] = useState(false);

  // Drill-down multi-nível: composição da conta → equipamentos → itens
  type DrillDownState = {
    contaNome: string;
    contaTotal: number;
    classificacao?: string; // campo da classificação no itemDespesaImportado
    nivel: 1 | 2 | 3;
    equipamentoTag?: string;
    equipamentoDescricao?: string;
  };
  const [drillDown, setDrillDown] = useState<DrillDownState | null>(null);

  // Mapa: nome da conta → classificação no itemDespesaImportado
  const CONTA_PARA_CLASSIFICACAO: Record<string, string> = {
    "Combustível": "combustivel",
    "Lubrificantes": "lubrificantes",
    "Peças de Desgaste": "pecas_desgaste",
    "Peças de Reposição / Itens de Consumo": "pecas_reposicao",
    "Outras Despesas dos Equipamentos": "outras_despesas",
  };
  // Mapa: nome da conta → contaSistema no Fluxo (para contas de setor sem classificação de equipamento)
  const CONTA_PARA_FLUXO: Record<string, string> = {
    "Energia Elétrica": "Energia Elétrica",
    "Consultorias Especializadas": "Consultorias Especializadas",
    "Despesas Administrativas": "Despesas Administrativas",
    "Impostos, CEFEM e Outras Taxas": "Impostos, CEFEM e Outras Taxas",
    "Despesas Indiretas": "Despesas Indiretas",
    "Frota/Man.Pat./Seg./Out.": "Frota/Man.Pat./Seg./Out.",
    "Comissão de Vendas": "Comissão de Vendas",
  };

  const { data: periodos } = trpc.periodoCusto.list.useQuery();
  const { data: lancamentos } = trpc.lancamentoCusto.listByPeriodo.useQuery(
    { periodoCustoId: selectedPeriodoId! },
    { enabled: !!selectedPeriodoId }
  );
  const { data: relatorioSetor } = trpc.custoSetor.relatorio.useQuery(
    { periodoCustoId: selectedPeriodoId! },
    { enabled: !!selectedPeriodoId }
  );
  const { data: destinatariosWpp } = trpc.destinatariosWhatsapp.list.useQuery();

  // Query para dados DESPSET do modal de drill-down
  const { data: despesaSetorData, isLoading: despesaSetorLoading } = trpc.custoSetorRas.despesasPorDescricao.useQuery(
    { periodoCustoId: selectedPeriodoId!, descricao: despesaModal?.descricao ?? "" },
    { enabled: !!selectedPeriodoId && !!despesaModal }
  );

  // Drill-down nível 2 alternativo: distribuição por setor (para contas do Fluxo)
  const contaFluxoNome = drillDown ? CONTA_PARA_FLUXO[drillDown.contaNome] : undefined;
  const { data: drillFluxoDetalhe, isLoading: drillFluxoLoading } = trpc.importFluxo.detalhePorConta.useQuery(
    { periodoCustoId: selectedPeriodoId!, contaSistema: contaFluxoNome ?? "" },
    { enabled: !!selectedPeriodoId && !!contaFluxoNome && !drillDown?.classificacao && (drillDown?.nivel === 1 || drillDown?.nivel === 2) }
  );

  // Drill-down nível 2: equipamentos por classificação
  const { data: drillEquipamentos, isLoading: drillEquipLoading } = trpc.itensDespesa.equipamentosPorClassificacao.useQuery(
    { periodoCustoId: selectedPeriodoId!, classificacao: drillDown?.classificacao ?? "" },
    { enabled: !!selectedPeriodoId && !!drillDown?.classificacao && (drillDown?.nivel === 1 || drillDown?.nivel === 2) }
  );

  // Drill-down nível 3: itens detalhados por equipamento
  const { data: drillItens, isLoading: drillItensLoading } = trpc.itensDespesa.listarItensDetalhados.useQuery(
    { periodoCustoId: selectedPeriodoId!, equipamentoTag: drillDown?.equipamentoTag ?? "", classificacao: drillDown?.classificacao ?? "" },
    { enabled: !!selectedPeriodoId && !!drillDown?.equipamentoTag && !!drillDown?.classificacao && drillDown?.nivel === 3 }
  );

  // Composição por origem para drill-down nível 1
  const composicaoConta = useMemo(() => {
    if (!drillDown || !lancamentos) return null;
    const origens: { origem: string; valor: number }[] = [];
    let totalImport = 0, totalFluxo = 0, totalManual = 0;
    for (const l of lancamentos) {
      const contaNome = l.contaNome ?? "";
      if (contaNome !== drillDown.contaNome) continue;
      const valor = parseFloat(String(l.valor || "0"));
      const obs = l.observacoes ?? "";
      if (obs.includes("[Import]")) totalImport += valor;
      else if (obs.includes("[Fluxo]")) totalFluxo += valor;
      else totalManual += valor;
    }
    if (totalImport > 0) origens.push({ origem: "Import. Despesas Equip.", valor: totalImport });
    if (totalFluxo > 0) origens.push({ origem: "Import. Fluxo Realizado", valor: totalFluxo });
    if (totalManual > 0) origens.push({ origem: "Lançamento Manual", valor: totalManual });
    origens.sort((a, b) => b.valor - a.valor);
    return origens;
  }, [drillDown, lancamentos]);

  const periodoAtual = useMemo(
    () => periodos?.find((p) => p.id === selectedPeriodoId) ?? null,
    [periodos, selectedPeriodoId]
  );

  const { data: producaoModulo } = trpc.periodoCusto.getProducaoDoModulo.useQuery(
    { mes: periodoAtual?.mes ?? 1, ano: periodoAtual?.ano ?? 2026 },
    { enabled: !!periodoAtual }
  );

  // Calcular datas de início/fim do período de custo para buscar o resumo de vendas ERP
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

  // Buscar avaliação global para usar o frete informado naquele painel (fonte primária)
  const { data: avaliacaoGlobal } = trpc.avaliacaoGlobal.getByPeriodo.useQuery(
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

    // Agrupar lançamentos da mesma conta (soma valores de Import + Fluxo + manual)
    const agrupado = new Map<number, { nome: string; valor: number; divisor: string; classificacao: string }>();
    for (const l of lancamentos) {
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

    for (const [contaId, { nome, valor, divisor, classificacao }] of Array.from(agrupado.entries())) {
      const item: ContaItem = {
        id: contaId,
        nome,
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

    // Ordenar contas de cada grupo por valor decrescente
    custoVariavel.sort((a, b) => b.valor - a.valor);
    despesaVariavel.sort((a, b) => b.valor - a.valor);
    despesasIndiretas.sort((a, b) => b.valor - a.valor);

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
  }, [lancamentos, periodoAtual, producaoModulo]);  // ── Dados para gráficos ────────────────────────────────────────────────────────────────────────────

  // Paleta de cores para subsetores (por grupo)
  const SUBSETOR_PALETA: Record<string, string> = {
    "DESMONTE DE ROCHA":   "#f59e0b",
    "CARGA E TRANSPORTE":  "#3b82f6",
    "BRITAGEM":            "#22c55e",
    "EXPEDIÇÃO":           "#a855f7",
    "SERVIÇOS AUXILIARES": "#f97316",
    "ADMINISTRAÇÃO":       "#6b7280",
  };

  // Gráfico 0: Distribuição por Subsetor (Resumo Consolidado por Subsetor)
  const dadosSubsetor = useMemo(() => {
    if (!relatorioSetor || !relatorioSetor.grupos?.length) return [];
    const totalGeral = relatorioSetor.totalGeral ?? 0;
    // Achatar todos os subsetores de todos os grupos
    const subsetores: any[] = [];
    for (const grupo of relatorioSetor.grupos) {
      const corBase = SUBSETOR_PALETA[grupo.grupoNome] ?? "#94a3b8";
      for (const sub of grupo.subsetores ?? []) {
        const totalSub = parseFloat(String(sub.totalGeral ?? 0));
        const custoTon = parseFloat(String(sub.custoTon ?? 0));
        subsetores.push({
          name: sub.subsetorNome,
          value: totalSub,
          pct: totalGeral > 0 ? (totalSub / totalGeral) * 100 : 0,
          custoPorTon: custoTon,
          subtitle: `R$ ${fmt(custoTon)}/t`,
          fill: corBase,
          grupo: grupo.grupoNome,
          details: [
            { label: "Grupo", value: grupo.grupoNome },
            { label: "Total R$", value: `R$ ${fmt(totalSub)}` },
            { label: "Custo/t", value: `R$ ${fmt(custoTon)}/t` },
          ],
        });
      }
    }
    // Ordenar por valor decrescente
    return subsetores.sort((a, b) => b.value - a.value);
  }, [relatorioSetor]);

  // Gráfico 1: Distribuição por Plano de Contas (todas as contas juntas)
  const dadosPlanoContas = useMemo(() => {
    if (!relatorio) return [];
    const todasContas = [
      ...relatorio.custoVariavel,
      ...relatorio.despesaVariavel,
      ...relatorio.despesasIndiretas,
    ].sort((a, b) => b.valor - a.valor);
    return todasContas.map((c, idx) => ({
      name: c.nome,
      value: c.valor,
      pct: relatorio.totalGeral > 0 ? (c.valor / relatorio.totalGeral) * 100 : 0,
      custoPorTon: c.custoPorTon,
      subtitle: `R$ ${fmt(c.custoPorTon)}/t`,
      fill: COLORS_CONTAS[idx % COLORS_CONTAS.length],
      details: [
        { label: "Valor Total", value: `R$ ${fmt(c.valor)}` },
        { label: "Custo/t", value: `R$ ${fmt(c.custoPorTon)}` },
      ],
    }));
  }, [relatorio]);

  // Gráfico 2: Custo Médio — composição Custo Variável vs Despesa Variável
  const dadosCustoMedio = useMemo(() => {
    if (!relatorio) return [];
    const items: any[] = [];
    const totalCustoMedio = relatorio.totalCustoVariavel + relatorio.totalDespesaVariavel;
    if (relatorio.totalCustoVariavel > 0) {
      items.push({
        name: "Custo Variável (÷ Produção)",
        value: relatorio.totalCustoVariavel,
        pct: totalCustoMedio > 0 ? (relatorio.totalCustoVariavel / totalCustoMedio) * 100 : 0,
        custoPorTon: relatorio.custoPorTonProducao,
        subtitle: `R$ ${fmt(relatorio.custoPorTonProducao)}/t`,
        fill: COLORS_CUSTO_MEDIO[0],
        details: [
          { label: "Total R$", value: `R$ ${fmt(relatorio.totalCustoVariavel)}` },
          { label: "Custo/t", value: `R$ ${fmt(relatorio.custoPorTonProducao)}/t` },
        ],
      });
    }
    if (relatorio.totalDespesaVariavel > 0) {
      items.push({
        name: "Despesa Variável (÷ Vendas)",
        value: relatorio.totalDespesaVariavel,
        pct: totalCustoMedio > 0 ? (relatorio.totalDespesaVariavel / totalCustoMedio) * 100 : 0,
        custoPorTon: relatorio.custoPorTonVendas,
        subtitle: `R$ ${fmt(relatorio.custoPorTonVendas)}/t`,
        fill: COLORS_CUSTO_MEDIO[1],
        details: [
          { label: "Total R$", value: `R$ ${fmt(relatorio.totalDespesaVariavel)}` },
          { label: "Custo/t", value: `R$ ${fmt(relatorio.custoPorTonVendas)}/t` },
        ],
      });
    }
    return items;
  }, [relatorio]);

  // Gráfico 3: Custo Médio com Despesas Indiretas — composição dos três grupos
  const dadosCustoMedioComDI = useMemo(() => {
    if (!relatorio) return [];
    const items: any[] = [];
    const totalComDI = relatorio.totalCustoVariavel + relatorio.totalDespesaVariavel + relatorio.totalDespesasIndiretas;
    if (relatorio.totalCustoVariavel > 0) {
      items.push({
        name: "Custo Variável (÷ Produção)",
        value: relatorio.totalCustoVariavel,
        pct: totalComDI > 0 ? (relatorio.totalCustoVariavel / totalComDI) * 100 : 0,
        custoPorTon: relatorio.custoPorTonProducao,
        subtitle: `R$ ${fmt(relatorio.custoPorTonProducao)}/t`,
        fill: COLORS_CUSTO_MEDIO[0],
        details: [
          { label: "Total R$", value: `R$ ${fmt(relatorio.totalCustoVariavel)}` },
          { label: "Custo/t", value: `R$ ${fmt(relatorio.custoPorTonProducao)}/t` },
        ],
      });
    }
    if (relatorio.totalDespesaVariavel > 0) {
      items.push({
        name: "Despesa Variável (÷ Vendas)",
        value: relatorio.totalDespesaVariavel,
        pct: totalComDI > 0 ? (relatorio.totalDespesaVariavel / totalComDI) * 100 : 0,
        custoPorTon: relatorio.custoPorTonVendas,
        subtitle: `R$ ${fmt(relatorio.custoPorTonVendas)}/t`,
        fill: COLORS_CUSTO_MEDIO[1],
        details: [
          { label: "Total R$", value: `R$ ${fmt(relatorio.totalDespesaVariavel)}` },
          { label: "Custo/t", value: `R$ ${fmt(relatorio.custoPorTonVendas)}/t` },
        ],
      });
    }
    if (relatorio.totalDespesasIndiretas > 0) {
      items.push({
        name: "Despesas Indiretas (÷ Produção)",
        value: relatorio.totalDespesasIndiretas,
        pct: totalComDI > 0 ? (relatorio.totalDespesasIndiretas / totalComDI) * 100 : 0,
        custoPorTon: relatorio.custoPorTonDespesasIndiretas,
        subtitle: `R$ ${fmt(relatorio.custoPorTonDespesasIndiretas)}/t`,
        fill: COLORS_CUSTO_MEDIO[2],
        details: [
          { label: "Total R$", value: `R$ ${fmt(relatorio.totalDespesasIndiretas)}` },
          { label: "Custo/t", value: `R$ ${fmt(relatorio.custoPorTonDespesasIndiretas)}/t` },
        ],
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
        {relatorio && periodoAtual && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const kpis = [
                  { label: "Produção (t)", value: relatorio.producao > 0 ? fmt(relatorio.producao) + " t" : "—" },
                  { label: "Vendas (t)", value: relatorio.vendas > 0 ? fmt(relatorio.vendas) + " t" : "—" },
                  { label: "Total Geral (R$)", value: "R$ " + fmt(relatorio.totalGeral) },
                  { label: "Custo Médio (R$/t)", value: "R$ " + fmt(relatorio.custoMedio) },
                  { label: "C.M. c/ Desp. Indiretas", value: "R$ " + fmt(relatorio.custoMedioComDI) },
                ];
                const secoes = [
                  {
                    titulo: "Custo Variável",
                    corCabecalho: [22, 101, 52] as [number, number, number],
                    linhas: [
                      ...relatorio.custoVariavel.map(c => ({ conta: c.nome, divisor: "Produção", valor: "R$ " + fmt(c.valor), custoPorTon: "R$ " + fmt(c.custoPorTon), percentual: fmtPct(c.percentualGrupo) })),
                      { conta: "SUBTOTAL Custo Variável", divisor: "", valor: "R$ " + fmt(relatorio.totalCustoVariavel), custoPorTon: relatorio.producao > 0 ? "R$ " + fmt(relatorio.custoPorTonProducao) : "", isSubtotal: true },
                    ],
                  },
                  {
                    titulo: "Despesa Variável",
                    corCabecalho: [30, 64, 175] as [number, number, number],
                    linhas: [
                      ...relatorio.despesaVariavel.map(c => ({ conta: c.nome, divisor: "Vendas", valor: "R$ " + fmt(c.valor), custoPorTon: "R$ " + fmt(c.custoPorTon), percentual: fmtPct(c.percentualGrupo) })),
                      { conta: "SUBTOTAL Despesa Variável", divisor: "", valor: "R$ " + fmt(relatorio.totalDespesaVariavel), custoPorTon: relatorio.vendas > 0 ? "R$ " + fmt(relatorio.custoPorTonVendas) : "", isSubtotal: true },
                    ],
                  },
                  ...(relatorio.despesasIndiretas.length > 0 ? [{
                    titulo: "Despesas Indiretas",
                    corCabecalho: [124, 45, 18] as [number, number, number],
                    linhas: [
                      ...relatorio.despesasIndiretas.map(c => ({ conta: c.nome, divisor: "Produção", valor: "R$ " + fmt(c.valor), custoPorTon: "R$ " + fmt(c.custoPorTon), percentual: fmtPct(c.percentualGrupo) })),
                      { conta: "SUBTOTAL Despesas Indiretas", divisor: "", valor: "R$ " + fmt(relatorio.totalDespesasIndiretas), custoPorTon: relatorio.producao > 0 ? "R$ " + fmt(relatorio.custoPorTonDespesasIndiretas) : "", isSubtotal: true },
                    ],
                  }] : []),
                  {
                    titulo: "Totais",
                    corCabecalho: [15, 23, 42] as [number, number, number],
                    linhas: [
                      { conta: "TOTAL GERAL", valor: "R$ " + fmt(relatorio.totalGeral), isTotal: true },
                      { conta: "CUSTO MÉDIO", custoPorTon: "R$ " + fmt(relatorio.custoMedio), valor: "", isTotal: true },
                      { conta: "C.M. c/ Despesas Indiretas", custoPorTon: "R$ " + fmt(relatorio.custoMedioComDI), valor: "", isTotal: true },
                    ],
                  },
                ];
                exportRelatorioToExcel({
                  titulo: `Apuração de Custo — ${periodoLabel}`,
                  periodo: periodoLabel,
                  kpis,
                  secoes,
                  filename: `apuracao-custo-${periodoAtual.mes}-${periodoAtual.ano}`,
                });
              }}
              className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              Excel
            </button>
            <button
              onClick={async () => {
                const kpis = [
                  { label: "Produção (t)", value: relatorio.producao > 0 ? fmt(relatorio.producao) + " t" : "—" },
                  { label: "Vendas (t)", value: relatorio.vendas > 0 ? fmt(relatorio.vendas) + " t" : "—" },
                  { label: "Total Geral (R$)", value: "R$ " + fmt(relatorio.totalGeral) },
                  { label: "Custo Médio (R$/t)", value: "R$ " + fmt(relatorio.custoMedio) },
                  { label: "C.M. c/ Desp. Indiretas", value: "R$ " + fmt(relatorio.custoMedioComDI) },
                ];
                const secoes = [
                  {
                    titulo: "Custo Variável",
                    corCabecalho: [22, 101, 52] as [number, number, number],
                    linhas: [
                      ...relatorio.custoVariavel.map(c => ({ conta: c.nome, divisor: "Produção", valor: "R$ " + fmt(c.valor), custoPorTon: "R$ " + fmt(c.custoPorTon), percentual: fmtPct(c.percentualGrupo) })),
                      { conta: "SUBTOTAL Custo Variável", divisor: "", valor: "R$ " + fmt(relatorio.totalCustoVariavel), custoPorTon: relatorio.producao > 0 ? "R$ " + fmt(relatorio.custoPorTonProducao) : "", isSubtotal: true },
                    ],
                  },
                  {
                    titulo: "Despesa Variável",
                    corCabecalho: [30, 64, 175] as [number, number, number],
                    linhas: [
                      ...relatorio.despesaVariavel.map(c => ({ conta: c.nome, divisor: "Vendas", valor: "R$ " + fmt(c.valor), custoPorTon: "R$ " + fmt(c.custoPorTon), percentual: fmtPct(c.percentualGrupo) })),
                      { conta: "SUBTOTAL Despesa Variável", divisor: "", valor: "R$ " + fmt(relatorio.totalDespesaVariavel), custoPorTon: relatorio.vendas > 0 ? "R$ " + fmt(relatorio.custoPorTonVendas) : "", isSubtotal: true },
                    ],
                  },
                  ...(relatorio.despesasIndiretas.length > 0 ? [{
                    titulo: "Despesas Indiretas",
                    corCabecalho: [124, 45, 18] as [number, number, number],
                    linhas: [
                      ...relatorio.despesasIndiretas.map(c => ({ conta: c.nome, divisor: "Produção", valor: "R$ " + fmt(c.valor), custoPorTon: "R$ " + fmt(c.custoPorTon), percentual: fmtPct(c.percentualGrupo) })),
                      { conta: "SUBTOTAL Despesas Indiretas", divisor: "", valor: "R$ " + fmt(relatorio.totalDespesasIndiretas), custoPorTon: relatorio.producao > 0 ? "R$ " + fmt(relatorio.custoPorTonDespesasIndiretas) : "", isSubtotal: true },
                    ],
                  }] : []),
                  {
                    titulo: "Totais",
                    corCabecalho: [15, 23, 42] as [number, number, number],
                    linhas: [
                      { conta: "TOTAL GERAL", valor: "R$ " + fmt(relatorio.totalGeral), isTotal: true },
                      { conta: "CUSTO MÉDIO", custoPorTon: "R$ " + fmt(relatorio.custoMedio), valor: "", isTotal: true },
                      { conta: "C.M. c/ Despesas Indiretas", custoPorTon: "R$ " + fmt(relatorio.custoMedioComDI), valor: "", isTotal: true },
                    ],
                  },
                ];
                await exportRelatorioToPDF({
                  titulo: `Apuração de Custo — ${periodoLabel}`,
                  periodo: periodoLabel,
                  kpis,
                  secoes,
                  filename: `apuracao-custo-${periodoAtual.mes}-${periodoAtual.ano}`,
                });
              }}
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
                {relatorio && relatorio.producao > 0 && (
                  <span className="text-sm text-muted-foreground">
                    Produção: <strong>{fmt(relatorio.producao)} t</strong>
                  </span>
                )}
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
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {/* Card 1: Gastos sem Despesas Indiretas */}
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="pt-4">
                <div className="flex items-center gap-1 mb-1">
                  <Factory className="h-3 w-3 text-blue-600" />
                  <p className="text-xs text-muted-foreground">Gastos sem Desp. Indiretas</p>
                </div>
                <p className="text-sm font-bold text-blue-700 font-mono leading-tight">
                  <span className="block text-xs font-normal">R$</span>
                  {fmt(relatorio.totalCustoVariavel + relatorio.totalDespesaVariavel)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Custo Var. + Desp. Var.
                </p>
              </CardContent>
            </Card>

            {/* Card 2: Gastos com Despesas Indiretas (antes: Custo Total) */}
            <Card className="border-orange-200 bg-orange-50">
              <CardContent className="pt-4">
                <div className="flex items-center gap-1 mb-1">
                  <Building2 className="h-3 w-3 text-orange-600" />
                  <p className="text-xs text-muted-foreground">Gastos c/ Desp. Indiretas</p>
                </div>
                <p className="text-sm font-bold text-orange-700 font-mono leading-tight">
                  <span className="block text-xs font-normal">R$</span>
                  {fmt(relatorio.totalGeral)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Total incl. Desp. Indiretas
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

          {/* -- Painel Comparativo Receita × Custo x Margem --------------------------------------------------------------- */}
          {resumoVendasERP && (
            <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-white">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4 text-emerald-600" />
                    <CardTitle className="text-sm font-semibold text-emerald-800">Receita vs. Custo — {periodoLabel}</CardTitle>
                  </div>
                  {resumoVendasERP.temDados && (
                    <button
                      onClick={() => setShowVendasDetalhe(v => !v)}
                      className="flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-900 transition-colors"
                    >
                      {showVendasDetalhe ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      {showVendasDetalhe ? "Ocultar" : "Ver produtos"}
                    </button>
                  )}
                </div>
                {!resumoVendasERP.temDados && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Nenhum resumo de vendas importado para este período.
                    Acesse <strong>Vendas → Importar PDF</strong> para carregar os dados do ERP.
                  </p>
                )}
              </CardHeader>
              {resumoVendasERP.temDados && relatorio && (
                <CardContent className="pt-0">
                  {/* Cálculos base */}
                  {(() => {
                    const receitaBruta = resumoVendasERP.totalReceita;
                    // Frete: usa Avaliação Global como fonte primária, fallback para fretePeriodo do período
                    const freteAG = parseFloat((avaliacaoGlobal as any)?.frete ?? "0") || 0;
                    const fretePeriodo = parseFloat((periodoAtual as any)?.fretePeriodo ?? "0") || 0;
                    const frete = freteAG > 0 ? freteAG : fretePeriodo;
                    const receitaProdutos = receitaBruta - frete;
                    const custo = relatorio.totalGeral;
                    const margem = receitaProdutos - custo;
                    const margemPct = receitaProdutos > 0 ? (margem / receitaProdutos) * 100 : 0;
                    const pctCusto = receitaProdutos > 0 ? Math.min((custo / receitaProdutos) * 100, 100) : 0;
                    const pctMargem = 100 - pctCusto;
                    const positivo = margem >= 0;
                    return (
                      <>
                        {/* Cards de KPIs de margem */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                          {/* Receita Bruta */}
                          <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3">
                            <div className="flex items-center gap-1 mb-1">
                              <DollarSign className="h-3 w-3 text-emerald-700" />
                              <span className="text-xs text-emerald-700 font-medium">Receita Bruta</span>
                            </div>
                            <p className="text-sm font-bold text-emerald-800 font-mono">R$ {fmt(receitaBruta)}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{fmt(resumoVendasERP.totalQuantidade)} t</p>
                          </div>
                          {/* Frete do Período */}
                          <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-3">
                            <div className="flex items-center gap-1 mb-1">
                              <Truck className="h-3 w-3 text-yellow-700" />
                              <span className="text-xs text-yellow-700 font-medium">Frete do Período</span>
                            </div>
                            <p className="text-sm font-bold text-yellow-800 font-mono">R$ {fmt(frete)}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {frete > 0 ? `${fmtPct((frete / receitaBruta) * 100)} da receita` : "Informe na Avaliação Global"}
                            </p>
                          </div>
                          {/* Receita dos Produtos */}
                          <div className="rounded-lg bg-teal-50 border border-teal-200 p-3">
                            <div className="flex items-center gap-1 mb-1">
                              <ShoppingCart className="h-3 w-3 text-teal-700" />
                              <span className="text-xs text-teal-700 font-medium">Receita dos Produtos</span>
                            </div>
                            <p className="text-sm font-bold text-teal-800 font-mono">R$ {fmt(receitaProdutos)}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">Bruta − Frete</p>
                          </div>
                          {/* Margem Bruta */}
                          <div className={`rounded-lg border p-3 ${positivo ? "bg-blue-50 border-blue-200" : "bg-red-50 border-red-200"}`}>
                            <div className="flex items-center gap-1 mb-1">
                              <Percent className="h-3 w-3" style={{ color: positivo ? "#1d4ed8" : "#dc2626" }} />
                              <span className="text-xs font-medium" style={{ color: positivo ? "#1e40af" : "#b91c1c" }}>Margem Bruta</span>
                            </div>
                            <p className="text-sm font-bold font-mono" style={{ color: positivo ? "#1e3a8a" : "#991b1b" }}>R$ {fmt(margem)}</p>
                            <p className="text-xs mt-0.5" style={{ color: positivo ? "#1d4ed8" : "#dc2626" }}>{fmtPct(margemPct)} da rec. produtos</p>
                          </div>
                        </div>

                        {/* Custo Total (linha separada) */}
                        <div className="rounded-lg bg-orange-50 border border-orange-200 p-3 mb-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1">
                              <Factory className="h-3 w-3 text-orange-700" />
                              <span className="text-xs text-orange-700 font-medium">Custo Total (c/ Desp. Indiretas)</span>
                            </div>
                            <p className="text-sm font-bold text-orange-800 font-mono">R$ {fmt(custo)}</p>
                          </div>
                        </div>

                        {/* Barra de proporção Custo / Margem sobre Receita dos Produtos */}
                        <div className="mb-4">
                          <div className="flex justify-between text-xs text-muted-foreground mb-1">
                            <span>Custo sobre Rec. Produtos: <strong>{fmtPct(pctCusto)}</strong></span>
                            <span>Margem: <strong>{fmtPct(Math.max(pctMargem, 0))}</strong></span>
                          </div>
                          <div className="h-3 rounded-full overflow-hidden bg-gray-200 flex">
                            <div className="h-full bg-orange-400 transition-all" style={{ width: `${Math.min(pctCusto, 100)}%` }} />
                            {pctMargem > 0 && (
                              <div className="h-full bg-emerald-400 transition-all" style={{ width: `${pctMargem}%` }} />
                            )}
                          </div>
                          <div className="flex gap-4 mt-1 text-xs">
                            <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-orange-400"></span>Custo</span>
                            <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-emerald-400"></span>Margem</span>
                          </div>
                        </div>
                      </>
                    );
                  })()}

                  {/* Tabela de produtos (expansível) */}
                  {showVendasDetalhe && (
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead className="text-xs">Produto</TableHead>
                            <TableHead className="text-xs text-right">Qtd (t)</TableHead>
                            <TableHead className="text-xs text-right">Vl. Médio (R$/t)</TableHead>
                            <TableHead className="text-xs text-right">Receita (R$)</TableHead>
                            <TableHead className="text-xs text-right">% Receita</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {resumoVendasERP.rows.map((row) => (
                            <TableRow key={row.id} className="text-xs">
                              <TableCell className="font-medium">{row.produto}</TableCell>
                              <TableCell className="text-right font-mono">{fmt(row.quantidade)}</TableCell>
                              <TableCell className="text-right font-mono">{fmt(row.vlMedio)}</TableCell>
                              <TableCell className="text-right font-mono">{fmt(row.valor)}</TableCell>
                              <TableCell className="text-right font-mono">
                                {resumoVendasERP.totalReceita > 0
                                  ? fmtPct((row.valor / resumoVendasERP.totalReceita) * 100)
                                  : "—"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      <div className="bg-muted/30 px-4 py-2 flex justify-between text-xs font-semibold border-t">
                        <span>Total</span>
                        <span className="font-mono">R$ {fmt(resumoVendasERP.totalReceita)}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          )}

          {/* -- Graficos de Rosca -- */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Gráfico 0: Distribuição por Plano de Contas */}
            {dadosPlanoContas.length > 0 && relatorio && (
              <Card className="relative">
                <DonutChartModal
                  title={`Distribuição por Plano de Contas — ${periodoLabel}`}
                  data={dadosPlanoContas}
                  centerLabel="Total"
                  centerValue={`R$ ${fmt(relatorio.totalGeral)}`}
                  formatValue={(v) => `R$ ${fmt(v)}`}
                  formatPct={fmtPct}
                />
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-foreground">
                    Distribuição por Plano de Contas
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">Participação de cada conta no custo total</p>
                  <p className="text-xs font-medium text-amber-600 dark:text-amber-400 mt-0.5">com Despesas Indiretas</p>
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

            {/* Gráfico 1: Distribuição por Subsetor */}
            {dadosSubsetor.length > 0 && relatorio && (
              <Card className="relative">
                <DonutChartModal
                  title={`Distribuição por Subsetor — ${periodoLabel}`}
                  data={dadosSubsetor}
                  centerLabel="Total"
                  centerValue={`R$ ${fmt(relatorioSetor?.totalGeral ?? 0)}`}
                  formatValue={(v) => `R$ ${fmt(v)}`}
                  formatPct={fmtPct}
                />
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-foreground">
                    Distribuição por Subsetor
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">Participação de cada subsetor no custo total</p>
                  <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mt-0.5">sem Despesas Indiretas</p>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="relative h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie
                          data={dadosSubsetor}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={85}
                          paddingAngle={2}
                          dataKey="value"
                          labelLine={false}
                          label={renderCustomLabel}
                        >
                          {dadosSubsetor.map((d, idx) => (
                            <Cell key={idx} fill={d.fill} />
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
                          R$ {fmt(relatorioSetor?.totalGeral ?? 0)}
                        </text>
                        <Tooltip content={<CustomTooltip />} />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </div>
                  {/* Legenda */}
                  <div className="mt-2 space-y-1 max-h-40 overflow-y-auto pr-1">
                    {dadosSubsetor.map((d, idx) => (
                      <div key={idx} className="flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className="h-2.5 w-2.5 rounded-full shrink-0"
                            style={{ background: d.fill }}
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
              <Card className="relative">
                <DonutChartModal
                  title={`Custo Médio (R$/t) — ${periodoLabel}`}
                  data={dadosCustoMedio}
                  centerLabel="Custo Médio"
                  centerValue={`R$ ${fmt(relatorio.custoMedio)}/t`}
                  formatValue={(v) => `R$ ${fmt(v)}`}
                  formatPct={fmtPct}
                />
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">
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
              <Card className="relative">
                <DonutChartModal
                  title={`C.M. c/ Despesas Indiretas (R$/t) — ${periodoLabel}`}
                  data={dadosCustoMedioComDI}
                  centerLabel="C.M. c/ D.I."
                  centerValue={`R$ ${fmt(relatorio.custoMedioComDI)}/t`}
                     formatValue={(v) => `R$ ${fmt(v)}`}
                  formatPct={fmtPct}
                />
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">
                    C.M. c/ Despesas Indiretassas Indiretas (R$/t)
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

          {/* -- Tabelas de Apuração --------------------------------------------- */}
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
                      {relatorio.custoVariavel.map((conta) => {
                        const classificacao = CONTA_PARA_CLASSIFICACAO[conta.nome];
                        return (
                          <TableRow
                            key={conta.id}
                            className="hover:bg-blue-50 cursor-pointer"
                            onClick={() => setDrillDown({ contaNome: conta.nome, contaTotal: conta.valor, classificacao, nivel: 1 })}
                          >
                            <TableCell>
                              <button className="flex items-center gap-1.5 text-blue-700 hover:text-blue-900 hover:underline font-medium group text-left">
                                {conta.nome}
                                <span className="opacity-0 group-hover:opacity-100 text-xs text-blue-500 transition-opacity">↗</span>
                              </button>
                            </TableCell>
                            <TableCell className="text-right font-mono">{fmt(conta.valor)}</TableCell>
                            <TableCell className="text-right font-mono">
                              {conta.custoPorTon > 0 ? fmt(conta.custoPorTon) : "—"}
                            </TableCell>
                            <TableCell className="text-right font-mono text-muted-foreground">
                              {fmtPct(conta.percentualGrupo)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
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
                      {relatorio.despesaVariavel.map((conta) => {
                        const classificacao = CONTA_PARA_CLASSIFICACAO[conta.nome];
                        return (
                          <TableRow
                            key={conta.id}
                            className="hover:bg-blue-50 cursor-pointer"
                            onClick={() => setDrillDown({ contaNome: conta.nome, contaTotal: conta.valor, classificacao, nivel: 1 })}
                          >
                            <TableCell>
                              <button className="flex items-center gap-1.5 text-purple-700 hover:text-purple-900 hover:underline font-medium group text-left">
                                {conta.nome}
                                <span className="opacity-0 group-hover:opacity-100 text-xs text-purple-500 transition-opacity">↗</span>
                              </button>
                            </TableCell>
                            <TableCell className="text-right font-mono">{fmt(conta.valor)}</TableCell>
                            <TableCell className="text-right font-mono">
                              {conta.custoPorTon > 0 ? fmt(conta.custoPorTon) : "—"}
                            </TableCell>
                            <TableCell className="text-right font-mono text-muted-foreground">
                              {fmtPct(conta.percentualGrupo)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
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
                      {relatorio.despesasIndiretas.map((conta) => {
                        const classificacao = CONTA_PARA_CLASSIFICACAO[conta.nome];
                        return (
                          <TableRow
                            key={conta.id}
                            className="hover:bg-blue-50 cursor-pointer"
                            onClick={() => setDrillDown({ contaNome: conta.nome, contaTotal: conta.valor, classificacao, nivel: 1 })}
                          >
                            <TableCell>
                              <button className="flex items-center gap-1.5 text-orange-700 hover:text-orange-900 hover:underline font-medium group text-left">
                                {conta.nome}
                                <span className="opacity-0 group-hover:opacity-100 text-xs text-orange-500 transition-opacity">↗</span>
                              </button>
                            </TableCell>
                            <TableCell className="text-right font-mono">{fmt(conta.valor)}</TableCell>
                            <TableCell className="text-right font-mono">
                              {conta.custoPorTon > 0 ? fmt(conta.custoPorTon) : "—"}
                            </TableCell>
                            <TableCell className="text-right font-mono text-muted-foreground">
                              {fmtPct(conta.percentualGrupo)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
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

      {/* Modal de Drill-down Multi-nível: Composição → Equipamentos → Itens */}
      <Dialog open={!!drillDown} onOpenChange={(open) => { if (!open) setDrillDown(null); }}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              {drillDown?.nivel === 1 && (
                <>{drillDown.contaNome} — Composição</>
              )}
              {drillDown?.nivel === 2 && (
                <>
                  <button onClick={() => setDrillDown(d => d ? { ...d, nivel: 1, equipamentoTag: undefined, equipamentoDescricao: undefined } : null)} className="text-blue-600 hover:underline">{drillDown.contaNome}</button>
                  <span className="text-muted-foreground">›</span>
                  <span>{drillDown.classificacao ? "Equipamentos" : "Setores"}</span>
                </>
              )}
              {drillDown?.nivel === 3 && (
                <>
                  <button onClick={() => setDrillDown(d => d ? { ...d, nivel: 1, equipamentoTag: undefined, equipamentoDescricao: undefined } : null)} className="text-blue-600 hover:underline">{drillDown.contaNome}</button>
                  <span className="text-muted-foreground">›</span>
                  <button onClick={() => setDrillDown(d => d ? { ...d, nivel: 2, equipamentoTag: undefined, equipamentoDescricao: undefined } : null)} className="text-blue-600 hover:underline">Equipamentos</button>
                  <span className="text-muted-foreground">›</span>
                  <span className="truncate max-w-[200px]">{drillDown.equipamentoDescricao || drillDown.equipamentoTag}</span>
                </>
              )}
            </DialogTitle>
            <p className="text-xs text-muted-foreground">
              Total da conta: <span className="font-mono font-semibold">R$ {fmt(drillDown?.contaTotal ?? 0)}</span>
              {periodoAtual && <span className="ml-2">| {periodoAtual.mes}/{periodoAtual.ano}</span>}
            </p>
          </DialogHeader>

          {/* Nível 1: Composição por origem */}
          {drillDown?.nivel === 1 && (
            <div className="space-y-4">
              {composicaoConta && composicaoConta.length > 0 ? (
                <div>
                  <h4 className="text-sm font-semibold mb-2 text-muted-foreground">Origem dos valores</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Origem</TableHead>
                        <TableHead className="text-right w-40">Valor (R$)</TableHead>
                        <TableHead className="text-right w-24">%</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {composicaoConta.map((row, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{row.origem}</TableCell>
                          <TableCell className="text-right font-mono">{fmt(row.valor)}</TableCell>
                          <TableCell className="text-right font-mono text-muted-foreground">
                            {drillDown.contaTotal > 0 ? fmtPct((row.valor / drillDown.contaTotal) * 100) : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="font-semibold bg-muted/40">
                        <TableCell>Total</TableCell>
                        <TableCell className="text-right font-mono">{fmt(composicaoConta.reduce((s, r) => s + r.valor, 0))}</TableCell>
                        <TableCell className="text-right font-mono">100,0%</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="py-4 text-center text-muted-foreground text-sm">Nenhum lançamento encontrado.</div>
              )}

              {/* Botão para ver equipamentos (se for conta de equipamento) */}
              {drillDown.classificacao && (
                <button
                  onClick={() => setDrillDown(d => d ? { ...d, nivel: 2 } : null)}
                  className="w-full py-3 px-4 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium text-sm flex items-center justify-between transition-colors"
                >
                  <span>🛠️ Ver detalhamento por Equipamento</span>
                  <span className="text-blue-500">→</span>
                </button>
              )}
              {/* Botão para ver distribuição por setor (se for conta do Fluxo sem classificação de equipamento) */}
              {!drillDown.classificacao && contaFluxoNome && (
                <button
                  onClick={() => setDrillDown(d => d ? { ...d, nivel: 2 } : null)}
                  className="w-full py-3 px-4 rounded-lg border border-green-200 bg-green-50 hover:bg-green-100 text-green-700 font-medium text-sm flex items-center justify-between transition-colors"
                >
                  <span>🏭 Ver distribuição por Setor</span>
                  <span className="text-green-500">→</span>
                </button>
              )}
            </div>
          )}

          {/* Nível 2: Equipamentos por classificação OU Distribuição por Setor */}
          {drillDown?.nivel === 2 && (
            <div>
              {/* Caso 1: Conta de equipamento - mostra equipamentos */}
              {drillDown.classificacao && (
                <>
                  {drillEquipLoading ? (
                    <div className="py-8 text-center text-muted-foreground text-sm">Carregando equipamentos...</div>
                  ) : drillEquipamentos && drillEquipamentos.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-8">#</TableHead>
                          <TableHead>Equipamento</TableHead>
                          <TableHead className="text-right w-20">Itens</TableHead>
                          <TableHead className="text-right w-40">Valor (R$)</TableHead>
                          <TableHead className="text-right w-24">%</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {drillEquipamentos.map((eq, idx) => {
                          const totalEquips = drillEquipamentos.reduce((s, e) => s + e.totalCusto, 0);
                          return (
                            <TableRow
                              key={eq.equipamentoTag}
                              className="hover:bg-blue-50 cursor-pointer"
                              onClick={() => setDrillDown(d => d ? { ...d, nivel: 3, equipamentoTag: eq.equipamentoTag, equipamentoDescricao: eq.equipamentoDescricao ?? eq.equipamentoTag } : null)}
                            >
                              <TableCell className="text-muted-foreground text-xs">{idx + 1}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1.5 text-blue-700 hover:text-blue-900 font-medium group">
                                  {eq.equipamentoDescricao || eq.equipamentoTag}
                                  <span className="opacity-0 group-hover:opacity-100 text-xs text-blue-500 transition-opacity">→</span>
                                </div>
                                <span className="text-xs text-muted-foreground">{eq.equipamentoTag}</span>
                              </TableCell>
                              <TableCell className="text-right font-mono text-muted-foreground">{eq.totalItens}</TableCell>
                              <TableCell className="text-right font-mono font-medium">{fmt(eq.totalCusto)}</TableCell>
                              <TableCell className="text-right font-mono text-muted-foreground">
                                {totalEquips > 0 ? fmtPct((eq.totalCusto / totalEquips) * 100) : "—"}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                        <TableRow className="font-semibold bg-muted/40">
                          <TableCell></TableCell>
                          <TableCell>Total ({drillEquipamentos.length} equip.)</TableCell>
                          <TableCell className="text-right font-mono">{drillEquipamentos.reduce((s, e) => s + e.totalItens, 0)}</TableCell>
                          <TableCell className="text-right font-mono">{fmt(drillEquipamentos.reduce((s, e) => s + e.totalCusto, 0))}</TableCell>
                          <TableCell className="text-right font-mono">100,0%</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="py-8 text-center text-muted-foreground text-sm">
                      Nenhum item detalhado importado para esta conta neste período.<br/>
                      <span className="text-xs">Importe a planilha de despesas de equipamentos para ver o detalhamento.</span>
                    </div>
                  )}
                </>
              )}
              {/* Caso 2: Conta de setor (Fluxo) - mostra distribuição por setor */}
              {!drillDown.classificacao && contaFluxoNome && (
                <>
                  {drillFluxoLoading ? (
                    <div className="py-8 text-center text-muted-foreground text-sm">Carregando distribuição por setor...</div>
                  ) : drillFluxoDetalhe && drillFluxoDetalhe.setores.length > 0 ? (
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-muted-foreground">Distribuição por Setor</h4>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-8">#</TableHead>
                            <TableHead>Setor</TableHead>
                            <TableHead className="text-right w-40">Valor (R$)</TableHead>
                            <TableHead className="text-right w-24">%</TableHead>
                            <TableHead className="text-right w-24">Rateio</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {drillFluxoDetalhe.setores.map((s, idx) => (
                            <TableRow key={s.setor}>
                              <TableCell className="text-muted-foreground text-xs">{idx + 1}</TableCell>
                              <TableCell>
                                <div className="font-medium">{s.setor}</div>
                                {s.subcontas.length > 1 && (
                                  <div className="text-xs text-muted-foreground mt-0.5">
                                    {s.subcontas.map(sc => sc.nome).join(", ")}
                                  </div>
                                )}
                                {s.subcontas.length === 1 && s.subcontas[0].nome !== drillDown.contaNome && (
                                  <div className="text-xs text-muted-foreground mt-0.5">
                                    {s.subcontas[0].nome}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="text-right font-mono font-medium">{fmt(s.valor)}</TableCell>
                              <TableCell className="text-right font-mono text-muted-foreground">{fmtPct(s.percentual)}</TableCell>
                              <TableCell className="text-right">
                                {s.isRateio ? (
                                  <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                                    {s.percentualRateio ? `${(s.percentualRateio * 100).toFixed(0)}%` : "Sim"}
                                  </Badge>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="font-semibold bg-muted/40">
                            <TableCell></TableCell>
                            <TableCell>Total ({drillFluxoDetalhe.setores.length} setores)</TableCell>
                            <TableCell className="text-right font-mono">{fmt(drillFluxoDetalhe.total)}</TableCell>
                            <TableCell className="text-right font-mono">100,0%</TableCell>
                            <TableCell></TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="py-8 text-center text-muted-foreground text-sm">
                      Nenhum dado de Fluxo Realizado importado para esta conta neste período.<br/>
                      <span className="text-xs">Importe a planilha de Fluxo Realizado para ver a distribuição por setor.</span>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Nível 3: Itens individuais por equipamento */}
          {drillDown?.nivel === 3 && (
            <div>
              {drillItensLoading ? (
                <div className="py-8 text-center text-muted-foreground text-sm">Carregando itens...</div>
              ) : drillItens && drillItens.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{drillItens.length} itens</span>
                    <span className="font-mono font-semibold">Total: R$ {fmt(drillItens.reduce((s, i) => s + i.custo, 0))}</span>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-20">Data</TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead className="text-right w-16">Qtd</TableHead>
                        <TableHead className="text-right w-32">Valor (R$)</TableHead>
                        {drillDown.classificacao === "combustivel" && (
                          <TableHead className="text-right w-24">Horím.</TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {drillItens.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="text-xs font-mono">{item.data || "—"}</TableCell>
                          <TableCell className="text-sm">
                            <span className="font-medium">{item.produto}</span>
                            {item.grupoProduto && <span className="text-xs text-muted-foreground ml-1">({item.grupoProduto})</span>}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">{item.quantidade > 0 ? item.quantidade.toLocaleString("pt-BR") : "—"}</TableCell>
                          <TableCell className="text-right font-mono font-medium">{fmt(item.custo)}</TableCell>
                          {drillDown.classificacao === "combustivel" && (
                            <TableCell className="text-right font-mono text-xs">{item.hodometro ?? "—"}</TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground text-sm">Nenhum item encontrado.</div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Drill-down DESPSET */}
      <Dialog open={!!despesaModal} onOpenChange={(open) => { if (!open) setDespesaModal(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-base">
              {despesaModal?.descricao} — Distribuição por Subsetor
            </DialogTitle>
            <p className="text-xs text-muted-foreground">
              Total: <span className="font-mono font-semibold">R$ {fmt(despesaModal?.total ?? 0)}</span>
              {periodoAtual && <span className="ml-2">| {periodoAtual.mes}/{periodoAtual.ano}</span>}
            </p>
          </DialogHeader>
          {despesaSetorLoading ? (
            <div className="py-8 text-center text-muted-foreground text-sm">Carregando...</div>
          ) : despesaSetorData && despesaSetorData.subsetores.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subsetor</TableHead>
                  <TableHead className="text-right w-40">Valor (R$)</TableHead>
                  <TableHead className="text-right w-24">%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {despesaSetorData.subsetores.map((row, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{row.subsetorNome}</TableCell>
                    <TableCell className="text-right font-mono">{fmt(row.valor)}</TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">
                      {despesaSetorData.total > 0
                        ? fmtPct((row.valor / despesaSetorData.total) * 100)
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-semibold bg-muted/40">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right font-mono">{fmt(despesaSetorData.total)}</TableCell>
                  <TableCell className="text-right font-mono">100,0%</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          ) : (
            <div className="py-8 text-center text-muted-foreground text-sm">
              Nenhum dado encontrado para esta conta neste período.
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
