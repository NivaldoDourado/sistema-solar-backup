import { useState, useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, XCircle, ArrowRight, ArrowLeft, Loader2, Info } from "lucide-react";

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

type ClassificacaoLabel = {
  lubrificantes: string;
  pecas_desgaste: string;
  outras_despesas: string;
  pecas_reposicao: string;
};

const CLASSIFICACAO_LABELS: ClassificacaoLabel = {
  lubrificantes: "Lubrificantes",
  pecas_desgaste: "Peças de Desgaste",
  outras_despesas: "Outras Despesas",
  pecas_reposicao: "Peças de Reposição / Itens de Consumo",
};

const CLASSIFICACAO_COLORS: ClassificacaoLabel = {
  lubrificantes: "bg-blue-100 text-blue-800",
  pecas_desgaste: "bg-orange-100 text-orange-800",
  outras_despesas: "bg-purple-100 text-purple-800",
  pecas_reposicao: "bg-green-100 text-green-800",
};

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
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
      // Inicializar seleção com os equipamentos que não são excluídos
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
      const result = await importMutation.mutateAsync({
        fileBase64,
        fileName: file.name,
        mes,
        ano,
        equipamentosSelecionados: Array.from(selecionados).map(tag => ({ codigoTag: tag })),
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

  // Resumo dos selecionados
  const resumoSelecionados = useMemo(() => {
    if (!parseResult) return null;
    const selected = parseResult.equipamentos.filter((e: any) => selecionados.has(e.codigoTag));
    return {
      total: selected.length,
      valor: selected.reduce((sum: number, e: any) => sum + e.totalGeral, 0),
      lubrificantes: selected.reduce((sum: number, e: any) => sum + e.totalLubrificantes, 0),
      pecasDesgaste: selected.reduce((sum: number, e: any) => sum + e.totalPecasDesgaste, 0),
      pecasReposicao: selected.reduce((sum: number, e: any) => sum + e.totalPecasReposicao, 0),
      outrasDespesas: selected.reduce((sum: number, e: any) => sum + e.totalOutrasDespesas, 0),
      combustivel: selected.reduce((sum: number, e: any) => sum + (e.totalCombustivel || 0), 0),
    };
  }, [parseResult, selecionados]);

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
                {parseResult.equipamentos.map((equip: any, idx: number) => (
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
                      {/* Mini breakdown */}
                      <div className="flex gap-2 mt-1.5 flex-wrap">
                        {equip.totalLubrificantes > 0 && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">Lub: {formatCurrency(equip.totalLubrificantes)}</span>
                        )}
                        {equip.totalPecasDesgaste > 0 && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-orange-100 text-orange-700">Desg: {formatCurrency(equip.totalPecasDesgaste)}</span>
                        )}
                        {equip.totalPecasReposicao > 0 && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700">Rep: {formatCurrency(equip.totalPecasReposicao)}</span>
                        )}
                        {equip.totalOutrasDespesas > 0 && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">Outras: {formatCurrency(equip.totalOutrasDespesas)}</span>
                        )}
                        {equip.totalCombustivel > 0 && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700">Comb: {formatCurrency(equip.totalCombustivel)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
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
            <Button variant="outline" onClick={() => { setStep(1); setFile(null); setFileBase64(""); setParseResult(null); setImportResult(null); }}>
              <Upload className="w-4 h-4 mr-2" /> Importar Outro Arquivo
            </Button>
            <Button variant="outline" onClick={() => window.location.href = "/apuracao-custo"}>
              Ver Apuração de Custo
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
