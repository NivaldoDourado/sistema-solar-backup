import { useState, useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, ArrowRight, ArrowLeft, Loader2, Info, Eye, ArrowRightLeft } from "lucide-react";

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

type Classificacao = "lubrificantes" | "pecas_desgaste" | "outras_despesas" | "pecas_reposicao" | "combustivel";

const CLASSIFICACAO_LABELS: Record<Classificacao, string> = {
  lubrificantes: "Lubrificantes",
  pecas_desgaste: "Peças de Desgaste",
  outras_despesas: "Outras Despesas",
  pecas_reposicao: "Peças de Reposição / Itens de Consumo",
  combustivel: "Combustível",
};

const CLASSIFICACAO_COLORS: Record<Classificacao, string> = {
  lubrificantes: "bg-blue-100 text-blue-700 hover:bg-blue-200",
  pecas_desgaste: "bg-orange-100 text-orange-700 hover:bg-orange-200",
  outras_despesas: "bg-purple-100 text-purple-700 hover:bg-purple-200",
  pecas_reposicao: "bg-green-100 text-green-700 hover:bg-green-200",
  combustivel: "bg-red-100 text-red-700 hover:bg-red-200",
};

const CLASSIFICACAO_SHORT: Record<Classificacao, string> = {
  lubrificantes: "Lub",
  pecas_desgaste: "Desg",
  outras_despesas: "Outras",
  pecas_reposicao: "Rep",
  combustivel: "Comb",
};

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

interface DespesaItem {
  sequencia: string;
  data: string;
  produto: string;
  grupoProduto: string;
  quantidade: number;
  custo: number;
  classificacao: Classificacao;
}

interface EquipamentoPreview {
  nomeCompleto: string;
  codigoTag: string;
  descricao: string;
  grupoPlanilha: string;
  totalGeral: number;
  totalLubrificantes: number;
  totalPecasDesgaste: number;
  totalOutrasDespesas: number;
  totalPecasReposicao: number;
  totalCombustivel: number;
  qtdDespesas: number;
  correspondencia: { id: number; nome: string; score: number } | null;
  excluirDefault: boolean;
  selecionado: boolean;
  isContaEspecifica: boolean;
  despesas: DespesaItem[];
}

export default function ImportDespesas() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [mes, setMes] = useState<number>(new Date().getMonth() + 1);
  const [ano, setAno] = useState<number>(new Date().getFullYear());
  const [file, setFile] = useState<File | null>(null);
  const [fileBase64, setFileBase64] = useState<string>("");
  const [parseResult, setParseResult] = useState<any>(null);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [importResult, setImportResult] = useState<any>(null);

  // Modal state for item details
  const [modalOpen, setModalOpen] = useState(false);
  const [modalEquip, setModalEquip] = useState<EquipamentoPreview | null>(null);
  const [modalClassificacao, setModalClassificacao] = useState<Classificacao | null>(null);

  // Reclassification overrides: Map<"codigoTag:sequencia", newClassificacao>
  const [reclassificacoes, setReclassificacoes] = useState<Map<string, Classificacao>>(new Map());

  // Item exclusion: Set<"codigoTag:sequencia"> for items to exclude from import
  const [itensExcluidos, setItensExcluidos] = useState<Set<string>>(new Set());

  const parseMutation = trpc.importDespesas.parsePlanilha.useMutation();
  const importMutation = trpc.importDespesas.confirmarImportacao.useMutation();

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      setFileBase64(base64);
    };
    reader.readAsDataURL(f);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    setFile(f);
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      setFileBase64(base64);
    };
    reader.readAsDataURL(f);
  }, []);

  const handleParse = async () => {
    if (!fileBase64 || !file) return;
    try {
      const result = await parseMutation.mutateAsync({
        fileBase64,
        fileName: file.name,
        mes,
        ano,
      });
      setParseResult(result);
      setReclassificacoes(new Map()); // Reset reclassifications
      setItensExcluidos(new Set()); // Reset item exclusions
      const inicialSelecionados = new Set<string>();
      result.equipamentos.forEach((e: any) => {
        if (e.selecionado) inicialSelecionados.add(e.codigoTag);
      });
      setSelecionados(inicialSelecionados);
      setStep(2);
      toast.success(`Planilha processada: ${result.totalEquipamentos} equipamentos encontrados`);
    } catch (err: any) {
      toast.error("Erro ao processar planilha: " + (err.message || "Erro desconhecido"));
    }
  };

  const handleImport = async () => {
    if (!fileBase64 || !file) return;
    try {
      // Build reclassification payload
      const reclassificacoesPayload = Array.from(reclassificacoes.entries()).map(([key, novaClassificacao]) => {
        const [codigoTag, sequencia] = key.split(":");
        return { codigoTag, sequencia, novaClassificacao };
      });

      // Build item exclusion payload
      const itensExcluidosPayload = Array.from(itensExcluidos).map(key => {
        const [codigoTag, sequencia] = key.split(":");
        return { codigoTag, sequencia };
      });

      const result = await importMutation.mutateAsync({
        fileBase64,
        fileName: file.name,
        mes,
        ano,
        equipamentosSelecionados: Array.from(selecionados).map(tag => ({ codigoTag: tag })),
        reclassificacoes: reclassificacoesPayload,
        itensExcluidos: itensExcluidosPayload,
      });
      setImportResult(result);
      setStep(3);
      toast.success(`Importação concluída: ${result.totalLancamentos} lançamentos criados`);
    } catch (err: any) {
      toast.error("Erro na importação: " + (err.message || "Erro desconhecido"));
    }
  };

  const toggleEquipamento = (tag: string) => {
    setSelecionados(prev => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  const toggleAll = (checked: boolean) => {
    if (checked) {
      setSelecionados(new Set(parseResult.equipamentos.map((e: any) => e.codigoTag)));
    } else {
      setSelecionados(new Set());
    }
  };

  // Get effective classification for an item (considering reclassifications)
  const getEffectiveClassificacao = (codigoTag: string, sequencia: string, original: Classificacao): Classificacao => {
    const key = `${codigoTag}:${sequencia}`;
    return reclassificacoes.get(key) || original;
  };

  // Toggle item exclusion
  const toggleItemExclusao = (codigoTag: string, sequencia: string) => {
    setItensExcluidos(prev => {
      const next = new Set(prev);
      const key = `${codigoTag}:${sequencia}`;
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Calculate totals considering reclassifications AND excluded items
  const getEquipTotals = (equip: EquipamentoPreview) => {
    const totals: Record<Classificacao, number> = {
      lubrificantes: 0,
      pecas_desgaste: 0,
      outras_despesas: 0,
      pecas_reposicao: 0,
      combustivel: 0,
    };
    for (const d of equip.despesas) {
      // Skip excluded items
      if (itensExcluidos.has(`${equip.codigoTag}:${d.sequencia}`)) continue;
      const effectiveClass = getEffectiveClassificacao(equip.codigoTag, d.sequencia, d.classificacao);
      totals[effectiveClass] += d.custo;
    }
    return totals;
  };

  // Open modal for a specific classification of an equipment
  const openDetailModal = (equip: EquipamentoPreview, classificacao: Classificacao) => {
    setModalEquip(equip);
    setModalClassificacao(classificacao);
    setModalOpen(true);
  };

  // Reclassify an item
  const reclassificarItem = (codigoTag: string, sequencia: string, novaClassificacao: Classificacao) => {
    setReclassificacoes(prev => {
      const next = new Map(prev);
      const key = `${codigoTag}:${sequencia}`;
      // Find original classification
      const equip = parseResult?.equipamentos.find((e: EquipamentoPreview) => e.codigoTag === codigoTag);
      const item = equip?.despesas.find((d: DespesaItem) => d.sequencia === sequencia);
      if (item && item.classificacao === novaClassificacao) {
        // If reclassifying back to original, remove the override
        next.delete(key);
      } else {
        next.set(key, novaClassificacao);
      }
      return next;
    });
  };

  // Get items for the modal (filtered by ORIGINAL classification so reclassified items stay visible)
  const modalItems = useMemo(() => {
    if (!modalEquip || !modalClassificacao) return [];
    return modalEquip.despesas
      .filter(d => d.classificacao === modalClassificacao)
      .sort((a, b) => b.custo - a.custo);
  }, [modalEquip, modalClassificacao]);

  // Resumo dos selecionados (considering reclassifications AND excluded items)
  const resumoSelecionados = useMemo(() => {
    if (!parseResult) return null;
    const selected = parseResult.equipamentos.filter((e: EquipamentoPreview) => selecionados.has(e.codigoTag));
    const totals = { total: selected.length, valor: 0, lubrificantes: 0, pecasDesgaste: 0, pecasReposicao: 0, outrasDespesas: 0, combustivel: 0 };
    for (const equip of selected) {
      if (equip.isContaEspecifica) {
        // For conta específica, subtract excluded items
        const valorEfetivo = equip.despesas
          .filter((d: DespesaItem) => !itensExcluidos.has(`${equip.codigoTag}:${d.sequencia}`))
          .reduce((s: number, d: DespesaItem) => s + d.custo, 0);
        totals.valor += valorEfetivo;
        continue;
      }
      const t = getEquipTotals(equip);
      const valorEfetivo = Object.values(t).reduce((a, b) => a + b, 0);
      totals.valor += valorEfetivo;
      totals.lubrificantes += t.lubrificantes;
      totals.pecasDesgaste += t.pecas_desgaste;
      totals.pecasReposicao += t.pecas_reposicao;
      totals.outrasDespesas += t.outras_despesas;
      totals.combustivel += t.combustivel;
    }
    return totals;
  }, [parseResult, selecionados, reclassificacoes, itensExcluidos]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Despesas de Equipamentos</h1>
          <p className="text-muted-foreground">Importação de relatório de despesas do DataGold para classificação e apropriação automática</p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-2">
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${step >= 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
          <span>1</span> Upload
        </div>
        <ArrowRight className="w-4 h-4 text-muted-foreground" />
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${step >= 2 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
          <span>2</span> Revisão
        </div>
        <ArrowRight className="w-4 h-4 text-muted-foreground" />
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${step >= 3 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
          <span>3</span> Resultado
        </div>
      </div>

      {/* Step 1: Upload */}
      {step === 1 && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Selecione o Período e o Arquivo</CardTitle>
              <CardDescription>Escolha o mês/ano de referência e faça upload do relatório de despesas (.xls ou .xlsx)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <div className="w-48">
                  <label className="text-sm font-medium mb-1 block">Mês</label>
                  <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MESES.map((m, i) => (
                        <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-32">
                  <label className="text-sm font-medium mb-1 block">Ano</label>
                  <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[2025, 2026, 2027].map(a => (
                        <SelectItem key={a} value={String(a)}>{a}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div
                className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => document.getElementById("file-input")?.click()}
              >
                <input
                  id="file-input"
                  type="file"
                  accept=".xls,.xlsx"
                  className="hidden"
                  onChange={handleFileChange}
                />
                {file ? (
                  <div className="flex items-center justify-center gap-3">
                    <FileSpreadsheet className="w-8 h-8 text-green-600" />
                    <div className="text-left">
                      <p className="font-medium">{file.name}</p>
                      <p className="text-sm text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="w-10 h-10 mx-auto text-muted-foreground" />
                    <p className="text-muted-foreground">Arraste o arquivo aqui ou clique para selecionar</p>
                    <p className="text-xs text-muted-foreground">Formatos aceitos: .xls, .xlsx</p>
                  </div>
                )}
              </div>

              <Button
                onClick={handleParse}
                disabled={!file || !fileBase64 || parseMutation.isPending}
                className="w-full"
                size="lg"
              >
                {parseMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processando planilha...</>
                ) : (
                  <><FileSpreadsheet className="w-4 h-4 mr-2" /> Processar Planilha</>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-blue-200 bg-blue-50/50">
            <CardContent className="pt-4">
              <div className="flex gap-2">
                <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800 space-y-1">
                  <p className="font-medium">Como funciona a classificação automática:</p>
                  <ul className="list-disc pl-4 space-y-0.5">
                    <li><strong>Lubrificantes:</strong> Óleos, graxas e fluidos hidráulicos</li>
                    <li><strong>Peças de Desgaste:</strong> Pneus, unhas, dentes, mandíbulas, telas, roletes, bits (contextualizado por tipo de equipamento)</li>
                    <li><strong>Outras Despesas:</strong> Fretes, serviços de terceiros, mão-de-obra, lavagem, recapagem, pintura</li>
                    <li><strong>Peças de Reposição / Itens de Consumo:</strong> Tudo que não se enquadra nas categorias anteriores (residual)</li>
                    <li><strong>Combustível:</strong> Óleo diesel, gasolina e álcool</li>
                  </ul>
                  <p className="mt-2 text-blue-700"><strong>Dica:</strong> Clique nas etiquetas de classificação (Lub, Desg, Rep, etc.) para ver os itens e reclassificar se necessário.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Step 2: Revisão */}
      {step === 2 && parseResult && (
        <div className="space-y-4">
          {/* Resumo geral */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground">Equipamentos na Planilha</p>
                <p className="text-2xl font-bold">{parseResult.totalEquipamentos}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground">Selecionados para Importar</p>
                <p className="text-2xl font-bold text-primary">{resumoSelecionados?.total || 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground">Valor Total Selecionado</p>
                <p className="text-2xl font-bold">{formatCurrency(resumoSelecionados?.valor || 0)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground">Valor Total Planilha</p>
                <p className="text-2xl font-bold text-muted-foreground">{formatCurrency(parseResult.totalGeral)}</p>
              </CardContent>
            </Card>
          </div>

          {/* Resumo por classificação */}
          {resumoSelecionados && resumoSelecionados.total > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Classificação dos Selecionados</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                    <p className="text-xs text-blue-700 font-medium">Lubrificantes</p>
                    <p className="text-lg font-bold text-blue-900">{formatCurrency(resumoSelecionados.lubrificantes)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-orange-50 border border-orange-200">
                    <p className="text-xs text-orange-700 font-medium">Peças de Desgaste</p>
                    <p className="text-lg font-bold text-orange-900">{formatCurrency(resumoSelecionados.pecasDesgaste)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                    <p className="text-xs text-green-700 font-medium">Peças de Reposição</p>
                    <p className="text-lg font-bold text-green-900">{formatCurrency(resumoSelecionados.pecasReposicao)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-purple-50 border border-purple-200">
                    <p className="text-xs text-purple-700 font-medium">Outras Despesas</p>
                    <p className="text-lg font-bold text-purple-900">{formatCurrency(resumoSelecionados.outrasDespesas)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                    <p className="text-xs text-red-700 font-medium">Combustível</p>
                    <p className="text-lg font-bold text-red-900">{formatCurrency(resumoSelecionados.combustivel)}</p>
                  </div>
                </div>
                {reclassificacoes.size > 0 && (
                  <p className="text-xs text-amber-600 mt-2 font-medium">
                    * {reclassificacoes.size} item(ns) reclassificado(s) manualmente
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Lista de equipamentos */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Equipamentos Encontrados</CardTitle>
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={selecionados.size === parseResult.equipamentos.length}
                    onCheckedChange={(checked) => toggleAll(!!checked)}
                  />
                  <span className="text-sm">Selecionar todos</span>
                </div>
              </div>
              <CardDescription>Marque os equipamentos cujas despesas devem ser importadas para o período {MESES[mes - 1]}/{ano}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
                {parseResult.equipamentos.map((equip: EquipamentoPreview, idx: number) => {
                  const totals = equip.isContaEspecifica ? null : getEquipTotals(equip);
                  return (
                    <div
                      key={idx}
                      className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                        selecionados.has(equip.codigoTag)
                          ? "border-primary/30 bg-primary/5"
                          : equip.excluirDefault
                          ? "border-red-200 bg-red-50/50"
                          : "border-border"
                      }`}
                    >
                      <Checkbox
                        checked={selecionados.has(equip.codigoTag)}
                        onCheckedChange={() => toggleEquipamento(equip.codigoTag)}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{equip.codigoTag}</span>
                          <span className="text-sm text-muted-foreground">—</span>
                          <span className="text-sm">{equip.descricao}</span>
                          <Badge variant="outline" className="text-xs">{equip.grupoPlanilha}</Badge>
                          {equip.excluirDefault && (
                            <Badge variant="destructive" className="text-xs">Excluído (outro negócio)</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          <span className="text-sm font-medium">{formatCurrency(equip.totalGeral)}</span>
                          <span className="text-xs text-muted-foreground">({equip.qtdDespesas} itens)</span>
                          {equip.correspondencia ? (
                            <Badge variant="secondary" className="text-xs gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              {equip.correspondencia.score >= 80 ? "Correspondência exata" : "Correspondência parcial"}: {equip.correspondencia.nome}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs gap-1 border-yellow-300 text-yellow-700">
                              <AlertTriangle className="w-3 h-3" />
                              Sem correspondência no sistema
                            </Badge>
                          )}
                        </div>
                        {/* Classification badges - clickable for details */}
                        {equip.isContaEspecifica ? (
                          <div className="flex gap-2 mt-1.5 flex-wrap">
                            <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">
                              Total: {formatCurrency(equip.totalGeral)} (Conta Específica — sem sub-classificação)
                            </span>
                          </div>
                        ) : totals && (
                          <div className="flex gap-2 mt-1.5 flex-wrap">
                            {totals.lubrificantes > 0 && (
                              <button
                                type="button"
                                onClick={() => openDetailModal(equip, "lubrificantes")}
                                className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 cursor-pointer transition-colors flex items-center gap-1"
                              >
                                <Eye className="w-3 h-3" />
                                Lub: {formatCurrency(totals.lubrificantes)}
                              </button>
                            )}
                            {totals.pecas_desgaste > 0 && (
                              <button
                                type="button"
                                onClick={() => openDetailModal(equip, "pecas_desgaste")}
                                className="text-xs px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 hover:bg-orange-200 cursor-pointer transition-colors flex items-center gap-1"
                              >
                                <Eye className="w-3 h-3" />
                                Desg: {formatCurrency(totals.pecas_desgaste)}
                              </button>
                            )}
                            {totals.pecas_reposicao > 0 && (
                              <button
                                type="button"
                                onClick={() => openDetailModal(equip, "pecas_reposicao")}
                                className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700 hover:bg-green-200 cursor-pointer transition-colors flex items-center gap-1"
                              >
                                <Eye className="w-3 h-3" />
                                Rep: {formatCurrency(totals.pecas_reposicao)}
                              </button>
                            )}
                            {totals.outras_despesas > 0 && (
                              <button
                                type="button"
                                onClick={() => openDetailModal(equip, "outras_despesas")}
                                className="text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 hover:bg-purple-200 cursor-pointer transition-colors flex items-center gap-1"
                              >
                                <Eye className="w-3 h-3" />
                                Outras: {formatCurrency(totals.outras_despesas)}
                              </button>
                            )}
                            {totals.combustivel > 0 && (
                              <button
                                type="button"
                                onClick={() => openDetailModal(equip, "combustivel")}
                                className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700 hover:bg-red-200 cursor-pointer transition-colors flex items-center gap-1"
                              >
                                <Eye className="w-3 h-3" />
                                Comb: {formatCurrency(totals.combustivel)}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Ações */}
          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={() => setStep(1)}>
              <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
            </Button>
            <Button
              onClick={handleImport}
              disabled={selecionados.size === 0 || importMutation.isPending}
              size="lg"
            >
              {importMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Importando...</>
              ) : (
                <><CheckCircle2 className="w-4 h-4 mr-2" /> Confirmar Importação ({selecionados.size} equipamentos)</>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Resultado */}
      {step === 3 && importResult && (
        <div className="space-y-4">
          <Card className="border-green-200 bg-green-50/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-4">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
                <div>
                  <h3 className="text-lg font-bold text-green-800">Importação Concluída com Sucesso!</h3>
                  <p className="text-sm text-green-700">
                    {importResult.totalEquipamentos} equipamentos processados, {importResult.totalLancamentos} lançamentos criados
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                <div className="p-3 rounded-lg bg-white border">
                  <p className="text-xs text-muted-foreground">Lubrificantes</p>
                  <p className="text-lg font-bold">{formatCurrency(importResult.resumo.lubrificantes)}</p>
                </div>
                <div className="p-3 rounded-lg bg-white border">
                  <p className="text-xs text-muted-foreground">Peças de Desgaste</p>
                  <p className="text-lg font-bold">{formatCurrency(importResult.resumo.pecasDesgaste)}</p>
                </div>
                <div className="p-3 rounded-lg bg-white border">
                  <p className="text-xs text-muted-foreground">Peças de Reposição</p>
                  <p className="text-lg font-bold">{formatCurrency(importResult.resumo.pecasReposicao)}</p>
                </div>
                <div className="p-3 rounded-lg bg-white border">
                  <p className="text-xs text-muted-foreground">Outras Despesas</p>
                  <p className="text-lg font-bold">{formatCurrency(importResult.resumo.outrasDespesas)}</p>
                </div>
              </div>

              <div className="mt-4 p-3 rounded-lg bg-white border">
                <p className="text-xs text-muted-foreground">Total Importado</p>
                <p className="text-2xl font-bold">{formatCurrency(importResult.totalImportado)}</p>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => { setStep(1); setFile(null); setFileBase64(""); setParseResult(null); setImportResult(null); setReclassificacoes(new Map()); }}>
              <Upload className="w-4 h-4 mr-2" /> Importar Outro Arquivo
            </Button>
            <Button variant="outline" onClick={() => window.location.href = "/apuracao-custo"}>
              Ver Apuração de Custo
            </Button>
          </div>
        </div>
      )}

      {/* Modal de Detalhamento de Classificação */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2 text-sm sm:text-base">
              <span className="font-bold">{modalEquip?.codigoTag}</span>
              <span className="text-muted-foreground">—</span>
              <span className="truncate">{modalEquip?.descricao}</span>
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              {modalClassificacao && (
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${CLASSIFICACAO_COLORS[modalClassificacao]}`}>
                  {CLASSIFICACAO_LABELS[modalClassificacao]}
                </span>
              )}
              {" "}— {modalItems.length} itens, Total original: {formatCurrency(modalItems.reduce((s, i) => s + i.custo, 0))}
              {(() => {
                const excCount = modalItems.filter(i => itensExcluidos.has(`${modalEquip?.codigoTag}:${i.sequencia}`)).length;
                const activeTotal = modalItems.filter(i => !itensExcluidos.has(`${modalEquip?.codigoTag}:${i.sequencia}`)).reduce((s, i) => s + i.custo, 0);
                if (excCount > 0) return ` | Excluídos: ${excCount}, Total efetivo: ${formatCurrency(activeTotal)}`;
                return "";
              })()}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-auto">
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 bg-background z-10">
                <tr className="border-b">
                  <th className="p-2 text-left w-[40px]">
                    <Checkbox
                      checked={modalItems.every(i => !itensExcluidos.has(`${modalEquip?.codigoTag}:${i.sequencia}`))}
                      onCheckedChange={(checked) => {
                        if (!modalEquip) return;
                        setItensExcluidos(prev => {
                          const next = new Set(prev);
                          for (const item of modalItems) {
                            const key = `${modalEquip.codigoTag}:${item.sequencia}`;
                            if (checked) next.delete(key);
                            else next.add(key);
                          }
                          return next;
                        });
                      }}
                    />
                  </th>
                  <th className="p-2 text-left w-[50px]">Seq</th>
                  <th className="p-2 text-left w-[70px]">Data</th>
                  <th className="p-2 text-left">Produto</th>
                  <th className="p-2 text-right w-[80px]">Valor</th>
                  <th className="p-2 text-center w-[130px] hidden sm:table-cell">Reclassificar</th>
                </tr>
              </thead>
              <tbody>
                {modalItems.map((item, idx) => {
                  const key = `${modalEquip?.codigoTag}:${item.sequencia}`;
                  const isExcluded = itensExcluidos.has(key);
                  const isReclassified = reclassificacoes.has(key);
                  return (
                    <tr
                      key={idx}
                      className={`border-b transition-colors ${
                        isExcluded ? "bg-red-50 opacity-60 line-through" :
                        isReclassified ? "bg-amber-50" : "hover:bg-muted/50"
                      }`}
                    >
                      <td className="p-2">
                        <Checkbox
                          checked={!isExcluded}
                          onCheckedChange={() => {
                            if (modalEquip) toggleItemExclusao(modalEquip.codigoTag, item.sequencia);
                          }}
                        />
                      </td>
                      <td className="p-2">{item.sequencia}</td>
                      <td className="p-2">{item.data}</td>
                      <td className="p-2 font-medium max-w-[200px] sm:max-w-none truncate" title={item.produto}>{item.produto}</td>
                      <td className="p-2 text-right font-medium whitespace-nowrap">{formatCurrency(item.custo)}</td>
                      <td className="p-2 text-center hidden sm:table-cell">
                        <Select
                          value={getEffectiveClassificacao(modalEquip?.codigoTag || "", item.sequencia, item.classificacao)}
                          onValueChange={(v) => {
                            if (modalEquip) {
                              reclassificarItem(modalEquip.codigoTag, item.sequencia, v as Classificacao);
                            }
                          }}
                          disabled={isExcluded}
                        >
                          <SelectTrigger className="h-7 text-xs w-[120px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.keys(CLASSIFICACAO_LABELS) as Classificacao[]).map(c => (
                              <SelectItem key={c} value={c} className="text-xs">
                                {CLASSIFICACAO_SHORT[c]}: {CLASSIFICACAO_LABELS[c]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between pt-3 border-t gap-2 flex-wrap">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {(() => {
                const excCount = modalItems.filter(i => itensExcluidos.has(`${modalEquip?.codigoTag}:${i.sequencia}`)).length;
                return excCount > 0 ? (
                  <span className="text-red-600 font-medium">{excCount} item(ns) excluído(s)</span>
                ) : null;
              })()}
              {reclassificacoes.size > 0 && (
                <span className="text-amber-600 font-medium">{reclassificacoes.size} item(ns) reclassificado(s)</span>
              )}
            </div>
            <Button onClick={() => setModalOpen(false)} size="sm">
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
