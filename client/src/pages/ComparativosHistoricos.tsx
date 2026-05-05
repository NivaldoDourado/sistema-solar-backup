import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine, ComposedChart, Area
} from "recharts";
import {
  TrendingUp, TrendingDown, BarChart3, DollarSign, Truck, Fuel,
  Factory, ShoppingCart, AlertCircle, Download, FileText
} from "lucide-react";
import { exportToExcel, exportToPDF } from "@/lib/export-utils";

const ANO_ATUAL = new Date().getFullYear();
const ANOS = Array.from({ length: 6 }, (_, i) => ANO_ATUAL - 3 + i);

// Paleta de cores consistente
const COLORS = {
  faturamento: "#10b981",
  frete: "#f59e0b",
  receitaProdutos: "#3b82f6",
  custoTotal: "#ef4444",
  saldoBruto: "#8b5cf6",
  saldoFinal: "#06b6d4",
  producao: "#84cc16",
  combustivel: "#f97316",
  margem: "#ec4899",
};

const GRUPO_COLORS = [
  "#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6",
  "#06b6d4", "#f97316", "#84cc16", "#ec4899", "#6366f1",
];

function fmt(v: number, decimals = 2): string {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtMil(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `R$ ${fmt(v / 1_000_000, 1)}M`;
  if (Math.abs(v) >= 1_000) return `R$ ${fmt(v / 1_000, 0)}k`;
  return `R$ ${fmt(v, 0)}`;
}

function fmtPct(v: number): string {
  return `${fmt(v, 1)}%`;
}

const CustomTooltipFinanceiro = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg text-xs min-w-[180px]">
      <p className="font-bold text-foreground mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex justify-between gap-4 py-0.5">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="font-mono font-semibold text-foreground">
            {p.dataKey === "margemBruta" || p.dataKey === "margemFinal"
              ? fmtPct(p.value)
              : fmtMil(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
};

const CustomTooltipProducao = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg text-xs min-w-[160px]">
      <p className="font-bold text-foreground mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex justify-between gap-4 py-0.5">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="font-mono font-semibold text-foreground">
            {fmt(p.value, 0)} {p.dataKey === "producaoTotal" || p.dataKey === "qtdVendida" ? "t" : ""}
          </span>
        </div>
      ))}
    </div>
  );
};

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
      <AlertCircle className="h-10 w-10 opacity-40" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

function KpiCard({ title, value, sub, icon: Icon, trend, color }: {
  title: string; value: string; sub?: string;
  icon: any; trend?: number; color: string;
}) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground font-medium truncate">{title}</p>
            <p className="text-lg font-bold text-foreground mt-0.5 font-mono truncate">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className={`p-2 rounded-lg ml-2 flex-shrink-0`} style={{ backgroundColor: color + "20" }}>
            <Icon className="h-5 w-5" style={{ color }} />
          </div>
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${trend >= 0 ? "text-emerald-600" : "text-red-500"}`}>
            {trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            <span>{trend >= 0 ? "+" : ""}{fmtPct(trend)} vs. período anterior</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ComparativosHistoricos() {
  const [anoInicio, setAnoInicio] = useState(ANO_ATUAL - 1);
  const [anoFim, setAnoFim] = useState(ANO_ATUAL);
  const [activeTab, setActiveTab] = useState("financeiro");

  const { data: serieData, isLoading: loadingSerie } = trpc.comparativos.serieHistorica.useQuery(
    { anoInicio, anoFim },
    { enabled: anoInicio <= anoFim }
  );

  const { data: custoSetorData, isLoading: loadingCustoSetor } = trpc.comparativos.evolucaoCustoSetor.useQuery(
    { anoInicio, anoFim },
    { enabled: anoInicio <= anoFim }
  );

  const { data: combustivelData, isLoading: loadingCombustivel } = trpc.comparativos.evolucaoCombustivel.useQuery(
    { anoInicio, anoFim },
    { enabled: anoInicio <= anoFim }
  );

  const serie = serieData?.serie ?? [];

  // KPIs de resumo (últimos 2 períodos com dados)
  const periodosComDados = serie.filter(p => p.temCusto || p.temVendas);
  const ultimo = periodosComDados[periodosComDados.length - 1];
  const penultimo = periodosComDados[periodosComDados.length - 2];

  const calcTrend = (atual: number, anterior: number) => {
    if (!anterior || anterior === 0) return undefined;
    return ((atual - anterior) / Math.abs(anterior)) * 100;
  };

  // Melhor e pior margem
  const periodosComMargem = serie.filter(p => p.temVendas && p.temCusto);
  const melhorMargem = periodosComMargem.length > 0
    ? periodosComMargem.reduce((a, b) => a.margemBruta > b.margemBruta ? a : b)
    : null;
  const piorMargem = periodosComMargem.length > 0
    ? periodosComMargem.reduce((a, b) => a.margemBruta < b.margemBruta ? a : b)
    : null;

  // Totais do período
  const totalFaturamento = serie.reduce((s, p) => s + p.faturamento, 0);
  const totalCusto = serie.reduce((s, p) => s + p.custoTotal, 0);
  const totalProducao = serie.reduce((s, p) => s + p.producaoTotal, 0);
  const totalCombustivel = combustivelData?.reduce((s, p) => s + p.litros, 0) ?? 0;

  const loading = loadingSerie || loadingCustoSetor || loadingCombustivel;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            Comparativos Históricos
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Evolução mensal de custos, produção, vendas e indicadores financeiros
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">De</span>
            <Select value={String(anoInicio)} onValueChange={(v) => setAnoInicio(Number(v))}>
              <SelectTrigger className="w-24 h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ANOS.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">até</span>
            <Select value={String(anoFim)} onValueChange={(v) => setAnoFim(Number(v))}>
              <SelectTrigger className="w-24 h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ANOS.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {serie.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {serie.length} período{serie.length > 1 ? "s" : ""}
            </Badge>
          )}
        </div>
      </div>

      {/* KPIs de resumo */}
      {ultimo && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard
            title={`Faturamento — ${ultimo.label}`}
            value={fmtMil(ultimo.faturamento)}
            sub={`Total: ${fmtMil(totalFaturamento)}`}
            icon={DollarSign}
            color={COLORS.faturamento}
            trend={penultimo ? calcTrend(ultimo.faturamento, penultimo.faturamento) : undefined}
          />
          <KpiCard
            title={`Custo Total — ${ultimo.label}`}
            value={fmtMil(ultimo.custoTotal)}
            sub={`Total: ${fmtMil(totalCusto)}`}
            icon={BarChart3}
            color={COLORS.custoTotal}
            trend={penultimo ? calcTrend(ultimo.custoTotal, penultimo.custoTotal) : undefined}
          />
          <KpiCard
            title={`Produção — ${ultimo.label}`}
            value={`${fmt(ultimo.producaoTotal, 0)} t`}
            sub={`Total: ${fmt(totalProducao, 0)} t`}
            icon={Factory}
            color={COLORS.producao}
            trend={penultimo ? calcTrend(ultimo.producaoTotal, penultimo.producaoTotal) : undefined}
          />
          <KpiCard
            title={`Margem Bruta — ${ultimo.label}`}
            value={fmtPct(ultimo.margemBruta)}
            sub={ultimo.margemBruta >= 0 ? "Resultado positivo" : "Resultado negativo"}
            icon={TrendingUp}
            color={ultimo.margemBruta >= 0 ? COLORS.faturamento : COLORS.custoTotal}
            trend={penultimo ? calcTrend(ultimo.margemBruta, penultimo.margemBruta) : undefined}
          />
        </div>
      )}

      {/* Destaques */}
      {(melhorMargem || piorMargem) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {melhorMargem && (
            <Card className="border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20">
              <CardContent className="pt-3 pb-3">
                <p className="text-xs text-emerald-700 font-medium">Melhor Margem Bruta</p>
                <p className="text-lg font-bold text-emerald-700 font-mono">{fmtPct(melhorMargem.margemBruta)}</p>
                <p className="text-xs text-muted-foreground">{melhorMargem.label}</p>
              </CardContent>
            </Card>
          )}
          {piorMargem && (
            <Card className="border-red-200 bg-red-50/50 dark:bg-red-950/20">
              <CardContent className="pt-3 pb-3">
                <p className="text-xs text-red-700 font-medium">Pior Margem Bruta</p>
                <p className="text-lg font-bold text-red-700 font-mono">{fmtPct(piorMargem.margemBruta)}</p>
                <p className="text-xs text-muted-foreground">{piorMargem.label}</p>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardContent className="pt-3 pb-3">
              <p className="text-xs text-muted-foreground font-medium">Combustível Total</p>
              <p className="text-lg font-bold text-foreground font-mono">{fmt(totalCombustivel, 0)} L</p>
              <p className="text-xs text-muted-foreground">no período selecionado</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Abas de gráficos */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
          <TabsTrigger value="margem">Margem</TabsTrigger>
          <TabsTrigger value="producao">Produção e Vendas</TabsTrigger>
          <TabsTrigger value="custoSetor">Custo por Setor</TabsTrigger>
          <TabsTrigger value="combustivel">Combustível</TabsTrigger>
          <TabsTrigger value="tabela">Tabela Resumo</TabsTrigger>
        </TabsList>

        {/* ABA: Financeiro */}
        <TabsContent value="financeiro" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Faturamento, Frete, Custo e Saldo Bruto</CardTitle>
              <CardDescription>Evolução mensal dos principais indicadores financeiros</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-72 flex items-center justify-center text-muted-foreground text-sm">Carregando...</div>
              ) : serie.length === 0 ? (
                <EmptyState message="Nenhum período de custo encontrado para o intervalo selecionado." />
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <ComposedChart data={serie} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => fmtMil(v)} tick={{ fontSize: 10 }} width={72} />
                    <Tooltip content={<CustomTooltipFinanceiro />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="faturamento" name="Faturamento" fill={COLORS.faturamento} opacity={0.85} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="frete" name="Frete" fill={COLORS.frete} opacity={0.85} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="custoTotal" name="Custo Total" fill={COLORS.custoTotal} opacity={0.85} radius={[3, 3, 0, 0]} />
                    <Line dataKey="saldoBruto" name="Saldo Bruto" stroke={COLORS.saldoBruto} strokeWidth={2.5} dot={{ r: 4 }} type="monotone" />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Receita dos Produtos vs. Custo Total</CardTitle>
              <CardDescription>Receita líquida de frete comparada ao custo de produção</CardDescription>
            </CardHeader>
            <CardContent>
              {serie.length === 0 ? (
                <EmptyState message="Nenhum dado disponível." />
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={serie} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => fmtMil(v)} tick={{ fontSize: 10 }} width={72} />
                    <Tooltip content={<CustomTooltipFinanceiro />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="receitaProdutos" name="Receita dos Produtos" fill={COLORS.receitaProdutos} opacity={0.85} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="custoTotal" name="Custo Total" fill={COLORS.custoTotal} opacity={0.85} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA: Margem */}
        <TabsContent value="margem" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Evolução da Margem Bruta e Margem Final (%)</CardTitle>
              <CardDescription>Percentual sobre o faturamento bruto</CardDescription>
            </CardHeader>
            <CardContent>
              {serie.length === 0 ? (
                <EmptyState message="Nenhum dado disponível." />
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={serie} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => `${v.toFixed(0)}%`} tick={{ fontSize: 10 }} width={52} />
                    <Tooltip content={<CustomTooltipFinanceiro />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <ReferenceLine y={0} stroke="#6b7280" strokeDasharray="4 4" />
                    <Area dataKey="margemBruta" name="Margem Bruta" stroke={COLORS.saldoBruto} fill={COLORS.saldoBruto} fillOpacity={0.15} strokeWidth={2.5} dot={{ r: 4 }} type="monotone" />
                    <Line dataKey="margemFinal" name="Margem Final" stroke={COLORS.saldoFinal} strokeWidth={2} strokeDasharray="5 3" dot={{ r: 3 }} type="monotone" />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Custo por Tonelada (R$/t)</CardTitle>
              <CardDescription>Eficiência de custo em relação à produção</CardDescription>
            </CardHeader>
            <CardContent>
              {serie.length === 0 ? (
                <EmptyState message="Nenhum dado disponível." />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={serie} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => `R$ ${fmt(v, 0)}`} tick={{ fontSize: 10 }} width={72} />
                    <Tooltip formatter={(v: any) => [`R$ ${fmt(v, 2)}/t`, "Custo/t"]} labelFormatter={(l) => `Período: ${l}`} />
                    <Line dataKey="custoTon" name="Custo/t" stroke={COLORS.custoTotal} strokeWidth={2.5} dot={{ r: 4 }} type="monotone" />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA: Produção e Vendas */}
        <TabsContent value="producao" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Produção Total vs. Quantidade Vendida (t)</CardTitle>
              <CardDescription>Comparativo mensal entre produção e vendas em toneladas</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-72 flex items-center justify-center text-muted-foreground text-sm">Carregando...</div>
              ) : serie.length === 0 ? (
                <EmptyState message="Nenhum período encontrado." />
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={serie} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => `${fmt(v / 1000, 0)}k`} tick={{ fontSize: 10 }} width={52} />
                    <Tooltip content={<CustomTooltipProducao />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="producaoTotal" name="Produção (t)" fill={COLORS.producao} opacity={0.85} radius={[3, 3, 0, 0]} />
                    <Line dataKey="qtdVendida" name="Qtd. Vendida (t)" stroke={COLORS.receitaProdutos} strokeWidth={2.5} dot={{ r: 4 }} type="monotone" />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Faturamento por Tonelada Vendida (R$/t)</CardTitle>
              <CardDescription>Preço médio de venda ao longo dos meses</CardDescription>
            </CardHeader>
            <CardContent>
              {serie.length === 0 ? (
                <EmptyState message="Nenhum dado disponível." />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart
                    data={serie.map(p => ({
                      ...p,
                      precoMedio: p.qtdVendida > 0 ? p.faturamento / p.qtdVendida : 0,
                    }))}
                    margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => `R$ ${fmt(v, 0)}`} tick={{ fontSize: 10 }} width={72} />
                    <Tooltip formatter={(v: any) => [`R$ ${fmt(v, 2)}/t`, "Preço Médio"]} labelFormatter={(l) => `Período: ${l}`} />
                    <Line dataKey="precoMedio" name="Preço Médio R$/t" stroke={COLORS.faturamento} strokeWidth={2.5} dot={{ r: 4 }} type="monotone" />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA: Custo por Setor */}
        <TabsContent value="custoSetor" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Evolução do Custo por Grupo/Setor</CardTitle>
              <CardDescription>Distribuição mensal dos custos por grupo operacional</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingCustoSetor ? (
                <div className="h-72 flex items-center justify-center text-muted-foreground text-sm">Carregando...</div>
              ) : !custoSetorData || custoSetorData.periodos.length === 0 ? (
                <EmptyState message="Nenhum dado de custo por setor encontrado." />
              ) : (
                <ResponsiveContainer width="100%" height={340}>
                  <BarChart data={custoSetorData.dados} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => fmtMil(v)} tick={{ fontSize: 10 }} width={72} />
                    <Tooltip
                      formatter={(v: any, name: string) => [fmtMil(v), name]}
                      labelFormatter={(l) => `Período: ${l}`}
                      wrapperStyle={{ fontSize: 11 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    {custoSetorData.grupos.map((grupo, i) => (
                      <Bar
                        key={grupo}
                        dataKey={grupo}
                        name={grupo}
                        fill={GRUPO_COLORS[i % GRUPO_COLORS.length]}
                        stackId="a"
                        opacity={0.85}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA: Combustível */}
        <TabsContent value="combustivel" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Consumo de Combustível (Litros)</CardTitle>
              <CardDescription>Evolução mensal do volume abastecido</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingCombustivel ? (
                <div className="h-72 flex items-center justify-center text-muted-foreground text-sm">Carregando...</div>
              ) : !combustivelData || combustivelData.length === 0 ? (
                <EmptyState message="Nenhum dado de abastecimento encontrado." />
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <ComposedChart data={combustivelData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => `${fmt(v / 1000, 0)}k L`} tick={{ fontSize: 10 }} width={60} />
                    <Tooltip
                      formatter={(v: any, name: string) => [
                        name === "litros" ? `${fmt(v, 0)} L` : `R$ ${fmt(v, 2)}`,
                        name === "litros" ? "Litros" : "Custo"
                      ]}
                      labelFormatter={(l) => `Período: ${l}`}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="litros" name="Litros" fill={COLORS.combustivel} opacity={0.85} radius={[3, 3, 0, 0]} />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Custo Total de Combustível (R$)</CardTitle>
              <CardDescription>Evolução mensal do gasto com combustível</CardDescription>
            </CardHeader>
            <CardContent>
              {!combustivelData || combustivelData.length === 0 ? (
                <EmptyState message="Nenhum dado disponível." />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <ComposedChart data={combustivelData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => fmtMil(v)} tick={{ fontSize: 10 }} width={72} />
                    <Tooltip
                      formatter={(v: any, name: string) => [
                        name === "custo" ? fmtMil(v) : `R$ ${fmt(v, 4)}`,
                        name === "custo" ? "Custo Total" : "Preço Médio/L"
                      ]}
                      labelFormatter={(l) => `Período: ${l}`}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Area dataKey="custo" name="custo" stroke={COLORS.combustivel} fill={COLORS.combustivel} fillOpacity={0.15} strokeWidth={2.5} type="monotone" />
                    <Line dataKey="mediaPreco" name="mediaPreco" stroke="#6366f1" strokeWidth={1.5} strokeDasharray="4 3" dot={{ r: 3 }} type="monotone" yAxisId={1} />
                    <YAxis yAxisId={1} orientation="right" tickFormatter={(v) => `R$ ${fmt(v, 2)}`} tick={{ fontSize: 10 }} width={64} />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA: Tabela Resumo */}
        <TabsContent value="tabela" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Tabela Resumo por Período</CardTitle>
                  <CardDescription>Todos os indicadores consolidados em uma visão tabular</CardDescription>
                </div>
                {serie.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => {
                        const totalFrete = serie.reduce((s, p) => s + p.frete, 0);
                        const totalRecProdutos = serie.reduce((s, p) => s + (p.faturamento - p.frete), 0);
                        const totalSaldoBruto = serie.reduce((s, p) => s + p.saldoBruto, 0);
                        const totalCustoTon = totalProducao > 0 ? totalCusto / totalProducao : 0;

                        const dataRows = serie.map(p => ({
                          periodo: p.label,
                          faturamento: p.faturamento,
                          frete: p.frete,
                          recProdutos: p.faturamento - p.frete,
                          custoTotal: p.custoTotal,
                          saldoBruto: p.saldoBruto,
                          margemBruta: p.temCusto && p.temVendas ? p.margemBruta : null,
                          producao: p.producaoTotal,
                          custoTon: p.custoTon,
                          combustivel: p.combustivelLitros,
                        }));

                        // Adicionar linha de totais
                        dataRows.push({
                          periodo: "TOTAL",
                          faturamento: totalFaturamento,
                          frete: totalFrete,
                          recProdutos: totalRecProdutos,
                          custoTotal: totalCusto,
                          saldoBruto: totalSaldoBruto,
                          margemBruta: null,
                          producao: totalProducao,
                          custoTon: totalCustoTon,
                          combustivel: totalCombustivel,
                        });

                        exportToExcel({
                          title: "Comparativos Históricos — Tabela Resumo",
                          subtitle: `Período: ${anoInicio} a ${anoFim}`,
                          filename: `comparativos_historicos_${anoInicio}_${anoFim}`,
                          columns: [
                            { header: "Período", key: "periodo", width: 12 },
                            { header: "Faturamento (R$)", key: "faturamento", width: 18, format: (v: number) => v > 0 ? fmt(v) : "—" },
                            { header: "Frete (R$)", key: "frete", width: 16, format: (v: number) => v > 0 ? fmt(v) : "—" },
                            { header: "Rec. Produtos (R$)", key: "recProdutos", width: 18, format: (v: number) => v > 0 ? fmt(v) : "—" },
                            { header: "Custo Total (R$)", key: "custoTotal", width: 18, format: (v: number) => v > 0 ? fmt(v) : "—" },
                            { header: "Saldo Bruto (R$)", key: "saldoBruto", width: 18, format: (v: number) => fmt(v) },
                            { header: "Mg. Bruta (%)", key: "margemBruta", width: 14, format: (v: number | null) => v !== null ? fmtPct(v) : "—" },
                            { header: "Produção (t)", key: "producao", width: 14, format: (v: number) => v > 0 ? fmt(v, 0) : "—" },
                            { header: "Custo/t (R$)", key: "custoTon", width: 14, format: (v: number) => v > 0 ? fmt(v, 2) : "—" },
                            { header: "Combustível (L)", key: "combustivel", width: 16, format: (v: number) => v > 0 ? fmt(v, 0) : "—" },
                          ],
                          data: dataRows,
                        });
                      }}
                    >
                      <Download className="h-4 w-4" />
                      Excel
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={async () => {
                        const totalFrete = serie.reduce((s, p) => s + p.frete, 0);
                        const totalRecProdutos = serie.reduce((s, p) => s + (p.faturamento - p.frete), 0);
                        const totalSaldoBruto = serie.reduce((s, p) => s + p.saldoBruto, 0);
                        const totalCustoTon = totalProducao > 0 ? totalCusto / totalProducao : 0;

                        const dataRows = serie.map(p => ({
                          periodo: p.label,
                          faturamento: p.faturamento,
                          frete: p.frete,
                          recProdutos: p.faturamento - p.frete,
                          custoTotal: p.custoTotal,
                          saldoBruto: p.saldoBruto,
                          margemBruta: p.temCusto && p.temVendas ? p.margemBruta : null,
                          producao: p.producaoTotal,
                          custoTon: p.custoTon,
                          combustivel: p.combustivelLitros,
                        }));

                        // Adicionar linha de totais
                        dataRows.push({
                          periodo: "TOTAL",
                          faturamento: totalFaturamento,
                          frete: totalFrete,
                          recProdutos: totalRecProdutos,
                          custoTotal: totalCusto,
                          saldoBruto: totalSaldoBruto,
                          margemBruta: null,
                          producao: totalProducao,
                          custoTon: totalCustoTon,
                          combustivel: totalCombustivel,
                        });

                        await exportToPDF({
                          title: "Comparativos Históricos — Tabela Resumo",
                          subtitle: `Período: ${anoInicio} a ${anoFim}`,
                          filename: `comparativos_historicos_${anoInicio}_${anoFim}`,
                          columns: [
                            { header: "Período", key: "periodo", width: 12 },
                            { header: "Faturamento (R$)", key: "faturamento", width: 18, format: (v: number) => v > 0 ? fmt(v) : "—" },
                            { header: "Frete (R$)", key: "frete", width: 16, format: (v: number) => v > 0 ? fmt(v) : "—" },
                            { header: "Rec. Produtos (R$)", key: "recProdutos", width: 18, format: (v: number) => v > 0 ? fmt(v) : "—" },
                            { header: "Custo Total (R$)", key: "custoTotal", width: 18, format: (v: number) => v > 0 ? fmt(v) : "—" },
                            { header: "Saldo Bruto (R$)", key: "saldoBruto", width: 18, format: (v: number) => fmt(v) },
                            { header: "Mg. Bruta (%)", key: "margemBruta", width: 14, format: (v: number | null) => v !== null ? fmtPct(v) : "—" },
                            { header: "Produção (t)", key: "producao", width: 14, format: (v: number) => v > 0 ? fmt(v, 0) : "—" },
                            { header: "Custo/t (R$)", key: "custoTon", width: 14, format: (v: number) => v > 0 ? fmt(v, 2) : "—" },
                            { header: "Combustível (L)", key: "combustivel", width: 16, format: (v: number) => v > 0 ? fmt(v, 0) : "—" },
                          ],
                          data: dataRows,
                        });
                      }}
                    >
                      <FileText className="h-4 w-4" />
                      PDF
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {serie.length === 0 ? (
                <EmptyState message="Nenhum período encontrado para o intervalo selecionado." />
              ) : (
                <table className="w-full text-xs border-collapse min-w-[900px]">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-2 font-semibold text-muted-foreground">Período</th>
                      <th className="text-right py-2 px-2 font-semibold text-muted-foreground">Faturamento</th>
                      <th className="text-right py-2 px-2 font-semibold text-muted-foreground">Frete</th>
                      <th className="text-right py-2 px-2 font-semibold text-muted-foreground">Rec. Produtos</th>
                      <th className="text-right py-2 px-2 font-semibold text-muted-foreground">Custo Total</th>
                      <th className="text-right py-2 px-2 font-semibold text-muted-foreground">Saldo Bruto</th>
                      <th className="text-right py-2 px-2 font-semibold text-muted-foreground">Mg. Bruta</th>
                      <th className="text-right py-2 px-2 font-semibold text-muted-foreground">Produção (t)</th>
                      <th className="text-right py-2 px-2 font-semibold text-muted-foreground">Custo/t</th>
                      <th className="text-right py-2 px-2 font-semibold text-muted-foreground">Combustível (L)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {serie.map((p, i) => (
                      <tr key={i} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                        <td className="py-2 px-2 font-semibold text-foreground">{p.label}</td>
                        <td className="py-2 px-2 text-right font-mono text-emerald-600">
                          {p.faturamento > 0 ? `R$ ${fmt(p.faturamento)}` : "—"}
                        </td>
                        <td className="py-2 px-2 text-right font-mono text-amber-600">
                          {p.frete > 0 ? `R$ ${fmt(p.frete)}` : "—"}
                        </td>
                        <td className="py-2 px-2 text-right font-mono text-blue-600">
                          {(p.faturamento - p.frete) > 0 ? `R$ ${fmt(p.faturamento - p.frete)}` : "—"}
                        </td>
                        <td className="py-2 px-2 text-right font-mono text-red-500">
                          {p.custoTotal > 0 ? `R$ ${fmt(p.custoTotal)}` : "—"}
                        </td>
                        <td className={`py-2 px-2 text-right font-mono font-semibold ${p.saldoBruto >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                          {p.temCusto || p.temVendas ? `R$ ${fmt(p.saldoBruto)}` : "—"}
                        </td>
                        <td className={`py-2 px-2 text-right font-mono font-semibold ${p.margemBruta >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                          {p.temCusto && p.temVendas ? fmtPct(p.margemBruta) : "—"}
                        </td>
                        <td className="py-2 px-2 text-right font-mono text-foreground">
                          {p.producaoTotal > 0 ? fmt(p.producaoTotal, 0) : "—"}
                        </td>
                        <td className="py-2 px-2 text-right font-mono text-foreground">
                          {p.custoTon > 0 ? `R$ ${fmt(p.custoTon, 2)}` : "—"}
                        </td>
                        <td className="py-2 px-2 text-right font-mono text-orange-600">
                          {p.combustivelLitros > 0 ? fmt(p.combustivelLitros, 0) : "—"}
                        </td>
                      </tr>
                    ))}
                    {/* Linha de totais */}
                    <tr className="border-t-2 border-border bg-muted/30 font-bold">
                      <td className="py-2 px-2 text-foreground">TOTAL</td>
                      <td className="py-2 px-2 text-right font-mono text-emerald-600">R$ {fmt(totalFaturamento)}</td>
                      <td className="py-2 px-2 text-right font-mono text-amber-600">R$ {fmt(serie.reduce((s, p) => s + p.frete, 0))}</td>
                      <td className="py-2 px-2 text-right font-mono text-blue-600">R$ {fmt(serie.reduce((s, p) => s + (p.faturamento - p.frete), 0))}</td>
                      <td className="py-2 px-2 text-right font-mono text-red-500">R$ {fmt(totalCusto)}</td>
                      <td className={`py-2 px-2 text-right font-mono ${(totalFaturamento - totalCusto) >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                        R$ {fmt(serie.reduce((s, p) => s + p.saldoBruto, 0))}
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-muted-foreground">—</td>
                      <td className="py-2 px-2 text-right font-mono text-foreground">{fmt(totalProducao, 0)} t</td>
                      <td className="py-2 px-2 text-right font-mono text-foreground">
                        {totalProducao > 0 ? `R$ ${fmt(totalCusto / totalProducao, 2)}` : "—"}
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-orange-600">{fmt(totalCombustivel, 0)} L</td>
                    </tr>
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
