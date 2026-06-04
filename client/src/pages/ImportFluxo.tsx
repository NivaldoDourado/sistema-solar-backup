import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, XCircle,
  ArrowRight, ArrowLeft, Loader2, Info, ChevronDown, ChevronRight,
  Building2, Banknote, Zap, Settings2, Plus, Trash2
} from "lucide-react";

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export default function ImportFluxo() {
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<any>(null);
  const [importResult, setImportResult] = useState<any>(null);
  const [expandedContas, setExpandedContas] = useState<Set<string>>(new Set());

  // Subcontas excluídas temporariamente (apenas neste período, não vai para "Contas Excluídas")
  // Key format: "contaPrincipalCodigo::subcontaCodigo"
  const [subcontasExcluidas, setSubcontasExcluidas] = useState<Set<string>>(new Set());

  // Dialog de gerenciamento de contas excluídas
  const [showExcluidas, setShowExcluidas] = useState(false);
  const [novaCodigo, setNovaCodigo] = useState("");
  const [novaNome, setNovaNome] = useState("");
  const [novaMotivo, setNovaMotivo] = useState("");

  // Período
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [ano, setAno] = useState(now.getFullYear());

  const periodosQuery = trpc.periodoCusto.list.useQuery();
  const parseMutation = trpc.importFluxo.parsePlanilha.useMutation();
  const importMutation = trpc.importFluxo.confirmarImportacao.useMutation();

  // Contas excluídas
  const contasExcluidasQuery = trpc.contaExcluida.listar.useQuery();
  const adicionarExcluida = trpc.contaExcluida.adicionar.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success(result.message);
        setNovaCodigo("");
        setNovaNome("");
        setNovaMotivo("");
        contasExcluidasQuery.refetch();
      } else {
        toast.error(result.message);
      }
    },
    onError: (err) => toast.error("Erro ao adicionar: " + err.message),
  });
  const removerExcluida = trpc.contaExcluida.remover.useMutation({
    onSuccess: () => {
      toast.success("Conta restaurada (removida da lista de exclusão)");
      contasExcluidasQuery.refetch();
    },
    onError: (err) => toast.error("Erro ao remover: " + err.message),
  });

  // Encontrar ou criar período
  const periodoAtual = useMemo(() => {
    if (!periodosQuery.data) return null;
    return periodosQuery.data.find(
      (p: any) => p.mes === mes && p.ano === ano
    );
  }, [periodosQuery.data, mes, ano]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);

    try {
      const buffer = await f.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
      );

      const result = await parseMutation.mutateAsync({ fileBase64: base64 });
      setParsed(result);
      setSubcontasExcluidas(new Set()); // Reset exclusões temporárias
      setStep(2);
      toast.success(`Planilha processada: ${result.contasImportar.length} contas para importar`);
    } catch (err: any) {
      toast.error("Erro ao processar planilha: " + (err.message || "Erro desconhecido"));
    }
  };

  // Calcular totais efetivos (descontando subcontas excluídas temporariamente)
  const { totalImportarEfetivo, contasImportarFiltradas } = useMemo(() => {
    if (!parsed) return { totalImportarEfetivo: 0, contasImportarFiltradas: [] };

    const filtradas = parsed.contasImportar.map((conta: any) => {
      const subcontasFiltradas = conta.subcontas.filter((sub: any) => {
        const key = `${conta.contaPrincipalCodigo}::${sub.codigo}`;
        return !subcontasExcluidas.has(key);
      });
      const valorEfetivo = subcontasFiltradas.reduce((sum: number, s: any) => sum + s.valor, 0);
      return {
        ...conta,
        subcontas: subcontasFiltradas,
        valorTotal: valorEfetivo,
      };
    });

    const total = filtradas.reduce((sum: number, c: any) => sum + c.valorTotal, 0);
    return { totalImportarEfetivo: total, contasImportarFiltradas: filtradas };
  }, [parsed, subcontasExcluidas]);

  const handleConfirmar = async () => {
    if (!periodoAtual || !parsed) return;

    try {
      const result = await importMutation.mutateAsync({
        periodoCustoId: periodoAtual.id,
        contasImportar: contasImportarFiltradas,
      });
      setImportResult(result);
      setStep(3);
      toast.success(`Importação concluída: ${result.totalInseridos} lançamentos criados`);
    } catch (err: any) {
      toast.error("Erro na importação: " + (err.message || "Erro desconhecido"));
    }
  };

  const toggleExpand = (codigo: string) => {
    setExpandedContas(prev => {
      const next = new Set(prev);
      if (next.has(codigo)) next.delete(codigo);
      else next.add(codigo);
      return next;
    });
  };

  const toggleSubcontaExcluida = (contaCodigo: string, subCodigo: string) => {
    setSubcontasExcluidas(prev => {
      const next = new Set(prev);
      const key = `${contaCodigo}::${subCodigo}`;
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleAllSubcontas = (contaCodigo: string, subcontas: any[], allExcluded: boolean) => {
    setSubcontasExcluidas(prev => {
      const next = new Set(prev);
      for (const sub of subcontas) {
        const key = `${contaCodigo}::${sub.codigo}`;
        if (allExcluded) {
          next.delete(key); // Re-incluir todas
        } else {
          next.add(key); // Excluir todas
        }
      }
      return next;
    });
  };

  const handleAdicionarExcluida = () => {
    if (!novaCodigo.trim() || !novaNome.trim()) {
      toast.error("Código e Nome são obrigatórios");
      return;
    }
    adicionarExcluida.mutate({
      codigo: novaCodigo.trim(),
      nome: novaNome.trim(),
      motivo: novaMotivo.trim() || undefined,
    });
  };

  const totalImportar = parsed?.totalImportar || 0;
  const totalExcluir = parsed?.totalExcluir || 0;

  // Contar subcontas excluídas por conta principal
  const getExcluidasCount = (contaCodigo: string, subcontas: any[]) => {
    return subcontas.filter((sub: any) => subcontasExcluidas.has(`${contaCodigo}::${sub.codigo}`)).length;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Fluxo Realizado</h1>
          <p className="text-muted-foreground">
            Importação do relatório de Fluxo de Caixa (DataGold) para apropriação de despesas administrativas e setoriais
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => setShowExcluidas(true)}
          className="gap-2"
        >
          <Settings2 className="h-4 w-4" />
          Contas Excluídas
          {contasExcluidasQuery.data && contasExcluidasQuery.data.length > 0 && (
            <Badge variant="secondary" className="ml-1">{contasExcluidasQuery.data.length}</Badge>
          )}
        </Button>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center gap-2 text-sm">
        <Badge variant={step >= 1 ? "default" : "outline"}>1. Upload</Badge>
        <ArrowRight className="h-3 w-3 text-muted-foreground" />
        <Badge variant={step >= 2 ? "default" : "outline"}>2. Revisão</Badge>
        <ArrowRight className="h-3 w-3 text-muted-foreground" />
        <Badge variant={step >= 3 ? "default" : "outline"}>3. Resultado</Badge>
      </div>

      {/* Step 1: Upload */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload da Planilha
            </CardTitle>
            <CardDescription>
              Selecione o arquivo "XX MÊSFLUXOREALIZADO.xls" exportado do DataGold
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Seleção de período */}
            <div className="flex gap-4">
              <div className="flex-1">
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
              <div className="flex-1">
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

            {!periodoAtual && (
              <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                <AlertTriangle className="h-4 w-4" />
                <span>Período {MESES[mes - 1]}/{ano} não encontrado. Crie-o primeiro na tela de Períodos de Custo.</span>
              </div>
            )}

            {periodoAtual && (
              <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
                <CheckCircle2 className="h-4 w-4" />
                <span>Período {MESES[mes - 1]}/{ano} encontrado (ID: {periodoAtual.id})</span>
              </div>
            )}

            {/* Upload */}
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept=".xls,.xlsx"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={!periodoAtual || parseMutation.isPending}
                />
                <span className="text-primary hover:underline font-medium">
                  {parseMutation.isPending ? "Processando..." : "Clique para selecionar arquivo"}
                </span>
              </label>
              {file && <p className="text-sm text-muted-foreground mt-2">{file.name}</p>}
            </div>

            {parseMutation.isPending && (
              <div className="flex items-center gap-2 justify-center">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Processando planilha...</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 2: Revisão */}
      {step === 2 && parsed && (
        <div className="space-y-4">
          {/* Resumo */}
          <Card>
            <CardHeader>
              <CardTitle>Resumo da Importação</CardTitle>
              <CardDescription>
                Período detectado: {parsed.periodo || `${MESES[mes - 1]}/${ano}`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-sm text-green-700 font-medium">Total a Importar</p>
                  <p className="text-xl font-bold text-green-800">{formatCurrency(totalImportarEfetivo)}</p>
                  <p className="text-xs text-green-600">{parsed.contasImportar.length} contas</p>
                  {subcontasExcluidas.size > 0 && (
                    <p className="text-xs text-orange-600 mt-1">
                      ({subcontasExcluidas.size} subconta(s) desmarcada(s): -{formatCurrency(totalImportar - totalImportarEfetivo)})
                    </p>
                  )}
                </div>
                <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                  <p className="text-sm text-red-700 font-medium">Total Excluído</p>
                  <p className="text-xl font-bold text-red-800">{formatCurrency(totalExcluir)}</p>
                  <p className="text-xs text-red-600">{parsed.contasExcluir.length} contas</p>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-700 font-medium">Total Saídas</p>
                  <p className="text-xl font-bold text-blue-800">{formatCurrency(totalImportarEfetivo + totalExcluir)}</p>
                  <p className="text-xs text-blue-600">Importar + Excluir</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Info sobre exclusão temporária */}
          {subcontasExcluidas.size > 0 && (
            <div className="flex items-start gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-800">
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                <strong>{subcontasExcluidas.size} subconta(s) desmarcada(s)</strong> nesta importação. 
                Elas não serão importadas neste período, mas continuarão disponíveis em importações futuras 
                (não são adicionadas à lista de "Contas Excluídas" permanentes).
              </span>
            </div>
          )}

          {/* Contas a Importar */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                Contas a Importar ({parsed.contasImportar.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {parsed.contasImportar.map((conta: any) => {
                const exclCount = getExcluidasCount(conta.contaPrincipalCodigo, conta.subcontas);
                const valorEfetivo = conta.subcontas
                  .filter((sub: any) => !subcontasExcluidas.has(`${conta.contaPrincipalCodigo}::${sub.codigo}`))
                  .reduce((sum: number, s: any) => sum + s.valor, 0);

                return (
                  <div key={conta.contaPrincipalCodigo} className="border rounded-lg">
                    <div
                      className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50"
                      onClick={() => toggleExpand(conta.contaPrincipalCodigo)}
                    >
                      <div className="flex items-center gap-3">
                        {expandedContas.has(conta.contaPrincipalCodigo) ?
                          <ChevronDown className="h-4 w-4" /> :
                          <ChevronRight className="h-4 w-4" />
                        }
                        <div>
                          <p className="font-medium">
                            {conta.contaPrincipalCodigo}-{conta.contaPrincipalNome}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge variant="outline" className="text-xs">
                              <Banknote className="h-3 w-3 mr-1" />
                              {conta.contaSistema}
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              <Building2 className="h-3 w-3 mr-1" />
                              {conta.setor}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-bold ${exclCount > 0 ? "text-orange-600" : "text-green-700"}`}>
                          {formatCurrency(valorEfetivo)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {conta.subcontas.length} itens
                          {exclCount > 0 && (
                            <span className="text-orange-500 ml-1">({exclCount} desmarcado(s))</span>
                          )}
                        </p>
                      </div>
                    </div>

                    {expandedContas.has(conta.contaPrincipalCodigo) && (
                      <div className="border-t px-3 pb-3">
                        <table className="w-full text-sm mt-2">
                          <thead>
                            <tr className="text-muted-foreground text-xs">
                              <th className="text-left py-1 w-8">
                                <Checkbox
                                  checked={exclCount === 0}
                                  onCheckedChange={() => {
                                    const allExcluded = exclCount === conta.subcontas.length;
                                    toggleAllSubcontas(conta.contaPrincipalCodigo, conta.subcontas, allExcluded);
                                  }}
                                />
                              </th>
                              <th className="text-left py-1">Código</th>
                              <th className="text-left py-1">Nome</th>
                              <th className="text-left py-1">Setor</th>
                              <th className="text-right py-1">Valor</th>
                            </tr>
                          </thead>
                          <tbody>
                            {conta.subcontas.map((sub: any, idx: number) => {
                              const isExcluida = subcontasExcluidas.has(`${conta.contaPrincipalCodigo}::${sub.codigo}`);
                              return (
                                <tr
                                  key={idx}
                                  className={`border-t border-dashed ${isExcluida ? "opacity-40 line-through bg-red-50" : ""}`}
                                >
                                  <td className="py-1.5">
                                    <Checkbox
                                      checked={!isExcluida}
                                      onCheckedChange={() => toggleSubcontaExcluida(conta.contaPrincipalCodigo, sub.codigo)}
                                    />
                                  </td>
                                  <td className="py-1.5 text-muted-foreground">{sub.codigo}</td>
                                  <td className="py-1.5">
                                    {sub.nome}
                                    {sub.isRateio && (
                                      <Badge variant="outline" className="ml-2 text-xs">
                                        <Zap className="h-3 w-3 mr-1" />
                                        Rateio {Math.round((sub.percentualRateio || 0) * 100)}%
                                      </Badge>
                                    )}
                                  </td>
                                  <td className="py-1.5">
                                    {sub.setor !== conta.setor && (
                                      <Badge variant="secondary" className="text-xs">{sub.setor}</Badge>
                                    )}
                                  </td>
                                  <td className="py-1.5 text-right font-medium">{formatCurrency(sub.valor)}</td>
                                </tr>
                              );
                            })}
                            {conta.excluidas?.length > 0 && (
                              <>
                                <tr className="border-t">
                                  <td colSpan={5} className="py-1.5 text-xs font-medium text-red-600">
                                    Excluídas desta conta (permanentemente):
                                  </td>
                                </tr>
                                {conta.excluidas.map((exc: any, idx: number) => (
                                  <tr key={`exc-${idx}`} className="text-red-500 line-through opacity-60">
                                    <td className="py-1"></td>
                                    <td className="py-1">{exc.codigo}</td>
                                    <td className="py-1">{exc.nome}</td>
                                    <td className="py-1 text-xs">{exc.motivo}</td>
                                    <td className="py-1 text-right">{formatCurrency(exc.valor)}</td>
                                  </tr>
                                ))}
                              </>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Contas Excluídas */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-500" />
                Contas Excluídas ({parsed.contasExcluir.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground text-xs border-b">
                    <th className="text-left py-2">Código</th>
                    <th className="text-left py-2">Nome</th>
                    <th className="text-right py-2">Valor Total</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.contasExcluir.map((conta: any) => (
                    <tr key={conta.codigo} className="border-b text-muted-foreground">
                      <td className="py-2">{conta.codigo}</td>
                      <td className="py-2">{conta.nome}</td>
                      <td className="py-2 text-right">{formatCurrency(conta.valorTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Botões */}
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => { setStep(1); setParsed(null); setFile(null); setSubcontasExcluidas(new Set()); }}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <Button
              onClick={handleConfirmar}
              disabled={importMutation.isPending || !periodoAtual}
              className="bg-green-600 hover:bg-green-700"
            >
              {importMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importando...</>
              ) : (
                <><CheckCircle2 className="h-4 w-4 mr-2" /> Confirmar Importação</>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Resultado */}
      {step === 3 && importResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700">
              <CheckCircle2 className="h-6 w-6" />
              Importação Concluída
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <p className="text-lg font-bold text-green-800">
                {importResult.totalInseridos} lançamentos criados
              </p>
              <p className="text-sm text-green-700">
                Período: {MESES[mes - 1]}/{ano}
              </p>
            </div>

            <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
              <Info className="h-4 w-4" />
              <span>
                Os lançamentos foram gravados e podem ser visualizados na tela de Apuração de Custo.
                Para reimportar, basta fazer upload novamente — os dados anteriores serão substituídos.
              </span>
            </div>

            <Button variant="outline" onClick={() => { setStep(1); setParsed(null); setFile(null); setImportResult(null); setSubcontasExcluidas(new Set()); }}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Nova Importação
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Dialog: Gerenciar Contas Excluídas */}
      <Dialog open={showExcluidas} onOpenChange={setShowExcluidas}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              Gerenciar Contas Excluídas do Fluxo
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4">
            {/* Info */}
            <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                Contas adicionadas aqui serão automaticamente excluídas durante a importação do Fluxo Realizado.
                Isso permite excluir contas individuais sem alterar o código do sistema.
              </span>
            </div>

            {/* Formulário para adicionar */}
            <div className="border rounded-lg p-4 space-y-3">
              <p className="text-sm font-medium">Adicionar Nova Exclusão</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Código *</label>
                  <Input
                    placeholder="Ex: 7047"
                    value={novaCodigo}
                    onChange={(e) => setNovaCodigo(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Nome da Conta *</label>
                  <Input
                    placeholder="Ex: DIRETORIA DIST. LUCRO MAX"
                    value={novaNome}
                    onChange={(e) => setNovaNome(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Motivo (opcional)</label>
                  <Input
                    placeholder="Ex: Não é custo operacional"
                    value={novaMotivo}
                    onChange={(e) => setNovaMotivo(e.target.value)}
                  />
                </div>
              </div>
              <Button
                size="sm"
                onClick={handleAdicionarExcluida}
                disabled={adicionarExcluida.isPending}
                className="gap-1"
              >
                {adicionarExcluida.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Plus className="h-3 w-3" />
                )}
                Adicionar
              </Button>
            </div>

            {/* Lista de contas excluídas */}
            <div className="border rounded-lg">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Código</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Nome</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Motivo</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Data</th>
                    <th className="text-center py-2 px-3 text-xs font-medium text-muted-foreground">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {contasExcluidasQuery.isLoading && (
                    <tr>
                      <td colSpan={5} className="py-4 text-center text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                        Carregando...
                      </td>
                    </tr>
                  )}
                  {contasExcluidasQuery.data && contasExcluidasQuery.data.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-muted-foreground">
                        Nenhuma conta excluída cadastrada. Apenas as exclusões estáticas do código serão aplicadas.
                      </td>
                    </tr>
                  )}
                  {contasExcluidasQuery.data?.map((conta: any) => (
                    <tr key={conta.id} className="border-b hover:bg-muted/30">
                      <td className="py-2 px-3 font-mono font-medium">{conta.codigo}</td>
                      <td className="py-2 px-3">{conta.nome}</td>
                      <td className="py-2 px-3 text-muted-foreground text-xs">{conta.motivo || "—"}</td>
                      <td className="py-2 px-3 text-muted-foreground text-xs">
                        {conta.createdAt ? new Date(conta.createdAt).toLocaleDateString("pt-BR") : "—"}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => {
                            if (confirm(`Remover exclusão da conta ${conta.codigo}-${conta.nome}? Ela voltará a ser importada.`)) {
                              removerExcluida.mutate({ id: conta.id });
                            }
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Info sobre exclusões estáticas */}
            <div className="text-xs text-muted-foreground p-3 bg-muted/30 rounded-lg">
              <p className="font-medium mb-1">Exclusões estáticas (definidas no código):</p>
              <p>2068 - OUTRAS DESP. ADM (compra de areia)</p>
              <p>2304 - PAGAMENTO EMPRESTIMO</p>
              <p className="mt-1 italic">Estas não podem ser removidas por aqui.</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExcluidas(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
