import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, ChevronDown, ArrowLeft, Fuel, Wrench, Cog, Package, FileText, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

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

export default function ItensDespesa() {
  const [selectedPeriodoId, setSelectedPeriodoId] = useState<number | null>(null);
  const [selectedEquipTag, setSelectedEquipTag] = useState<string | null>(null);
  const [selectedClassificacao, setSelectedClassificacao] = useState<string | null>(null);
  const [searchEquip, setSearchEquip] = useState("");
  const [searchItem, setSearchItem] = useState("");

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
    { enabled: !!selectedPeriodoId && !!selectedEquipTag }
  );

  // Buscar itens detalhados
  const { data: itensData, isLoading: loadingItens } = trpc.itensDespesa.listarItensDetalhados.useQuery(
    { periodoCustoId: selectedPeriodoId!, equipamentoTag: selectedEquipTag!, classificacao: selectedClassificacao! },
    { enabled: !!selectedPeriodoId && !!selectedEquipTag && !!selectedClassificacao }
  );

  // Resumo geral
  const { data: resumoData } = trpc.itensDespesa.resumoPorClassificacao.useQuery(
    { periodoCustoId: selectedPeriodoId! },
    { enabled: !!selectedPeriodoId }
  );

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

      {/* Breadcrumb */}
      {selectedPeriodoId && (selectedEquipTag || selectedClassificacao) && (
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
      {selectedPeriodoId && !selectedEquipTag && resumoData && resumoData.length > 0 && (
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

      {/* NÍVEL 1: Lista de Equipamentos */}
      {selectedPeriodoId && !selectedEquipTag && (
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
                    <TableHead className="w-[200px]">Equipamento</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Itens</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEquipamentos.map(equip => (
                    <TableRow
                      key={equip.equipamentoTag}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedEquipTag(equip.equipamentoTag)}
                    >
                      <TableCell className="font-medium">{equip.equipamentoTag}</TableCell>
                      <TableCell className="text-muted-foreground">{equip.equipamentoDescricao || "-"}</TableCell>
                      <TableCell className="text-right">{equip.totalItens}</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(equip.totalCusto)}</TableCell>
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
      {selectedPeriodoId && selectedEquipTag && !selectedClassificacao && (
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
      {selectedPeriodoId && selectedEquipTag && selectedClassificacao && (
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
    </div>
  );
}
