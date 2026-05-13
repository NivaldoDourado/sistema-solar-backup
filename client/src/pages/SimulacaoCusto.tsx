import { useState, useMemo, Fragment } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  TrendingUp, TrendingDown, Minus, AlertTriangle, Info,
  CheckCircle2, Activity, BarChart3, Fuel, Factory,
  Calendar, Target, ArrowRight, Pencil, Save, X, ShieldAlert,
  ChevronDown, ChevronUp, Scale, Truck, DollarSign, Layers
} from "lucide-react";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const ANO_ATUAL = new Date().getFullYear();
const ANOS = Array.from({ length: 3 }, (_, i) => ANO_ATUAL - 1 + i);

function formatMoney(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatTon(v: number): string {
  return v.toLocaleString("pt-BR", { maximumFractionDigits: 0 }) + " t";
}

function formatPct(v: number): string {
  return v.toFixed(1).replace(".", ",") + "%";
}

function TendenciaIcon({ tendencia }: { tendencia: "subindo" | "estavel" | "descendo" }) {
  if (tendencia === "subindo") return <TrendingUp className="h-4 w-4 text-red-500" />;
  if (tendencia === "descendo") return <TrendingDown className="h-4 w-4 text-emerald-500" />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
}

export default function SimulacaoCusto() {
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [ano, setAno] = useState(ANO_ATUAL);
  const [editandoMeta, setEditandoMeta] = useState(false);
  const [metaInput, setMetaInput] = useState("");
  const { data: simulacao, isLoading } = trpc.simulacaoCusto.simular.useQuery({ mes, ano });
  const { data: metaData } = trpc.simulacaoCusto.getMeta.useQuery();
  const utils = trpc.useUtils();
  const setMetaMutation = trpc.simulacaoCusto.setMeta.useMutation({
    onSuccess: () => {
      utils.simulacaoCusto.getMeta.invalidate();
      setEditandoMeta(false);
      toast.success("Meta de custo por tonelada atualizada com sucesso.");
    },
    onError: () => {
      toast.error("Não foi possível salvar a meta.");
    },
  });

  const [mostrarAnalise, setMostrarAnalise] = useState(false);
  const { data: analiseMeta } = trpc.simulacaoCusto.analiseMeta.useQuery(
    { mes, ano },
    { enabled: metaData?.valor != null }
  );

  const metaValor = metaData?.valor ?? null;
  const metaUltrapassada = metaValor !== null && simulacao && simulacao.custoTonProjetado > 0 && simulacao.custoTonProjetado > metaValor;

  function handleSalvarMeta() {
    const valor = parseFloat(metaInput.replace(",", "."));
    if (isNaN(valor) || valor <= 0) {
      toast.error("Informe um valor numérico positivo.");
      return;
    }
    setMetaMutation.mutate({ valor });
  }

  const progressoPeriodo = simulacao
    ? Math.min(100, (simulacao.diasTranscorridos / simulacao.diasNoMes) * 100)
    : 0;

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            Simulação de Custos
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Projeção do custo mensal baseada em dados parciais e comportamento histórico
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MESES.map((m, i) => (
                <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ANOS.map((a) => (
                <SelectItem key={a} value={String(a)}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="ml-3 text-muted-foreground">Calculando projeção...</span>
        </div>
      )}

      {simulacao && (
        <>
          {/* Alertas */}
          {simulacao.alertas.length > 0 && (
            <div className="space-y-2">
              {simulacao.alertas.map((alerta, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-2 p-3 rounded-lg text-sm border ${
                    alerta.tipo === "alerta"
                      ? "bg-amber-50 border-amber-200 text-amber-800"
                      : alerta.tipo === "sucesso"
                      ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                      : "bg-blue-50 border-blue-200 text-blue-800"
                  }`}
                >
                  {alerta.tipo === "alerta" ? (
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                  ) : alerta.tipo === "sucesso" ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                  ) : (
                    <Info className="h-4 w-4 shrink-0" />
                  )}
                  <span>{alerta.mensagem}</span>
                </div>
              ))}
            </div>
          )}

          {/* Alerta de Meta Ultrapassada */}
          {metaUltrapassada && (
            <div className="flex items-center gap-3 p-4 rounded-lg border-2 border-red-400 bg-red-50 text-red-800 animate-pulse">
              <ShieldAlert className="h-6 w-6 shrink-0 text-red-600" />
              <div>
                <p className="font-bold text-sm">Meta de Custo/t Ultrapassada!</p>
                <p className="text-xs mt-0.5">
                  Projeção: <strong>{formatMoney(simulacao!.custoTonProjetado)}/t</strong> — Meta: <strong>{formatMoney(metaValor!)}/t</strong>
                  {" "}— Desvio: <strong className="text-red-700">+{formatPct(((simulacao!.custoTonProjetado - metaValor!) / metaValor!) * 100)}</strong> acima da meta
                </p>
              </div>
            </div>
          )}

          {/* Card Meta de Custo/t */}
          <Card className={metaUltrapassada ? "border-red-300 bg-red-50/30" : ""}>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Meta de Custo por Tonelada</span>
                </div>
                <div className="flex items-center gap-2">
                  {!editandoMeta ? (
                    <>
                      {metaValor !== null ? (
                        <span className={`font-mono font-bold text-lg ${metaUltrapassada ? "text-red-700" : "text-emerald-700"}`}>
                          {formatMoney(metaValor)}/t
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground italic">Não definida</span>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setMetaInput(metaValor !== null ? metaValor.toFixed(2).replace(".", ",") : "");
                          setEditandoMeta(true);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">R$</span>
                      <Input
                        className="w-32 h-8 font-mono text-right"
                        placeholder="0,00"
                        value={metaInput}
                        onChange={(e) => setMetaInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleSalvarMeta(); if (e.key === "Escape") setEditandoMeta(false); }}
                        autoFocus
                      />
                      <span className="text-sm text-muted-foreground">/t</span>
                      <Button variant="ghost" size="sm" onClick={handleSalvarMeta} disabled={setMetaMutation.isPending}>
                        <Save className="h-3.5 w-3.5 text-emerald-600" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setEditandoMeta(false)}>
                        <X className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
              {metaValor !== null && simulacao && simulacao.custoTonProjetado > 0 && (
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                    <span>Projeção atual vs Meta</span>
                    <span>{formatPct((simulacao.custoTonProjetado / metaValor) * 100)} da meta</span>
                  </div>
                  <div className="w-full h-3 bg-muted rounded-full overflow-hidden relative">
                    <div
                      className={`h-full rounded-full transition-all ${metaUltrapassada ? "bg-red-500" : "bg-emerald-500"}`}
                      style={{ width: `${Math.min(150, (simulacao.custoTonProjetado / metaValor) * 100)}%` }}
                    />
                    {/* Linha da meta (100%) */}
                    <div className="absolute top-0 bottom-0 w-0.5 bg-gray-800" style={{ left: "100%" }} />
                  </div>
                  <div className="flex justify-between mt-1 text-xs">
                    <span className={metaUltrapassada ? "text-red-600 font-medium" : "text-emerald-600 font-medium"}>
                      {formatMoney(simulacao.custoTonProjetado)}/t
                    </span>
                    <span className="text-muted-foreground font-medium">
                      Meta: {formatMoney(metaValor)}/t
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Análise de Requisitos para Atingir a Meta */}
          {metaValor !== null && analiseMeta && (
            <Card className="border-primary/30">
              <CardHeader className="pb-3 cursor-pointer" onClick={() => setMostrarAnalise(!mostrarAnalise)}>
                <CardTitle className="text-base flex items-center gap-2">
                  <Scale className="h-4 w-4 text-primary" />
                  O que é necessário para atingir a meta de {formatMoney(analiseMeta.meta)}/t
                  <Badge variant={analiseMeta.situacaoAtual.desvioPercentual > 0 ? "destructive" : "default"} className="ml-2 text-xs">
                    {analiseMeta.situacaoAtual.desvioPercentual > 0 ? "+" : ""}{formatPct(analiseMeta.situacaoAtual.desvioPercentual)} acima
                  </Badge>
                  <span className="ml-auto">
                    {mostrarAnalise ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </span>
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Análise baseada na média dos últimos {analiseMeta.situacaoAtual.periodosAnalisados} meses — Custo médio: {formatMoney(analiseMeta.situacaoAtual.custoTotalMedio)} | Produção média: {formatTon(analiseMeta.situacaoAtual.producaoMedia)} | Custo/t atual: {formatMoney(analiseMeta.situacaoAtual.custoTonAtual)}/t
                </p>
              </CardHeader>
              {mostrarAnalise && (
                <CardContent className="space-y-6">
                  {/* Cenário 1: Aumentar Produção */}
                  <div className="p-4 rounded-lg border bg-blue-50/50 border-blue-200">
                    <div className="flex items-center gap-2 mb-3">
                      <Factory className="h-4 w-4 text-blue-600" />
                      <h4 className="font-semibold text-sm text-blue-900">Cenário 1: Aumentar Produção (mantendo custos atuais)</h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="text-center p-3 bg-white rounded-lg shadow-sm">
                        <p className="text-xs text-muted-foreground mb-1">Produção Necessária</p>
                        <p className="font-mono font-bold text-lg text-blue-700">{formatTon(analiseMeta.cenario1_producao.producaoNecessaria)}</p>
                        <p className="text-xs text-blue-600 mt-1">
                          {analiseMeta.cenario1_producao.aumentoPercentual > 0 ? "+" : ""}{formatPct(analiseMeta.cenario1_producao.aumentoPercentual)} vs média atual
                        </p>
                      </div>
                      <div className="text-center p-3 bg-white rounded-lg shadow-sm">
                        <p className="text-xs text-muted-foreground mb-1">Vendas Necessárias</p>
                        <p className="font-mono font-bold text-lg text-blue-700">{formatTon(analiseMeta.cenario1_producao.vendasNecessarias)}</p>
                        <p className="text-xs text-muted-foreground mt-1">baseado na relação histórica</p>
                      </div>
                      <div className="text-center p-3 bg-white rounded-lg shadow-sm">
                        <p className="text-xs text-muted-foreground mb-1">Custo Total (mantido)</p>
                        <p className="font-mono font-bold text-lg">{formatMoney(analiseMeta.situacaoAtual.custoTotalMedio)}</p>
                        <p className="text-xs text-muted-foreground mt-1">sem alteração</p>
                      </div>
                    </div>
                  </div>

                  {/* Cenário 2: Reduzir Custos */}
                  <div className="p-4 rounded-lg border bg-emerald-50/50 border-emerald-200">
                    <div className="flex items-center gap-2 mb-3">
                      <DollarSign className="h-4 w-4 text-emerald-600" />
                      <h4 className="font-semibold text-sm text-emerald-900">Cenário 2: Reduzir Custos (mantendo produção atual)</h4>
                      <Badge variant="outline" className="ml-auto text-xs">
                        Redução necessária: {formatPct(analiseMeta.cenario2_custo.reducaoPercentual)}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div className="text-center p-3 bg-white rounded-lg shadow-sm">
                        <p className="text-xs text-muted-foreground mb-1">Custo Total Máximo</p>
                        <p className="font-mono font-bold text-lg text-emerald-700">{formatMoney(analiseMeta.cenario2_custo.custoTotalMaximo)}</p>
                        <p className="text-xs text-emerald-600 mt-1">para atingir {formatMoney(analiseMeta.meta)}/t</p>
                      </div>
                      <div className="text-center p-3 bg-white rounded-lg shadow-sm">
                        <p className="text-xs text-muted-foreground mb-1">Produção (mantida)</p>
                        <p className="font-mono font-bold text-lg">{formatTon(analiseMeta.situacaoAtual.producaoMedia)}</p>
                        <p className="text-xs text-muted-foreground mt-1">sem alteração</p>
                      </div>
                    </div>

                    {/* Tabela de contas com valor máximo */}
                    <div className="mt-3">
                      <p className="text-xs font-semibold text-emerald-800 mb-2 flex items-center gap-1">
                        <Layers className="h-3.5 w-3.5" />
                        Valor máximo por conta do Plano de Contas:
                      </p>
                      <div className="bg-white rounded-lg border overflow-hidden">
                        <div className="grid grid-cols-12 gap-1 px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b bg-muted/30">
                          <div className="col-span-4">Conta</div>
                          <div className="col-span-2 text-right">Média Atual</div>
                          <div className="col-span-2 text-right">Máximo Meta</div>
                          <div className="col-span-2 text-right">Redução</div>
                          <div className="col-span-2 text-right">Participação</div>
                        </div>
                        {analiseMeta.cenario2_custo.contasComMeta.map((conta, i) => (
                          <div
                            key={i}
                            className={`grid grid-cols-12 gap-1 px-3 py-2 text-xs items-center ${i % 2 === 0 ? 'bg-white' : 'bg-muted/20'} hover:bg-muted/40`}
                          >
                            <div className="col-span-4 font-medium truncate" title={conta.nome}>{conta.nome}</div>
                            <div className="col-span-2 text-right font-mono">{formatMoney(conta.mediaAtual)}</div>
                            <div className="col-span-2 text-right font-mono font-semibold text-emerald-700">{formatMoney(conta.valorMaximo)}</div>
                            <div className="col-span-2 text-right">
                              <span className={`font-mono ${conta.reducaoNecessaria > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                {conta.reducaoNecessaria > 0 ? "-" : ""}{formatPct(Math.abs(conta.reducaoNecessaria))}
                              </span>
                            </div>
                            <div className="col-span-2 text-right font-mono text-muted-foreground">{formatPct(conta.participacao)}</div>
                          </div>
                        ))}
                        {/* Total */}
                        <div className="grid grid-cols-12 gap-1 px-3 py-2.5 text-xs font-bold border-t bg-muted/50">
                          <div className="col-span-4">TOTAL</div>
                          <div className="col-span-2 text-right font-mono">{formatMoney(analiseMeta.situacaoAtual.custoTotalMedio)}</div>
                          <div className="col-span-2 text-right font-mono text-emerald-700">{formatMoney(analiseMeta.cenario2_custo.custoTotalMaximo)}</div>
                          <div className="col-span-2 text-right font-mono text-red-600">-{formatPct(analiseMeta.cenario2_custo.reducaoPercentual)}</div>
                          <div className="col-span-2 text-right font-mono">100,0%</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Cenário 3: Equilibrado */}
                  <div className="p-4 rounded-lg border bg-purple-50/50 border-purple-200">
                    <div className="flex items-center gap-2 mb-3">
                      <Target className="h-4 w-4 text-purple-600" />
                      <h4 className="font-semibold text-sm text-purple-900">Cenário 3: Equilibrado (aumentar produção + reduzir custos)</h4>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">
                      Distribuição proporcional do esforço entre aumento de produção e redução de custos (método da raiz quadrada).
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="text-center p-3 bg-white rounded-lg shadow-sm">
                        <p className="text-xs text-muted-foreground mb-1">Produção Sugerida</p>
                        <p className="font-mono font-bold text-lg text-purple-700">{formatTon(analiseMeta.cenario3_equilibrado.producaoSugerida)}</p>
                        <p className="text-xs text-purple-600 mt-1">
                          +{formatPct(analiseMeta.cenario3_equilibrado.aumentoProducao)} vs atual
                        </p>
                      </div>
                      <div className="text-center p-3 bg-white rounded-lg shadow-sm">
                        <p className="text-xs text-muted-foreground mb-1">Custo Total Sugerido</p>
                        <p className="font-mono font-bold text-lg text-purple-700">{formatMoney(analiseMeta.cenario3_equilibrado.custoTotalSugerido)}</p>
                        <p className="text-xs text-purple-600 mt-1">
                          -{formatPct(analiseMeta.cenario3_equilibrado.reducaoCusto)} vs atual
                        </p>
                      </div>
                      <div className="text-center p-3 bg-white rounded-lg shadow-sm">
                        <p className="text-xs text-muted-foreground mb-1">Vendas Sugeridas</p>
                        <p className="font-mono font-bold text-lg text-purple-700">{formatTon(analiseMeta.cenario3_equilibrado.vendasSugeridas)}</p>
                        <p className="text-xs text-muted-foreground mt-1">baseado na relação histórica</p>
                      </div>
                    </div>
                  </div>

                  {/* Nota metodológica */}
                  <div className="p-3 rounded-lg bg-muted/30 border-dashed border">
                    <p className="text-xs text-muted-foreground flex items-start gap-2">
                      <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      <span>
                        <strong>Metodologia:</strong> Os cenários são calculados com base na média ponderada dos últimos 3 meses.
                        O Cenário 1 mantém o custo total e calcula a produção necessária (Produção = Custo / Meta).
                        O Cenário 2 mantém a produção e distribui o custo máximo proporcionalmente pela participação histórica de cada conta.
                        O Cenário 3 usa a raiz quadrada do desvio para equilibrar o esforço entre produção e custo.
                        As vendas são estimadas pela relação histórica vendas/produção.
                      </span>
                    </p>
                  </div>
                </CardContent>
              )}
            </Card>
          )}

          {/* Progresso do período */}
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Progresso do Período</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {simulacao.diasTranscorridos} de {simulacao.diasNoMes} dias
                </span>
              </div>
              <Progress value={progressoPeriodo} className="h-2" />
              <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                <span>{simulacao.periodo.dataInicio}</span>
                <span>Corte: {simulacao.periodo.corte}</span>
                <span>{simulacao.periodo.dataFim}</span>
              </div>
            </CardContent>
          </Card>

          {/* Cards principais */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Produção */}
            <Card className="border-l-4 border-l-blue-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Factory className="h-4 w-4" />
                  Produção
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Acumulada</p>
                    <p className="font-mono font-bold text-lg">{formatTon(simulacao.producaoAcumulada)}</p>
                  </div>
                  <Separator />
                  <div>
                    <p className="text-xs text-muted-foreground">Projetada (mês)</p>
                    <p className="font-mono font-semibold text-blue-700">{formatTon(simulacao.producaoProjetada)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Média 3 meses</p>
                    <p className="font-mono text-sm">{formatTon(simulacao.producaoMedia3Meses)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Combustível */}
            <Card className="border-l-4 border-l-amber-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Fuel className="h-4 w-4" />
                  Combustível
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Acumulado</p>
                    <p className="font-mono font-bold text-lg">{formatMoney(simulacao.combustivelAcumulado)}</p>
                  </div>
                  <Separator />
                  <div>
                    <p className="text-xs text-muted-foreground">Projetado (mês)</p>
                    <p className="font-mono font-semibold text-amber-700">{formatMoney(simulacao.combustivelProjetado)}</p>
                  </div>
                  <p className="text-xs text-muted-foreground italic">Baseado em dados reais do período</p>
                </div>
              </CardContent>
            </Card>

            {/* Custo Total Projetado */}
            <Card className="border-l-4 border-l-red-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Custo Total Projetado
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="font-mono font-bold text-xl text-red-700">{formatMoney(simulacao.custoTotalProjetado)}</p>
                  <div className="flex items-center gap-1">
                    {simulacao.variacaoCusto > 0 ? (
                      <TrendingUp className="h-4 w-4 text-red-500" />
                    ) : simulacao.variacaoCusto < 0 ? (
                      <TrendingDown className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <Minus className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className={`text-sm font-medium ${simulacao.variacaoCusto > 0 ? "text-red-600" : simulacao.variacaoCusto < 0 ? "text-emerald-600" : ""}`}>
                      {simulacao.variacaoCusto > 0 ? "+" : ""}{formatPct(simulacao.variacaoCusto)}
                    </span>
                    <span className="text-xs text-muted-foreground">vs média 3m</span>
                  </div>
                  <Separator />
                  <div>
                    <p className="text-xs text-muted-foreground">Média 3 meses</p>
                    <p className="font-mono text-sm">{formatMoney(simulacao.custoTotalMedio3Meses)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Custo por Tonelada */}
            <Card className="border-l-4 border-l-purple-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Custo por Tonelada
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="font-mono font-bold text-xl text-purple-700">
                    {simulacao.custoTonProjetado > 0 ? formatMoney(simulacao.custoTonProjetado) + "/t" : "—"}
                  </p>
                  <Separator />
                  <div>
                    <p className="text-xs text-muted-foreground">Média 3 meses</p>
                    <p className="font-mono text-sm">
                      {simulacao.custoTonMedio3Meses > 0 ? formatMoney(simulacao.custoTonMedio3Meses) + "/t" : "—"}
                    </p>
                  </div>
                  {simulacao.custoTonProjetado > 0 && simulacao.custoTonMedio3Meses > 0 && (
                    <div className="flex items-center gap-1">
                      {simulacao.custoTonProjetado > simulacao.custoTonMedio3Meses ? (
                        <TrendingUp className="h-3 w-3 text-red-500" />
                      ) : (
                        <TrendingDown className="h-3 w-3 text-emerald-500" />
                      )}
                      <span className={`text-xs ${simulacao.custoTonProjetado > simulacao.custoTonMedio3Meses ? "text-red-600" : "text-emerald-600"}`}>
                        {formatPct(((simulacao.custoTonProjetado - simulacao.custoTonMedio3Meses) / simulacao.custoTonMedio3Meses) * 100)} vs média
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detalhamento por Setor */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                Projeção por Setor
                <Badge variant="secondary" className="text-xs ml-auto">
                  Baseado na média dos últimos 3 meses
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {/* Header */}
                <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b">
                  <div className="col-span-5">Setor</div>
                  <div className="col-span-3 text-right">Projetado</div>
                  <div className="col-span-2 text-right">Média 3m</div>
                  <div className="col-span-2 text-right">Tendência</div>
                </div>
                {/* Rows */}
                {simulacao.setoresProjetados.map((setor, i) => {
                  const total = simulacao.custoTotalProjetado;
                  const pct = total > 0 ? (setor.projetado / total) * 100 : 0;
                  return (
                    <div
                      key={i}
                      className="grid grid-cols-12 gap-2 px-3 py-2.5 rounded-lg hover:bg-muted/50 items-center"
                    >
                      <div className="col-span-5 flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{setor.grupoNome}</span>
                        <Badge variant="outline" className="text-xs shrink-0">{formatPct(pct)}</Badge>
                      </div>
                      <div className="col-span-3 text-right">
                        <span className="font-mono text-sm font-semibold">{formatMoney(setor.projetado)}</span>
                      </div>
                      <div className="col-span-2 text-right">
                        <span className="font-mono text-xs text-muted-foreground">{formatMoney(setor.media3Meses)}</span>
                      </div>
                      <div className="col-span-2 flex items-center justify-end gap-1">
                        <TendenciaIcon tendencia={setor.tendencia} />
                        <span className="text-xs text-muted-foreground capitalize">{setor.tendencia}</span>
                      </div>
                    </div>
                  );
                })}
                {/* Total */}
                <Separator className="my-2" />
                <div className="grid grid-cols-12 gap-2 px-3 py-2.5 font-bold bg-muted/50 rounded-lg">
                  <div className="col-span-5 text-sm">TOTAL PROJETADO</div>
                  <div className="col-span-3 text-right">
                    <span className="font-mono text-sm">{formatMoney(simulacao.custoTotalProjetado)}</span>
                  </div>
                  <div className="col-span-2 text-right">
                    <span className="font-mono text-xs text-muted-foreground">{formatMoney(simulacao.custoTotalMedio3Meses)}</span>
                  </div>
                  <div className="col-span-2"></div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Histórico dos últimos 3 meses */}
          {simulacao.historico.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  Histórico Recente (base da projeção)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {simulacao.historico.map((h, i) => (
                    <div key={i} className="p-4 rounded-lg border bg-muted/30">
                      <p className="text-sm font-semibold mb-3">{MESES[h.mes - 1]}/{h.ano}</p>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-xs text-muted-foreground">Custo Total</span>
                          <span className="font-mono text-sm">{formatMoney(h.custoTotal)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-xs text-muted-foreground">Produção</span>
                          <span className="font-mono text-sm">{formatTon(h.producaoTotal)}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between">
                          <span className="text-xs text-muted-foreground font-medium">Custo/t</span>
                          <span className="font-mono text-sm font-semibold">
                            {h.custoTon > 0 ? formatMoney(h.custoTon) + "/t" : "—"}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {/* Comparativo visual */}
                <div className="mt-4 p-4 rounded-lg bg-primary/5 border border-primary/20">
                  <div className="flex items-center gap-2 mb-2">
                    <ArrowRight className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold">Projeção {MESES[mes - 1]}/{ano}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-xs text-muted-foreground">Custo Total</p>
                      <p className="font-mono font-bold text-primary">{formatMoney(simulacao.custoTotalProjetado)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Produção</p>
                      <p className="font-mono font-bold text-primary">{formatTon(simulacao.producaoProjetada)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Custo/t</p>
                      <p className="font-mono font-bold text-primary">
                        {simulacao.custoTonProjetado > 0 ? formatMoney(simulacao.custoTonProjetado) + "/t" : "—"}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Nota metodológica */}
          <Card className="border-dashed">
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground flex items-start gap-2">
                <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>
                  <strong>Metodologia:</strong> A projeção utiliza dados reais do período parcial (produção e combustível) 
                  extrapolados proporcionalmente para o mês completo. Os demais setores são estimados pela média dos últimos 
                  3 meses fechados. O custo por tonelada é calculado dividindo o custo total projetado pela produção projetada 
                  (Método Caminhões). Quanto mais dias transcorridos, maior a precisão da simulação.
                </span>
              </p>
            </CardContent>
          </Card>
        </>
      )}

      {!isLoading && !simulacao && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Activity className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold text-muted-foreground">Sem dados para simulação</h3>
          <p className="text-sm text-muted-foreground mt-1">
            É necessário ter pelo menos 1 mês de histórico de custos fechado para gerar projeções.
          </p>
        </div>
      )}
    </div>
  );
}
