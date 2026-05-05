import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  TrendingUp, TrendingDown, DollarSign, Truck, Building2,
  Calculator, Save, BarChart3, AlertCircle, CheckCircle2,
  ChevronDown, ChevronUp, Info
} from "lucide-react";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const ANO_ATUAL = new Date().getFullYear();
const ANOS = Array.from({ length: 6 }, (_, i) => ANO_ATUAL - 2 + i);

function parseMoney(v: string): number {
  if (!v) return 0;
  return parseFloat(v.replace(/\./g, "").replace(",", ".")) || 0;
}

function formatMoney(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatPct(v: number): string {
  return v.toFixed(2).replace(".", ",") + "%";
}

interface FormState {
  frete: string;
  investEquip: string;
  investBritagem: string;
  difFrete: string;
  difImpostos: string;
  distribLucro: string;
  outros: string;
  observacoes: string;
}

const EMPTY_FORM: FormState = {
  frete: "",
  investEquip: "",
  investBritagem: "",
  difFrete: "",
  difImpostos: "",
  distribLucro: "",
  outros: "",
  observacoes: "",
};

function MoneyInput({
  label, value, onChange, hint
}: { label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-sm font-medium text-foreground">{label}</Label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
        <Input
          className="pl-9 text-right font-mono"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0,00"
        />
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function ResultRow({
  label, value, pct, highlight, isTotal, isNegative, badge
}: {
  label: string; value: number; pct?: number; highlight?: boolean;
  isTotal?: boolean; isNegative?: boolean; badge?: string;
}) {
  const valueColor = isNegative ? "text-red-500" : value >= 0 ? "text-emerald-600" : "text-red-500";
  return (
    <div className={`flex items-center justify-between py-2 px-3 rounded-lg ${highlight ? "bg-muted/50 border border-border" : ""} ${isTotal ? "font-bold" : ""}`}>
      <div className="flex items-center gap-2">
        <span className={`text-sm ${isTotal ? "font-semibold" : "text-muted-foreground"}`}>{label}</span>
        {badge && <Badge variant="outline" className="text-xs">{badge}</Badge>}
      </div>
      <div className="flex items-center gap-4">
        {pct !== undefined && (
          <span className="text-xs text-muted-foreground font-mono">{formatPct(pct)}</span>
        )}
        <span className={`font-mono text-sm ${isTotal ? "text-base " + valueColor : valueColor}`}>
          {formatMoney(value)}
        </span>
      </div>
    </div>
  );
}

export default function AvaliacaoGlobal() {

  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [ano, setAno] = useState(ANO_ATUAL);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [showBlocoD, setShowBlocoD] = useState(true);

  // Queries
  const { data: avaliacao, refetch } = trpc.avaliacaoGlobal.getByPeriodo.useQuery({ mes, ano });
  // Calcular datas do período para buscar resumo de vendas
  const periodoInicio = `${ano}-${String(mes).padStart(2, "0")}-01`;
  const lastDay = new Date(ano, mes, 0).getDate();
  const periodoFim = `${ano}-${String(mes).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  const { data: resumoVendas } = trpc.vendas.resumoVendasParaPeriodoCusto.useQuery({ periodoInicio, periodoFim });
  const { data: periodos } = trpc.periodoCusto.list.useQuery();

  // Buscar custo total do período de custo correspondente
  const periodoAtual = periodos?.find((p: { mes: number; ano: number }) => p.mes === mes && p.ano === ano);
  const { data: relatorioSetor } = trpc.custoSetor.relatorio.useQuery(
    { periodoCustoId: periodoAtual?.id ?? 0 },
    { enabled: !!periodoAtual?.id }
  );

  // Mutation
  const upsert = trpc.avaliacaoGlobal.upsert.useMutation({
    onSuccess: () => {
      toast.success("Avaliação Global salva com sucesso!");
      refetch();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  // Preencher formulário quando carregar dados existentes
  // Converte valor decimal americano do banco ("1552995.14") para formato BR de exibição ("1.552.995,14")
  const dbToDisplay = (v: string | null | undefined): string => {
    if (!v || v === "0" || v === "0.00") return "";
    const num = parseFloat(v);
    if (isNaN(num)) return "";
    return num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  useEffect(() => {
    if (avaliacao) {
      setForm({
        frete: dbToDisplay(avaliacao.frete),
        investEquip: dbToDisplay(avaliacao.investEquip),
        investBritagem: dbToDisplay(avaliacao.investBritagem),
        difFrete: dbToDisplay(avaliacao.difFrete),
        difImpostos: dbToDisplay(avaliacao.difImpostos),
        distribLucro: dbToDisplay(avaliacao.distribLucro),
        outros: dbToDisplay(avaliacao.outros),
        observacoes: avaliacao.observacoes ?? "",
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [avaliacao]);

  // Valores automáticos do sistema
  const faturamento = resumoVendas?.totalReceita ?? 0;
  const custos = relatorioSetor?.totalGeral ?? 0;

  // Valores manuais
  const frete = parseMoney(form.frete);
  const investEquip = parseMoney(form.investEquip);
  const investBritagem = parseMoney(form.investBritagem);
  const difFrete = parseMoney(form.difFrete);
  const difImpostos = parseMoney(form.difImpostos);
  const distribLucro = parseMoney(form.distribLucro);
  const outros = parseMoney(form.outros);

  // Cálculos
  const receitaProdutos = faturamento - frete;
  const saldoBruto = faturamento - custos - frete;
  const margemBruta = faturamento > 0 ? (saldoBruto / faturamento) * 100 : 0;
  const totalD = investEquip + investBritagem + difFrete + difImpostos + distribLucro + outros;
  const saldoFinal = saldoBruto - totalD;
  const margemFinal = faturamento > 0 ? (saldoFinal / faturamento) * 100 : 0;

  // Converte valor do formato brasileiro ("1.552.995,14") ou americano ("1552995.14") para string decimal americana
  const toDecimalStr = (v: string): string => {
    if (!v || v.trim() === "") return "0";
    const s = v.trim();
    // Se tem vírgula: formato brasileiro (pontos = milhar, vírgula = decimal)
    if (s.includes(",")) {
      return String(parseFloat(s.replace(/\./g, "").replace(",", ".")) || 0);
    }
    // Se não tem vírgula: pode ser americano (ponto = decimal) ou inteiro
    return String(parseFloat(s) || 0);
  };

  const handleSave = () => {
    upsert.mutate({
      mes, ano,
      frete: toDecimalStr(form.frete),
      investEquip: toDecimalStr(form.investEquip),
      investBritagem: toDecimalStr(form.investBritagem),
      difFrete: toDecimalStr(form.difFrete),
      difImpostos: toDecimalStr(form.difImpostos),
      distribLucro: toDecimalStr(form.distribLucro),
      outros: toDecimalStr(form.outros),
      observacoes: form.observacoes || undefined,
    });
  };

  const setField = (field: keyof FormState) => (v: string) => setForm((f) => ({ ...f, [field]: v }));

  const temDadosCusto = custos > 0;
  const temDadosVendas = faturamento > 0;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            Avaliação Global
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Análise do Lucro/Prejuízo — Estudo dos Custos pela Competência
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

      {/* Alertas de dados faltantes */}
      {(!temDadosVendas || !temDadosCusto) && (
        <div className="flex flex-col gap-2">
          {!temDadosVendas && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>Faturamento não disponível — importe o PDF de Resumo de Vendas em <strong>Vendas → Importar PDF</strong> para {MESES[mes - 1]}/{ano}.</span>
            </div>
          )}
          {!temDadosCusto && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-sm">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>Custo Total não disponível — importe a planilha CUSTOSOLAR em <strong>Apropriação de Custo → Importação</strong> para {MESES[mes - 1]}/{ano}.</span>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Coluna esquerda: Formulário de entrada */}
        <div className="space-y-4">
          {/* Bloco A — Dados automáticos */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-emerald-600" />
                Bloco A — Dados do Sistema
                <Badge variant="secondary" className="text-xs ml-auto">Automático</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                <div>
                  <p className="text-xs text-muted-foreground">Faturamento pela Competência (A)</p>
                  <p className="font-mono font-bold text-emerald-700">{formatMoney(faturamento)}</p>
                </div>
                {temDadosVendas ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-amber-500" />
                )}
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg bg-orange-50 border border-orange-200">
                <div>
                  <p className="text-xs text-muted-foreground">Despesas dos Custos pela Competência (B)</p>
                  <p className="font-mono font-bold text-orange-700">{formatMoney(custos)}</p>
                  <p className="text-xs text-muted-foreground">c/ Despesas Indiretas</p>
                </div>
                {temDadosCusto ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-blue-500" />
                )}
              </div>
            </CardContent>
          </Card>

          {/* Bloco C — Frete */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Truck className="h-4 w-4 text-blue-600" />
                Bloco C — Frete pela Competência
              </CardTitle>
            </CardHeader>
            <CardContent>
              <MoneyInput
                label="Frete pela Competência (C)"
                value={form.frete}
                onChange={setField("frete")}
                hint="Repasse total aos transportadores no período"
              />
            </CardContent>
          </Card>

          {/* Bloco D — Outros valores */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4 text-purple-600" />
                Bloco D — Valores fora dos Custos pela Competência
                <button
                  onClick={() => setShowBlocoD(!showBlocoD)}
                  className="ml-auto text-muted-foreground hover:text-foreground"
                >
                  {showBlocoD ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              </CardTitle>
            </CardHeader>
            {showBlocoD && (
              <CardContent className="space-y-4">
                <MoneyInput
                  label="D1 — Investimentos Compras Equipamentos/Terrenos/Afins"
                  value={form.investEquip}
                  onChange={setField("investEquip")}
                />
                <MoneyInput
                  label="D2 — Investimentos/Modificações Britagem/Processos/Afins"
                  value={form.investBritagem}
                  onChange={setField("investBritagem")}
                />
                <MoneyInput
                  label="D3 — Diferença Frete (Fluxo de Caixa x Competência)"
                  value={form.difFrete}
                  onChange={setField("difFrete")}
                />
                <MoneyInput
                  label="D4 — Diferença Impostos (Fluxo de Caixa x Competência)"
                  value={form.difImpostos}
                  onChange={setField("difImpostos")}
                />
                <MoneyInput
                  label="D5 — Distribuição de Lucro/Retirada Sócios e Afins"
                  value={form.distribLucro}
                  onChange={setField("distribLucro")}
                />
                <MoneyInput
                  label="D6 — Dif. Fluxo de Cx. que não são da Compet./Outros/Duplicatas"
                  value={form.outros}
                  onChange={setField("outros")}
                />
              </CardContent>
            )}
          </Card>

          {/* Observações */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Info className="h-4 w-4 text-muted-foreground" />
                Observações
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Observações sobre o período..."
                value={form.observacoes}
                onChange={(e) => setField("observacoes")(e.target.value)}
                rows={3}
              />
            </CardContent>
          </Card>

          <Button onClick={handleSave} disabled={upsert.isPending} className="w-full" size="lg">
            <Save className="h-4 w-4 mr-2" />
            {upsert.isPending ? "Salvando..." : "Salvar Avaliação Global"}
          </Button>
        </div>

        {/* Coluna direita: Resultados calculados */}
        <div className="space-y-4">
          <Card className="border-2 border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Calculator className="h-4 w-4 text-primary" />
                Resultado — {MESES[mes - 1]}/{ano}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {/* Bloco A */}
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-3 pt-2">
                Análise do Lucro/Prejuízo — Estudo dos Custos pela Competência
              </p>
              <ResultRow label="(A) Faturamento pela Competência" value={faturamento} />
              <ResultRow label="(B) Despesas dos Custos pela Competência" value={-custos} isNegative />
              <ResultRow label="(C) Frete pela Competência" value={-frete} isNegative />
              <Separator className="my-2" />
              <ResultRow
                label="Saldo Bruto (A-B-C)"
                value={saldoBruto}
                pct={margemBruta}
                highlight
                isTotal
                badge="Margem Bruta"
              />

              {/* Bloco D */}
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-3 pt-4">
                Valores fora dos Custos pela Competência
              </p>
              {investEquip > 0 && <ResultRow label="D1 — Invest. Equipamentos/Terrenos" value={-investEquip} isNegative />}
              {investBritagem > 0 && <ResultRow label="D2 — Invest. Britagem/Processos" value={-investBritagem} isNegative />}
              {difFrete > 0 && <ResultRow label="D3 — Dif. Frete (Cx. x Competência)" value={-difFrete} isNegative />}
              {difImpostos > 0 && <ResultRow label="D4 — Dif. Impostos (Cx. x Competência)" value={-difImpostos} isNegative />}
              {distribLucro > 0 && <ResultRow label="D5 — Distrib. Lucro/Retirada Sócios" value={-distribLucro} isNegative />}
              {outros > 0 && <ResultRow label="D6 — Outros/Duplicatas" value={-outros} isNegative />}
              {totalD > 0 && (
                <>
                  <Separator className="my-1" />
                  <ResultRow label="Total (D)" value={-totalD} isNegative isTotal />
                </>
              )}

              {/* Resultado final */}
              <Separator className="my-3" />
              <div className={`p-4 rounded-xl border-2 ${saldoFinal >= 0 ? "bg-emerald-50 border-emerald-300" : "bg-red-50 border-red-300"}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Saldo Final (A-B-C-D)</p>
                    <p className={`text-2xl font-bold font-mono mt-1 ${saldoFinal >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                      {formatMoney(saldoFinal)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Margem Final</p>
                    <div className="flex items-center gap-1 justify-end mt-1">
                      {margemFinal >= 0 ? (
                        <TrendingUp className="h-5 w-5 text-emerald-600" />
                      ) : (
                        <TrendingDown className="h-5 w-5 text-red-600" />
                      )}
                      <p className={`text-2xl font-bold ${margemFinal >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                        {formatPct(margemFinal)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* KPIs de apoio */}
              <div className="grid grid-cols-2 gap-2 pt-2">
                <div className="p-3 rounded-lg bg-muted/50 border">
                  <p className="text-xs text-muted-foreground">Receita dos Produtos</p>
                  <p className="font-mono font-semibold text-sm mt-1">{formatMoney(receitaProdutos)}</p>
                  <p className="text-xs text-muted-foreground">Faturamento − Frete</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 border">
                  <p className="text-xs text-muted-foreground">Custo / Receita Produtos</p>
                  <p className="font-mono font-semibold text-sm mt-1">
                    {receitaProdutos > 0 ? formatPct((custos / receitaProdutos) * 100) : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">Custos sobre receita líquida</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Referência da planilha */}
          <Card className="border-dashed">
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground flex items-start gap-2">
                <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                Os valores do <strong>Bloco A</strong> (Faturamento e Custos) são preenchidos automaticamente a partir dos dados importados no sistema. Os campos do <strong>Bloco C</strong> (Frete) e <strong>Bloco D</strong> (Investimentos e Diferenças de Caixa) devem ser informados manualmente a cada período.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
