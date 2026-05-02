import { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import {
  DollarSign, Save, ChevronDown, ChevronRight, Lock, AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const CLASSIFICACAO_LABELS: Record<string, string> = {
  custo_fixo: "Custo Fixo",
  custo_variavel: "Custo Variável",
  despesa_fixa: "Despesa Fixa",
  despesa_variavel: "Despesa Variável",
};

const CLASSIFICACAO_ORDER = ["custo_fixo", "custo_variavel", "despesa_fixa", "despesa_variavel"];

const CLASSIFICACAO_COLORS: Record<string, string> = {
  custo_fixo: "bg-blue-50 border-blue-200 text-blue-800",
  custo_variavel: "bg-green-50 border-green-200 text-green-800",
  despesa_fixa: "bg-orange-50 border-orange-200 text-orange-800",
  despesa_variavel: "bg-purple-50 border-purple-200 text-purple-800",
};

function fmt(val: number) {
  return val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseBR(val: string): number {
  // Aceita "1.234,56" ou "1234.56"
  const cleaned = val.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

export default function LancamentoCusto() {
  const anoAtual = new Date().getFullYear();
  const mesAtual = new Date().getMonth() + 1;

  const [selectedPeriodoId, setSelectedPeriodoId] = useState<number | null>(null);
  const [valores, setValores] = useState<Record<number, string>>({});
  const [expandidos, setExpandidos] = useState<Record<string, boolean>>({
    custo_fixo: true,
    custo_variavel: true,
    despesa_fixa: true,
    despesa_variavel: true,
  });
  const [saving, setSaving] = useState(false);

  const { canCreate, canEdit } = usePermissions();
  const utils = trpc.useUtils();

  // Buscar períodos disponíveis
  const { data: periodos } = trpc.periodoCusto.list.useQuery();

  // Buscar contas de custo ativas
  const { data: contas } = trpc.contasCusto.list.useQuery();

  // Buscar lançamentos do período selecionado
  const { data: lancamentos, refetch: refetchLancamentos } = trpc.lancamentoCusto.listByPeriodo.useQuery(
    { periodoCustoId: selectedPeriodoId! },
    { enabled: !!selectedPeriodoId }
  );

  // Período selecionado
  const periodoAtual = useMemo(
    () => periodos?.find((p) => p.id === selectedPeriodoId) ?? null,
    [periodos, selectedPeriodoId]
  );

  // Inicializar com o período mais recente
  useEffect(() => {
    if (periodos && periodos.length > 0 && !selectedPeriodoId) {
      setSelectedPeriodoId(periodos[0].id);
    }
  }, [periodos, selectedPeriodoId]);

  // Carregar valores dos lançamentos existentes
  useEffect(() => {
    if (lancamentos) {
      const novosValores: Record<number, string> = {};
      for (const l of lancamentos) {
        novosValores[l.contaCustoId] = parseFloat(String(l.valor || "0")).toFixed(2).replace(".", ",");
      }
      setValores(novosValores);
    }
  }, [lancamentos]);

  const batchUpsert = trpc.lancamentoCusto.batchUpsert.useMutation({
    onSuccess: (data) => {
      toast.success(`Lançamentos salvos! (${data.created} criados, ${data.updated} atualizados)`);
      refetchLancamentos();
      setSaving(false);
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao salvar lançamentos");
      setSaving(false);
    },
  });

  const handleSave = () => {
    if (!selectedPeriodoId) return;
    setSaving(true);
    const lancamentosParaSalvar = Object.entries(valores)
      .filter(([, v]) => parseBR(v) > 0)
      .map(([contaCustoId, valor]) => ({
        contaCustoId: Number(contaCustoId),
        valor: parseBR(valor).toFixed(2),
      }));

    if (lancamentosParaSalvar.length === 0) {
      toast.info("Nenhum valor para salvar.");
      setSaving(false);
      return;
    }

    batchUpsert.mutate({ periodoCustoId: selectedPeriodoId, lancamentos: lancamentosParaSalvar });
  };

  // Agrupar contas por classificação
  const contasPorClassificacao = useMemo(() => {
    if (!contas) return {};
    const grupos: Record<string, typeof contas> = {};
    for (const conta of contas) {
      if (conta.ativo === "nao") continue;
      const key = conta.classificacao ?? "custo_variavel";
      if (!grupos[key]) grupos[key] = [];
      grupos[key].push(conta);
    }
    return grupos;
  }, [contas]);

  // Totais por classificação
  const totaisPorClassificacao = useMemo(() => {
    const totais: Record<string, number> = {};
    for (const [classif, contas] of Object.entries(contasPorClassificacao)) {
      totais[classif] = contas.reduce((sum, c) => sum + parseBR(valores[c.id] ?? "0"), 0);
    }
    return totais;
  }, [contasPorClassificacao, valores]);

  const totalGeral = Object.values(totaisPorClassificacao).reduce((s, v) => s + v, 0);

  const periodoFechado = periodoAtual?.fechado === "sim";
  const podeEditar = (canCreate("custos") || canEdit("custos")) && !periodoFechado;

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <DollarSign className="h-8 w-8 text-primary" />
            Lançamento de Custos
          </h1>
          <p className="text-muted-foreground mt-1">
            Lance os valores de cada conta de custo por período mensal
          </p>
        </div>
        {podeEditar && (
          <Button onClick={handleSave} disabled={saving || !selectedPeriodoId} size="lg">
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Salvando..." : "Salvar Lançamentos"}
          </Button>
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
                onValueChange={(v) => {
                  setSelectedPeriodoId(Number(v));
                  setValores({});
                }}
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
                <Badge variant={periodoFechado ? "secondary" : "default"}>
                  {periodoFechado ? <><Lock className="h-3 w-3 mr-1" />Fechado</> : "Aberto"}
                </Badge>
                {periodoAtual.producaoTotal && (
                  <span className="text-sm text-muted-foreground">
                    Produção: <strong>{fmt(parseFloat(periodoAtual.producaoTotal))} t</strong>
                  </span>
                )}
                {periodoAtual.quantidadeVendida && (
                  <span className="text-sm text-muted-foreground">
                    Vendas: <strong>{fmt(parseFloat(periodoAtual.quantidadeVendida))} t</strong>
                  </span>
                )}
              </div>
            )}
          </div>

          {periodoFechado && (
            <div className="mt-3 flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>Este período está fechado. Os valores são somente leitura.</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Planilha de Lançamentos */}
      {selectedPeriodoId && (
        <div className="space-y-4">
          {CLASSIFICACAO_ORDER.map((classif) => {
            const contasGrupo = contasPorClassificacao[classif] ?? [];
            if (contasGrupo.length === 0) return null;
            const totalGrupo = totaisPorClassificacao[classif] ?? 0;
            const isExpanded = expandidos[classif] ?? true;

            return (
              <Card key={classif} className={`border ${CLASSIFICACAO_COLORS[classif]}`}>
                <CardHeader
                  className="pb-2 cursor-pointer"
                  onClick={() => setExpandidos((e) => ({ ...e, [classif]: !e[classif] }))}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      <CardTitle className="text-base">{CLASSIFICACAO_LABELS[classif]}</CardTitle>
                      <Badge variant="outline" className="text-xs">
                        {contasGrupo.length} conta{contasGrupo.length !== 1 ? "s" : ""}
                      </Badge>
                    </div>
                    <span className="font-bold text-base">
                      R$ {fmt(totalGrupo)}
                    </span>
                  </div>
                </CardHeader>

                {isExpanded && (
                  <CardContent className="pt-0">
                    <div className="rounded-md border bg-white">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Conta de Custo</TableHead>
                            <TableHead className="w-32">Divisor</TableHead>
                            <TableHead className="w-48 text-right">Valor (R$)</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {contasGrupo.map((conta) => (
                            <TableRow key={conta.id}>
                              <TableCell className="font-medium">{conta.nome}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">
                                  {conta.divisor === "producao" ? "Produção" : "Vendas"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <Input
                                  type="text"
                                  inputMode="decimal"
                                  value={valores[conta.id] ?? ""}
                                  onChange={(e) =>
                                    setValores((v) => ({ ...v, [conta.id]: e.target.value }))
                                  }
                                  onBlur={(e) => {
                                    const n = parseBR(e.target.value);
                                    if (!isNaN(n)) {
                                      setValores((v) => ({
                                        ...v,
                                        [conta.id]: n > 0 ? n.toFixed(2).replace(".", ",") : "",
                                      }));
                                    }
                                  }}
                                  placeholder="0,00"
                                  disabled={!podeEditar}
                                  className="text-right w-40 ml-auto font-mono"
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}

          {/* Totais Gerais */}
          <Card className="border-2 border-primary/30 bg-primary/5">
            <CardContent className="pt-4">
              <div className="space-y-2">
                {CLASSIFICACAO_ORDER.map((classif) => {
                  const total = totaisPorClassificacao[classif] ?? 0;
                  if (total === 0 && (contasPorClassificacao[classif] ?? []).length === 0) return null;
                  return (
                    <div key={classif} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{CLASSIFICACAO_LABELS[classif]}</span>
                      <span className="font-mono font-medium">R$ {fmt(total)}</span>
                    </div>
                  );
                })}
                <Separator />
                <div className="flex justify-between font-bold text-lg">
                  <span>Total Geral</span>
                  <span className="font-mono text-primary">R$ {fmt(totalGeral)}</span>
                </div>

                {/* Custo por tonelada */}
                {periodoAtual && (
                  <div className="mt-3 pt-3 border-t grid grid-cols-2 gap-4">
                    {periodoAtual.producaoTotal && parseFloat(periodoAtual.producaoTotal) > 0 && (
                      <div className="text-center p-2 bg-blue-50 rounded-md">
                        <p className="text-xs text-muted-foreground">Custo/t (Produção)</p>
                        <p className="font-bold text-blue-700 font-mono">
                          R$ {fmt(totalGeral / parseFloat(periodoAtual.producaoTotal))}
                        </p>
                      </div>
                    )}
                    {periodoAtual.quantidadeVendida && parseFloat(periodoAtual.quantidadeVendida) > 0 && (
                      <div className="text-center p-2 bg-green-50 rounded-md">
                        <p className="text-xs text-muted-foreground">Custo/t (Vendas)</p>
                        <p className="font-bold text-green-700 font-mono">
                          R$ {fmt(totalGeral / parseFloat(periodoAtual.quantidadeVendida))}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {podeEditar && (
            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={saving} size="lg">
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Salvando..." : "Salvar Lançamentos"}
              </Button>
            </div>
          )}
        </div>
      )}

      {!selectedPeriodoId && periodos?.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum período de custo cadastrado. Acesse <strong>Cadastros → Períodos de Custo</strong> para criar um período antes de lançar custos.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
