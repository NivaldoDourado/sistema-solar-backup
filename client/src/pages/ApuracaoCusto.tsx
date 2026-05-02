import { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { BarChart3, TrendingDown, Download, Lock, Info } from "lucide-react";
import { ExportButtons } from "@/components/ExportButtons";
import type { ExportOptions } from "@/lib/export-utils";

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
  custo_fixo: "text-blue-700",
  custo_variavel: "text-green-700",
  despesa_fixa: "text-orange-700",
  despesa_variavel: "text-purple-700",
};

const CLASSIFICACAO_BG: Record<string, string> = {
  custo_fixo: "bg-blue-50",
  custo_variavel: "bg-green-50",
  despesa_fixa: "bg-orange-50",
  despesa_variavel: "bg-purple-50",
};

function fmt(val: number) {
  return val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct(val: number) {
  return val.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";
}

export default function ApuracaoCusto() {
  const [selectedPeriodoId, setSelectedPeriodoId] = useState<number | null>(null);

  // Buscar períodos disponíveis
  const { data: periodos } = trpc.periodoCusto.list.useQuery();

  // Buscar lançamentos do período selecionado
  const { data: lancamentos } = trpc.lancamentoCusto.listByPeriodo.useQuery(
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

  // Calcular dados do relatório
  const relatorio = useMemo(() => {
    if (!lancamentos || !periodoAtual) return null;

    const producao = parseFloat(periodoAtual.producaoTotal ?? "0") || 0;
    const vendas = parseFloat(periodoAtual.quantidadeVendida ?? "0") || 0;
    const despesasIndiretas = parseFloat(periodoAtual.despesasIndiretas ?? "0") || 0;

    // Agrupar lançamentos por classificação
    const grupos: Record<string, {
      classificacao: string;
      contas: Array<{
        id: number;
        nome: string;
        divisor: string;
        valor: number;
        custoPorTon: number;
        percentual: number;
      }>;
      total: number;
    }> = {};

    for (const classif of CLASSIFICACAO_ORDER) {
      grupos[classif] = { classificacao: classif, contas: [], total: 0 };
    }

    let totalGeral = 0;

    for (const l of lancamentos) {
      const valor = parseFloat(String(l.valor || "0"));
      if (valor === 0) continue;
      const classif = l.contaClassificacao ?? "custo_variavel";
      const divisor = l.contaDivisor ?? "producao";
      const base = divisor === "vendas" ? vendas : producao;
      const custoPorTon = base > 0 ? valor / base : 0;

      if (!grupos[classif]) {
        grupos[classif] = { classificacao: classif, contas: [], total: 0 };
      }
      grupos[classif].contas.push({
        id: l.contaCustoId,
        nome: l.contaNome ?? "—",
        divisor,
        valor,
        custoPorTon,
        percentual: 0, // será calculado depois
      });
      grupos[classif].total += valor;
      totalGeral += valor;
    }

    // Calcular percentuais
    for (const grupo of Object.values(grupos)) {
      for (const conta of grupo.contas) {
        conta.percentual = totalGeral > 0 ? (conta.valor / totalGeral) * 100 : 0;
      }
    }

    // Totais por divisor
    let totalProducao = 0;
    let totalVendas = 0;
    for (const l of lancamentos) {
      const valor = parseFloat(String(l.valor || "0"));
      if (l.contaDivisor === "vendas") totalVendas += valor;
      else totalProducao += valor;
    }

    const custoPorTonProducao = producao > 0 ? totalGeral / producao : 0;
    const custoPorTonVendas = vendas > 0 ? totalGeral / vendas : 0;

    return {
      grupos,
      totalGeral,
      totalProducao,
      totalVendas,
      producao,
      vendas,
      despesasIndiretas,
      custoPorTonProducao,
      custoPorTonVendas,
    };
  }, [lancamentos, periodoAtual]);

  // Dados para exportação
  const exportOptions = useMemo((): ExportOptions | null => {
    if (!relatorio || !periodoAtual) return null;
    const rows: Record<string, any>[] = [];
    for (const classif of CLASSIFICACAO_ORDER) {
      const grupo = relatorio.grupos[classif];
      if (!grupo || grupo.contas.length === 0) continue;
      for (const conta of grupo.contas) {
        rows.push({
          classificacao: CLASSIFICACAO_LABELS[classif] ?? classif,
          conta: conta.nome,
          divisor: conta.divisor === "vendas" ? "Vendas" : "Produção",
          valor: fmt(conta.valor),
          custoPorTon: conta.custoPorTon > 0 ? fmt(conta.custoPorTon) : "",
          percentual: fmtPct(conta.percentual),
        });
      }
      rows.push({
        classificacao: `TOTAL ${CLASSIFICACAO_LABELS[classif]}`,
        conta: "",
        divisor: "",
        valor: fmt(grupo.total),
        custoPorTon: "",
        percentual: fmtPct(relatorio.totalGeral > 0 ? (grupo.total / relatorio.totalGeral) * 100 : 0),
      });
    }
    rows.push({
      classificacao: "TOTAL GERAL",
      conta: "",
      divisor: "",
      valor: fmt(relatorio.totalGeral),
      custoPorTon: fmt(relatorio.custoPorTonProducao),
      percentual: "100,0%",
    });
    return {
      title: `Apuração de Custo — ${MESES[(periodoAtual.mes ?? 1) - 1]}/${periodoAtual.ano}`,
      filename: `apuracao-custo-${periodoAtual.mes}-${periodoAtual.ano}`,
      columns: [
        { key: "classificacao", header: "Classificação", width: 25 },
        { key: "conta", header: "Conta de Custo", width: 30 },
        { key: "divisor", header: "Divisor", width: 12 },
        { key: "valor", header: "Valor (R$)", width: 18 },
        { key: "custoPorTon", header: "Custo/t (R$)", width: 18 },
        { key: "percentual", header: "% do Total", width: 14 },
      ],
      data: rows,
    };
  }, [relatorio, periodoAtual]);

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="h-8 w-8 text-primary" />
            Apuração de Custo
          </h1>
          <p className="text-muted-foreground mt-1">
            Relatório de custo por tonelada por classificação e período
          </p>
        </div>
        {exportOptions && (
          <ExportButtons options={exportOptions} />
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
        </CardContent>
      </Card>

      {/* KPIs Principais */}
      {relatorio && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                <p className="text-xs text-muted-foreground">Custo/t (Produção)</p>
                <p className="text-2xl font-bold text-blue-700 font-mono">
                  {relatorio.producao > 0 ? `R$ ${fmt(relatorio.custoPorTonProducao)}` : "—"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Base: {fmt(relatorio.producao)} t
                </p>
              </CardContent>
            </Card>
            <Card className="border-green-200 bg-green-50">
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Custo/t (Vendas)</p>
                <p className="text-2xl font-bold text-green-700 font-mono">
                  {relatorio.vendas > 0 ? `R$ ${fmt(relatorio.custoPorTonVendas)}` : "—"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Base: {fmt(relatorio.vendas)} t
                </p>
              </CardContent>
            </Card>
            <Card className="border-orange-200 bg-orange-50">
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Despesas Indiretas</p>
                <p className="text-2xl font-bold text-orange-700 font-mono">
                  R$ {fmt(relatorio.despesasIndiretas)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Tabela de Apuração por Classificação */}
          <div className="space-y-4">
            {CLASSIFICACAO_ORDER.map((classif) => {
              const grupo = relatorio.grupos[classif];
              if (!grupo || grupo.contas.length === 0) return null;

              return (
                <Card key={classif}>
                  <CardHeader className={`pb-2 rounded-t-lg ${CLASSIFICACAO_BG[classif]}`}>
                    <div className="flex items-center justify-between">
                      <CardTitle className={`text-base ${CLASSIFICACAO_COLORS[classif]}`}>
                        {CLASSIFICACAO_LABELS[classif]}
                      </CardTitle>
                      <div className="flex items-center gap-3">
                        <span className={`text-sm font-medium ${CLASSIFICACAO_COLORS[classif]}`}>
                          {fmtPct(relatorio.totalGeral > 0 ? (grupo.total / relatorio.totalGeral) * 100 : 0)} do total
                        </span>
                        <span className={`font-bold text-base font-mono ${CLASSIFICACAO_COLORS[classif]}`}>
                          R$ {fmt(grupo.total)}
                        </span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Conta de Custo</TableHead>
                          <TableHead className="w-28">Divisor</TableHead>
                          <TableHead className="text-right w-36">Valor (R$)</TableHead>
                          <TableHead className="text-right w-36">Custo/t (R$)</TableHead>
                          <TableHead className="text-right w-24">% Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {grupo.contas.map((conta) => (
                          <TableRow key={conta.id}>
                            <TableCell>{conta.nome}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {conta.divisor === "vendas" ? "Vendas" : "Produção"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {fmt(conta.valor)}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {conta.custoPorTon > 0 ? fmt(conta.custoPorTon) : "—"}
                            </TableCell>
                            <TableCell className="text-right font-mono text-muted-foreground">
                              {fmtPct(conta.percentual)}
                            </TableCell>
                          </TableRow>
                        ))}
                        {/* Subtotal */}
                        <TableRow className={`font-semibold ${CLASSIFICACAO_BG[classif]}`}>
                          <TableCell colSpan={2}>
                            Subtotal {CLASSIFICACAO_LABELS[classif]}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {fmt(grupo.total)}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            —
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {fmtPct(relatorio.totalGeral > 0 ? (grupo.total / relatorio.totalGeral) * 100 : 0)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              );
            })}

            {/* Resumo Final */}
            <Card className="border-2 border-primary/40 bg-primary/5">
              <CardContent className="pt-4">
                <div className="space-y-2">
                  {CLASSIFICACAO_ORDER.map((classif) => {
                    const grupo = relatorio.grupos[classif];
                    if (!grupo || grupo.total === 0) return null;
                    return (
                      <div key={classif} className="flex justify-between text-sm">
                        <span className={`font-medium ${CLASSIFICACAO_COLORS[classif]}`}>
                          {CLASSIFICACAO_LABELS[classif]}
                        </span>
                        <div className="flex gap-6">
                          <span className="font-mono text-muted-foreground w-28 text-right">
                            {fmtPct(relatorio.totalGeral > 0 ? (grupo.total / relatorio.totalGeral) * 100 : 0)}
                          </span>
                          <span className="font-mono font-medium w-32 text-right">
                            R$ {fmt(grupo.total)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  <Separator />
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total Geral</span>
                    <span className="font-mono text-primary">R$ {fmt(relatorio.totalGeral)}</span>
                  </div>

                  {/* Custo por tonelada */}
                  <div className="mt-4 pt-3 border-t grid grid-cols-2 gap-4">
                    {relatorio.producao > 0 && (
                      <div className="text-center p-3 bg-blue-50 rounded-md border border-blue-200">
                        <p className="text-xs text-muted-foreground">Custo Total / t Produzida</p>
                        <p className="font-bold text-blue-700 font-mono text-xl">
                          R$ {fmt(relatorio.custoPorTonProducao)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {fmt(relatorio.producao)} t produzidas
                        </p>
                      </div>
                    )}
                    {relatorio.vendas > 0 && (
                      <div className="text-center p-3 bg-green-50 rounded-md border border-green-200">
                        <p className="text-xs text-muted-foreground">Custo Total / t Vendida</p>
                        <p className="font-bold text-green-700 font-mono text-xl">
                          R$ {fmt(relatorio.custoPorTonVendas)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {fmt(relatorio.vendas)} t vendidas
                        </p>
                      </div>
                    )}
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
