import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronRight, ChevronDown, ArrowLeft, Fuel, Wrench, Cog, Package, FileText, Search, TrendingUp, AlertTriangle, Gauge, Ban, RotateCcw, ShieldAlert } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

const CLASSIFICACAO_ICONS: Record<string, any> = {
  combustivel: Fuel,
  lubrificantes: Wrench,
  pecas_desgaste: Cog,
  pecas_reposicao: Package,
  outras_despesas: FileText,
};

const CLASSIFICACAO_COLORS: Record<string, string> = {
  combustivel: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  lubrificantes: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  pecas_desgaste: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  pecas_reposicao: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  outras_despesas: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatNumber(value: number, decimals = 2): string {
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value);
}

// =============================================
// COMPONENTE: Consumo de Combustível
// =============================================
function ConsumoCombustivel({ periodoCustoId }: { periodoCustoId: number }) {
  const [selectedEquipTag, setSelectedEquipTag] = useState<string | null>(null);
  const [searchEquip, setSearchEquip] = useState("");

  // Ranking de consumo de todos os equipamentos
  const { data: rankingData, isLoading: loadingRanking } = trpc.itensDespesa.rankingConsumo.useQuery(
    { periodoCustoId },
    { enabled: !!periodoCustoId }
  );

  // Consumo detalhado de um equipamento específico
  const { data: consumoDetalhe, isLoading: loadingDetalhe } = trpc.itensDespesa.consumoPorEquipamento.useQuery(
    { periodoCustoId, equipamentoTag: selectedEquipTag! },
    { enabled: !!periodoCustoId && !!selectedEquipTag }
  );

  const filteredRanking = useMemo(() => {
    if (!rankingData?.ranking) return [];
    if (!searchEquip) return rankingData.ranking;
    const s = searchEquip.toLowerCase();
    return rankingData.ranking.filter(r =>
      r.equipamentoTag.toLowerCase().includes(s) ||
      (r.equipamentoDescricao || "").toLowerCase().includes(s)
    );
  }, [rankingData, searchEquip]);

  if (loadingRanking) {
    return <div className="text-center py-12 text-muted-foreground">Carregando dados de combustível...</div>;
  }

  if (!rankingData || rankingData.ranking.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Fuel className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium mb-2">Nenhum dado de combustível importado</p>
          <p className="text-sm">Reimporte a planilha de despesas para gerar os itens detalhados de combustível.</p>
        </CardContent>
      </Card>
    );
  }

  // Detalhe de um equipamento
  if (selectedEquipTag) {
    const equipInfo = rankingData.ranking.find(r => r.equipamentoTag === selectedEquipTag);
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm">
          <Button variant="ghost" size="sm" onClick={() => setSelectedEquipTag(null)} className="gap-1 px-2">
            <ArrowLeft className="h-4 w-4" />
            Voltar ao Ranking
          </Button>
          <span className="text-muted-foreground">/</span>
          <span className="font-semibold">{selectedEquipTag}</span>
          {equipInfo?.equipamentoDescricao && (
            <span className="text-muted-foreground">— {equipInfo.equipamentoDescricao}</span>
          )}
        </div>

        {/* Resumo do equipamento */}
        {consumoDetalhe && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <Card className="border">
              <CardContent className="pt-3 pb-3 px-4">
                <div className="text-xs text-muted-foreground mb-1">Total Litros</div>
                <div className="text-lg font-bold">{formatNumber(consumoDetalhe.resumo.totalLitros, 0)} L</div>
              </CardContent>
            </Card>
            <Card className="border">
              <CardContent className="pt-3 pb-3 px-4">
                <div className="text-xs text-muted-foreground mb-1">Total Custo</div>
                <div className="text-lg font-bold">{formatCurrency(consumoDetalhe.resumo.totalCusto)}</div>
              </CardContent>
            </Card>
            <Card className="border">
              <CardContent className="pt-3 pb-3 px-4">
                <div className="text-xs text-muted-foreground mb-1">Horímetro</div>
                <div className="text-lg font-bold">
                  {consumoDetalhe.resumo.horimetroInicial != null
                    ? `${formatNumber(consumoDetalhe.resumo.horimetroInicial, 0)} → ${formatNumber(consumoDetalhe.resumo.horimetroFinal!, 0)}`
                    : "-"
                  }
                </div>
                {consumoDetalhe.resumo.totalHorasTrabalhadas != null && (
                  <div className="text-xs text-muted-foreground">{formatNumber(consumoDetalhe.resumo.totalHorasTrabalhadas, 0)} hrs trabalhadas</div>
                )}
              </CardContent>
            </Card>
            <Card className="border bg-amber-50 dark:bg-amber-950">
              <CardContent className="pt-3 pb-3 px-4">
                <div className="text-xs text-muted-foreground mb-1">Média Lt/Hr</div>
                <div className="text-lg font-bold text-amber-700 dark:text-amber-300">
                  {consumoDetalhe.resumo.mediaGeral != null ? formatNumber(consumoDetalhe.resumo.mediaGeral) : "-"}
                </div>
              </CardContent>
            </Card>
            <Card className="border">
              <CardContent className="pt-3 pb-3 px-4">
                <div className="text-xs text-muted-foreground mb-1">Consumo Mín/Máx</div>
                <div className="text-sm font-bold">
                  {consumoDetalhe.resumo.consumoMinimo != null
                    ? `${formatNumber(consumoDetalhe.resumo.consumoMinimo)} — ${formatNumber(consumoDetalhe.resumo.consumoMaximo!)}`
                    : "-"
                  }
                </div>
                <div className="text-xs text-muted-foreground">lt/hr</div>
              </CardContent>
            </Card>
            <Card className="border">
              <CardContent className="pt-3 pb-3 px-4">
                <div className="text-xs text-muted-foreground mb-1">R$/Litro | R$/Hr</div>
                <div className="text-sm font-bold">
                  {consumoDetalhe.resumo.custoMedioPorLitro != null
                    ? `${formatCurrency(consumoDetalhe.resumo.custoMedioPorLitro)}`
                    : "-"
                  }
                </div>
                <div className="text-xs text-muted-foreground">
                  {consumoDetalhe.resumo.custoMedioPorHora != null
                    ? `${formatCurrency(consumoDetalhe.resumo.custoMedioPorHora)}/hr`
                    : ""
                  }
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tabela de abastecimentos com consumo calculado */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">
              Abastecimentos — {selectedEquipTag}
              {consumoDetalhe && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  ({consumoDetalhe.itens.length} abastecimentos)
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingDetalhe ? (
              <div className="text-center py-8 text-muted-foreground">Carregando abastecimentos...</div>
            ) : !consumoDetalhe || consumoDetalhe.itens.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">Nenhum abastecimento encontrado.</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[90px]">Data</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-right w-[80px]">Litros</TableHead>
                      <TableHead className="text-right w-[110px]">Custo</TableHead>
                      <TableHead className="text-right w-[90px]">Horímetro</TableHead>
                      <TableHead className="text-right w-[80px]">Intervalo</TableHead>
                      <TableHead className="text-right w-[100px]">
                        <div className="flex items-center justify-end gap-1">
                          <Gauge className="h-3.5 w-3.5" />
                          Lt/Hr Calc.
                        </div>
                      </TableHead>
                      <TableHead className="text-right w-[80px]">Lt/Hr Plan.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {consumoDetalhe.itens.map((item) => {
                      // Destacar consumo anormal (> 2x ou < 0.5x da média)
                      const media = consumoDetalhe.resumo.mediaGeral;
                      const isAnomalo = media && item.consumoCalculado
                        ? (item.consumoCalculado > media * 2 || item.consumoCalculado < media * 0.3)
                        : false;

                      return (
                        <TableRow key={item.id} className={isAnomalo ? "bg-red-50 dark:bg-red-950/30" : ""}>
                          <TableCell className="text-sm">{item.data || "-"}</TableCell>
                          <TableCell className="text-sm">{item.produto}</TableCell>
                          <TableCell className="text-right text-sm font-medium">
                            {formatNumber(item.quantidade, 0)}
                          </TableCell>
                          <TableCell className="text-right text-sm font-semibold">
                            {formatCurrency(item.custo)}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {item.hodometro != null ? formatNumber(item.hodometro, 0) : "-"}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {item.horasCalculadas != null ? formatNumber(item.horasCalculadas, 0) + "h" : "-"}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            <div className="flex items-center justify-end gap-1">
                              {item.consumoCalculado != null ? (
                                <span className={`font-bold ${isAnomalo ? "text-red-600 dark:text-red-400" : "text-amber-700 dark:text-amber-300"}`}>
                                  {formatNumber(item.consumoCalculado)}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                              {isAnomalo && <AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">
                            {item.ltHrPlanilha != null ? formatNumber(item.ltHrPlanilha) : "-"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Resumo do ranking */}
        {rankingData && (
          <Card className="border-t-2 border-amber-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Resumo Geral do Período
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Total Equipamentos</div>
                  <div className="font-bold text-lg">{rankingData.totais.totalEquipamentos}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Total Litros</div>
                  <div className="font-bold text-lg">{formatNumber(rankingData.totais.totalLitros, 0)} L</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Total Custo</div>
                  <div className="font-bold text-lg">{formatCurrency(rankingData.totais.totalCusto)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Média Geral Lt/Hr</div>
                  <div className="font-bold text-lg text-amber-700 dark:text-amber-300">
                    {rankingData.totais.mediaGeralGlobal != null ? formatNumber(rankingData.totais.mediaGeralGlobal) : "-"}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Lista / Ranking
  return (
    <div className="space-y-4">
      {/* Resumo geral */}
      <Card className="border-t-2 border-amber-500">
        <CardContent className="pt-4 pb-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground">Equipamentos</div>
              <div className="font-bold text-lg">{rankingData.totais.totalEquipamentos}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Abastecimentos</div>
              <div className="font-bold text-lg">{rankingData.totais.totalAbastecimentos}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Total Litros</div>
              <div className="font-bold text-lg">{formatNumber(rankingData.totais.totalLitros, 0)} L</div>
            </div>
            <div>
              <div className="text-muted-foreground">Total Custo</div>
              <div className="font-bold text-lg">{formatCurrency(rankingData.totais.totalCusto)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Média Geral Lt/Hr</div>
              <div className="font-bold text-lg text-amber-700 dark:text-amber-300">
                {rankingData.totais.mediaGeralGlobal != null ? formatNumber(rankingData.totais.mediaGeralGlobal) : "-"}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ranking de equipamentos */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              Ranking de Consumo por Equipamento
              <span className="text-sm font-normal text-muted-foreground ml-2">({filteredRanking.length} equipamentos)</span>
            </CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar equipamento..."
                value={searchEquip}
                onChange={(e) => setSearchEquip(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">#</TableHead>
                  <TableHead>Equipamento</TableHead>
                  <TableHead className="text-right w-[80px]">Abast.</TableHead>
                  <TableHead className="text-right w-[100px]">Litros</TableHead>
                  <TableHead className="text-right w-[120px]">Custo</TableHead>
                  <TableHead className="text-right w-[100px]">Hrs Trab.</TableHead>
                  <TableHead className="text-right w-[100px]">
                    <div className="flex items-center justify-end gap-1">
                      <Gauge className="h-3.5 w-3.5" />
                      Média Lt/Hr
                    </div>
                  </TableHead>
                  <TableHead className="text-right w-[100px]">R$/Hr</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRanking.map((equip, idx) => (
                  <TableRow
                    key={equip.equipamentoTag}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelectedEquipTag(equip.equipamentoTag)}
                  >
                    <TableCell className="text-muted-foreground text-sm">{idx + 1}</TableCell>
                    <TableCell>
                      <div className="font-medium">{equip.equipamentoTag}</div>
                      {equip.equipamentoDescricao && (
                        <div className="text-xs text-muted-foreground">{equip.equipamentoDescricao}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm">{equip.totalAbastecimentos}</TableCell>
                    <TableCell className="text-right text-sm">{formatNumber(equip.totalLitros, 0)}</TableCell>
                    <TableCell className="text-right text-sm font-semibold">{formatCurrency(equip.totalCusto)}</TableCell>
                    <TableCell className="text-right text-sm">
                      {equip.totalHorasTrabalhadas != null ? formatNumber(equip.totalHorasTrabalhadas, 0) + "h" : "-"}
                    </TableCell>
                    <TableCell className="text-right text-sm font-bold text-amber-700 dark:text-amber-300">
                      {equip.mediaGeral != null ? formatNumber(equip.mediaGeral) : "-"}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {equip.custoMedioPorHora != null ? formatCurrency(equip.custoMedioPorHora) : "-"}
                    </TableCell>
                    <TableCell>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// =============================================
// COMPONENTE PRINCIPAL
// =============================================
export default function ItensDespesa() {
  const [selectedPeriodoId, setSelectedPeriodoId] = useState<number | null>(null);
  const [selectedEquipTag, setSelectedEquipTag] = useState<string | null>(null);
  const [selectedClassificacao, setSelectedClassificacao] = useState<string | null>(null);
  const [searchEquip, setSearchEquip] = useState("");
  const [searchItem, setSearchItem] = useState("");
  const [activeTab, setActiveTab] = useState("itens");
  const [excludeDialogEquip, setExcludeDialogEquip] = useState<{ tag: string; descricao: string | null; sistemaId: number | null; excluido: boolean } | null>(null);
  const utils = trpc.useUtils();

  // Buscar períodos de custo
  const { data: periodos } = trpc.periodoCusto.list.useQuery();

  // Buscar equipamentos do período selecionado
  const { data: equipamentosData, isLoading: loadingEquips } = trpc.itensDespesa.listarEquipamentosPorPeriodo.useQuery(
    { periodoCustoId: selectedPeriodoId! },
    { enabled: !!selectedPeriodoId }
  );

  // Buscar classificações do equipamento selecionado
  const { data: classificacoesData, isLoading: loadingClassif } = trpc.itensDespesa.listarClassificacoesPorEquipamento.useQuery(
    { periodoCustoId: selectedPeriodoId!, equipamentoTag: selectedEquipTag! },
    { enabled: !!selectedPeriodoId && !!selectedEquipTag && activeTab === "itens" }
  );

  // Buscar itens detalhados
  const { data: itensData, isLoading: loadingItens } = trpc.itensDespesa.listarItensDetalhados.useQuery(
    { periodoCustoId: selectedPeriodoId!, equipamentoTag: selectedEquipTag!, classificacao: selectedClassificacao! },
    { enabled: !!selectedPeriodoId && !!selectedEquipTag && !!selectedClassificacao && activeTab === "itens" }
  );

  // Resumo geral
  const { data: resumoData } = trpc.itensDespesa.resumoPorClassificacao.useQuery(
    { periodoCustoId: selectedPeriodoId! },
    { enabled: !!selectedPeriodoId }
  );

  // Mutation para toggle de exclusão
  const toggleExcluido = trpc.equipamentos.toggleExcluidoCusto.useMutation({
    onSuccess: (_, variables) => {
      const novoEstado = variables.excluidoCusto === "sim" ? "excluído dos" : "reincluído nos";
      toast.success(`Equipamento ${novoEstado} cálculos`, {
        description: `Todos os relatórios e cálculos serão atualizados.`,
      });
      // Invalidar todas as queries relevantes
      utils.itensDespesa.invalidate();
      utils.equipamentos.invalidate();
      utils.rateioMem.invalidate();
      utils.custoSetor.invalidate();
      utils.custoSetorRas.invalidate();
      utils.lancamentoCusto.invalidate();
      setExcludeDialogEquip(null);
    },
    onError: (err) => {
      toast.error("Erro ao alterar equipamento", {
        description: err.message,
      });
    },
  });

  // Filtrar equipamentos
  const filteredEquipamentos = useMemo(() => {
    if (!equipamentosData) return [];
    if (!searchEquip) return equipamentosData;
    const s = searchEquip.toLowerCase();
    return equipamentosData.filter(e =>
      e.equipamentoTag.toLowerCase().includes(s) ||
      (e.equipamentoDescricao || "").toLowerCase().includes(s)
    );
  }, [equipamentosData, searchEquip]);

  // Contar excluídos
  const excluidos = useMemo(() => {
    if (!equipamentosData) return [];
    return equipamentosData.filter(e => e.excluidoCusto);
  }, [equipamentosData]);

  // Filtrar itens
  const filteredItens = useMemo(() => {
    if (!itensData) return [];
    if (!searchItem) return itensData;
    const s = searchItem.toLowerCase();
    return itensData.filter(item =>
      item.produto.toLowerCase().includes(s) ||
      (item.observacoes || "").toLowerCase().includes(s)
    );
  }, [itensData, searchItem]);

  const periodoLabel = useMemo(() => {
    if (!periodos || !selectedPeriodoId) return "";
    const p = periodos.find((p: any) => p.id === selectedPeriodoId);
    if (!p) return "";
    const meses = ["", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    return `${meses[p.mes]} / ${p.ano}`;
  }, [periodos, selectedPeriodoId]);

  const selectedEquipLabel = useMemo(() => {
    if (!equipamentosData || !selectedEquipTag) return "";
    const e = equipamentosData.find(e => e.equipamentoTag === selectedEquipTag);
    return e ? `${e.equipamentoTag}${e.equipamentoDescricao ? " - " + e.equipamentoDescricao : ""}` : selectedEquipTag;
  }, [equipamentosData, selectedEquipTag]);

  const selectedClassifLabel = useMemo(() => {
    if (!classificacoesData || !selectedClassificacao) return "";
    const c = classificacoesData.find(c => c.classificacao === selectedClassificacao);
    return c ? c.classificacaoLabel : selectedClassificacao;
  }, [classificacoesData, selectedClassificacao]);

  // Breadcrumb navigation
  const handleBack = () => {
    if (selectedClassificacao) {
      setSelectedClassificacao(null);
      setSearchItem("");
    } else if (selectedEquipTag) {
      setSelectedEquipTag(null);
      setSearchEquip("");
    }
  };

  const handleExcludeClick = (e: React.MouseEvent, equip: { equipamentoTag: string; equipamentoDescricao: string | null; equipamentoSistemaId: number | null; excluidoCusto: boolean }) => {
    e.stopPropagation();
    setExcludeDialogEquip({
      tag: equip.equipamentoTag,
      descricao: equip.equipamentoDescricao,
      sistemaId: equip.equipamentoSistemaId,
      excluido: equip.excluidoCusto,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Itens Detalhados de Despesa</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Análise hierárquica: Equipamento → Classificação → Itens individuais
          </p>
        </div>
      </div>

      {/* Seletor de Período */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium whitespace-nowrap">Período:</label>
            <Select
              value={selectedPeriodoId?.toString() || ""}
              onValueChange={(v) => {
                setSelectedPeriodoId(Number(v));
                setSelectedEquipTag(null);
                setSelectedClassificacao(null);
              }}
            >
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="Selecione o período" />
              </SelectTrigger>
              <SelectContent>
                {periodos?.map((p: any) => {
                  const meses = ["", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
                  return (
                    <SelectItem key={p.id} value={p.id.toString()}>
                      {meses[p.mes]} / {p.ano}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {periodoLabel && <span className="text-sm text-muted-foreground">{periodoLabel}</span>}
          </div>
        </CardContent>
      </Card>

      {/* Tabs: Itens Detalhados | Consumo de Combustível */}
      {selectedPeriodoId && (
        <Tabs value={activeTab} onValueChange={(v) => {
          setActiveTab(v);
          // Reset seleções ao trocar de aba
          if (v === "combustivel") {
            setSelectedEquipTag(null);
            setSelectedClassificacao(null);
          }
        }}>
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="itens" className="gap-2">
              <FileText className="h-4 w-4" />
              Itens Detalhados
            </TabsTrigger>
            <TabsTrigger value="combustivel" className="gap-2">
              <Fuel className="h-4 w-4" />
              Consumo Combustível
            </TabsTrigger>
          </TabsList>

          {/* ABA: Itens Detalhados */}
          <TabsContent value="itens" className="space-y-4 mt-4">
            {/* Breadcrumb */}
            {(selectedEquipTag || selectedClassificacao) && (
              <div className="flex items-center gap-2 text-sm">
                <Button variant="ghost" size="sm" onClick={handleBack} className="gap-1 px-2">
                  <ArrowLeft className="h-4 w-4" />
                  Voltar
                </Button>
                <span className="text-muted-foreground">/</span>
                <button
                  className="text-primary hover:underline cursor-pointer"
                  onClick={() => { setSelectedEquipTag(null); setSelectedClassificacao(null); }}
                >
                  Equipamentos
                </button>
                {selectedEquipTag && (
                  <>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    <button
                      className={`hover:underline cursor-pointer ${selectedClassificacao ? "text-primary" : "font-semibold"}`}
                      onClick={() => setSelectedClassificacao(null)}
                    >
                      {selectedEquipTag}
                    </button>
                  </>
                )}
                {selectedClassificacao && (
                  <>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold">{selectedClassifLabel}</span>
                  </>
                )}
              </div>
            )}

            {/* Resumo Geral */}
            {!selectedEquipTag && resumoData && resumoData.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {resumoData.map(r => {
                  const Icon = CLASSIFICACAO_ICONS[r.classificacao] || FileText;
                  return (
                    <Card key={r.classificacao} className="border">
                      <CardContent className="pt-3 pb-3 px-4">
                        <div className="flex items-center gap-2 mb-1">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <span className="text-xs font-medium truncate">{r.classificacaoLabel}</span>
                        </div>
                        <div className="text-lg font-bold">{formatCurrency(r.totalCusto)}</div>
                        <div className="text-xs text-muted-foreground">
                          {r.totalItens} itens · {r.totalEquipamentos} equip.
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Banner de equipamentos excluídos */}
            {!selectedEquipTag && excluidos.length > 0 && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800">
                <ShieldAlert className="h-5 w-5 text-orange-600 dark:text-orange-400 shrink-0" />
                <div className="text-sm">
                  <span className="font-medium text-orange-800 dark:text-orange-200">
                    {excluidos.length} equipamento{excluidos.length > 1 ? "s" : ""} excluído{excluidos.length > 1 ? "s" : ""} dos cálculos de custo:
                  </span>{" "}
                  <span className="text-orange-700 dark:text-orange-300">
                    {excluidos.map(e => e.equipamentoTag).join(", ")}
                  </span>
                </div>
              </div>
            )}

            {/* NÍVEL 1: Lista de Equipamentos */}
            {!selectedEquipTag && (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">
                      Equipamentos com Itens Importados
                      {equipamentosData && <span className="text-sm font-normal text-muted-foreground ml-2">({equipamentosData.length} equipamentos)</span>}
                    </CardTitle>
                    <div className="relative w-64">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar equipamento..."
                        value={searchEquip}
                        onChange={(e) => setSearchEquip(e.target.value)}
                        className="pl-8"
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingEquips ? (
                    <div className="text-center py-8 text-muted-foreground">Carregando equipamentos...</div>
                  ) : filteredEquipamentos.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      {equipamentosData?.length === 0
                        ? "Nenhum item detalhado importado para este período. Reimporte a planilha para gerar os itens."
                        : "Nenhum equipamento encontrado com este filtro."
                      }
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Equipamento</TableHead>
                          <TableHead>Descrição</TableHead>
                          <TableHead className="text-right">Itens</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead className="w-[100px] text-center">Custo</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredEquipamentos.map(equip => (
                          <TableRow
                            key={equip.equipamentoTag}
                            className={`cursor-pointer hover:bg-muted/50 ${equip.excluidoCusto ? "opacity-50 bg-red-50/50 dark:bg-red-950/20" : ""}`}
                            onClick={() => setSelectedEquipTag(equip.equipamentoTag)}
                          >
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                {equip.equipamentoTag}
                                {equip.excluidoCusto && (
                                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                                    EXCLUÍDO
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{equip.equipamentoDescricao || "-"}</TableCell>
                            <TableCell className="text-right">{equip.totalItens}</TableCell>
                            <TableCell className={`text-right font-semibold ${equip.excluidoCusto ? "line-through text-muted-foreground" : ""}`}>
                              {formatCurrency(equip.totalCusto)}
                            </TableCell>
                            <TableCell className="text-center">
                              <Button
                                variant={equip.excluidoCusto ? "outline" : "ghost"}
                                size="sm"
                                className={`h-7 px-2 text-xs ${equip.excluidoCusto
                                  ? "border-green-300 text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-400 dark:hover:bg-green-950"
                                  : "text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950"
                                }`}
                                onClick={(e) => handleExcludeClick(e, equip)}
                                title={equip.excluidoCusto ? "Reincluir nos cálculos" : "Excluir dos cálculos de custo"}
                              >
                                {equip.excluidoCusto ? (
                                  <><RotateCcw className="h-3.5 w-3.5 mr-1" /> Reincluir</>
                                ) : (
                                  <><Ban className="h-3.5 w-3.5 mr-1" /> Excluir</>
                                )}
                              </Button>
                            </TableCell>
                            <TableCell>
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            )}

            {/* NÍVEL 2: Classificações do Equipamento */}
            {selectedEquipTag && !selectedClassificacao && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">
                    Classificações de Despesa — {selectedEquipLabel}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingClassif ? (
                    <div className="text-center py-8 text-muted-foreground">Carregando classificações...</div>
                  ) : !classificacoesData || classificacoesData.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">Nenhuma classificação encontrada.</div>
                  ) : (
                    <div className="space-y-2">
                      {classificacoesData.map(classif => {
                        const Icon = CLASSIFICACAO_ICONS[classif.classificacao] || FileText;
                        const colorClass = CLASSIFICACAO_COLORS[classif.classificacao] || "bg-gray-100 text-gray-800";
                        return (
                          <div
                            key={classif.classificacao}
                            className="flex items-center justify-between p-4 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={() => setSelectedClassificacao(classif.classificacao)}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-lg ${colorClass}`}>
                                <Icon className="h-5 w-5" />
                              </div>
                              <div>
                                <div className="font-medium">{classif.classificacaoLabel}</div>
                                <div className="text-sm text-muted-foreground">{classif.totalItens} itens</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-lg font-bold">{formatCurrency(classif.totalCusto)}</span>
                              <ChevronRight className="h-5 w-5 text-muted-foreground" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* NÍVEL 3: Itens Detalhados */}
            {selectedEquipTag && selectedClassificacao && (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">
                      {selectedClassifLabel} — {selectedEquipTag}
                      {itensData && <span className="text-sm font-normal text-muted-foreground ml-2">({itensData.length} itens)</span>}
                    </CardTitle>
                    <div className="relative w-64">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar produto..."
                        value={searchItem}
                        onChange={(e) => setSearchItem(e.target.value)}
                        className="pl-8"
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingItens ? (
                    <div className="text-center py-8 text-muted-foreground">Carregando itens...</div>
                  ) : filteredItens.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">Nenhum item encontrado.</div>
                  ) : (
                    <>
                      {/* Resumo do total */}
                      <div className="mb-4 p-3 bg-muted/50 rounded-lg flex items-center justify-between">
                        <span className="text-sm font-medium">Total da classificação:</span>
                        <span className="text-lg font-bold">
                          {formatCurrency(filteredItens.reduce((sum, item) => sum + item.custo, 0))}
                        </span>
                      </div>

                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[90px]">Data</TableHead>
                              <TableHead>Produto</TableHead>
                              <TableHead className="text-right w-[80px]">Qtd</TableHead>
                              <TableHead className="text-right w-[120px]">Custo</TableHead>
                              {selectedClassificacao === "combustivel" && (
                                <>
                                  <TableHead className="text-right w-[100px]">Horímetro</TableHead>
                                  <TableHead className="text-right w-[80px]">Lt/Hr</TableHead>
                                </>
                              )}
                              <TableHead className="w-[200px]">Observações</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredItens.map((item) => (
                              <TableRow key={item.id}>
                                <TableCell className="text-sm">{item.data || "-"}</TableCell>
                                <TableCell>
                                  <div className="font-medium text-sm">{item.produto}</div>
                                  {item.grupoProduto && (
                                    <div className="text-xs text-muted-foreground">{item.grupoProduto}</div>
                                  )}
                                </TableCell>
                                <TableCell className="text-right text-sm">
                                  {formatNumber(item.quantidade, item.quantidade % 1 === 0 ? 0 : 2)}
                                </TableCell>
                                <TableCell className="text-right font-semibold text-sm">
                                  {formatCurrency(item.custo)}
                                </TableCell>
                                {selectedClassificacao === "combustivel" && (
                                  <>
                                    <TableCell className="text-right text-sm">
                                      {item.hodometro != null ? formatNumber(item.hodometro, 0) : "-"}
                                    </TableCell>
                                    <TableCell className="text-right text-sm">
                                      {item.litrosPorHora || "-"}
                                    </TableCell>
                                  </>
                                )}
                                <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate" title={item.observacoes || ""}>
                                  {item.observacoes || "-"}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ABA: Consumo de Combustível */}
          <TabsContent value="combustivel" className="mt-4">
            <ConsumoCombustivel periodoCustoId={selectedPeriodoId} />
          </TabsContent>
        </Tabs>
      )}

      {/* Mensagem inicial */}
      {!selectedPeriodoId && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">Selecione um período para visualizar os itens detalhados</p>
            <p className="text-sm">
              Os itens são importados automaticamente junto com a planilha de despesas.
              <br />
              Se o período não possui itens, reimporte a planilha para gerá-los.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Dialog de confirmação de exclusão/reinclusão */}
      <Dialog open={!!excludeDialogEquip} onOpenChange={(open) => !open && setExcludeDialogEquip(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {excludeDialogEquip?.excluido ? (
                <><RotateCcw className="h-5 w-5 text-green-600" /> Reincluir Equipamento nos Cálculos</>
              ) : (
                <><Ban className="h-5 w-5 text-red-600" /> Excluir Equipamento dos Cálculos</>
              )}
            </DialogTitle>
            <DialogDescription asChild>
              <div className="text-muted-foreground text-sm">
                {excludeDialogEquip?.excluido ? (
                  <p>
                    Deseja reincluir <strong>{excludeDialogEquip.tag}</strong>
                    {excludeDialogEquip.descricao && <> ({excludeDialogEquip.descricao})</>} nos cálculos de custo da pedreira?
                    As despesas deste equipamento voltarão a ser consideradas em todos os relatórios.
                  </p>
                ) : (
                  <>
                    <p>
                      Deseja excluir <strong>{excludeDialogEquip?.tag}</strong>
                      {excludeDialogEquip?.descricao && <> ({excludeDialogEquip.descricao})</>} dos cálculos de custo da pedreira?
                    </p>
                    <p className="mt-2 font-semibold">Esta ação afeta todos os períodos e relatórios:</p>
                    <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                      <li>Rateio MEM (despesas de equipamentos)</li>
                      <li>Apuração de Custo (sintético e analítico)</li>
                      <li>Custo por Setor (relatório por subsetor)</li>
                      <li>Ranking de combustível</li>
                    </ul>
                    <p className="mt-2">
                      O equipamento continuará visível na lista, mas marcado como excluído. Você pode reincluí-lo a qualquer momento.
                    </p>
                  </>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExcludeDialogEquip(null)}>
              Cancelar
            </Button>
            <Button
              variant={excludeDialogEquip?.excluido ? "default" : "destructive"}
              onClick={() => {
                if (excludeDialogEquip) {
                  toggleExcluido.mutate({
                    ...(excludeDialogEquip.sistemaId ? { id: excludeDialogEquip.sistemaId } : {}),
                    tag: excludeDialogEquip.tag,
                    descricao: excludeDialogEquip.descricao ?? undefined,
                    excluidoCusto: excludeDialogEquip.excluido ? "nao" : "sim",
                  });
                }
              }}
              disabled={toggleExcluido.isPending}
            >
              {toggleExcluido.isPending ? "Processando..." : excludeDialogEquip?.excluido ? "Reincluir" : "Excluir dos Cálculos"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
