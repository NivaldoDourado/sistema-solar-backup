import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Info, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";

interface ImportResult {
  success: boolean;
  periodo: { mes: number; ano: number; id: number };
  producaoTotal: number;
  quantidadeVendida: number;
  totalLancamentos: number;
  mapeados: number;
  naoMapeados: string[];
  created: number;
  updated: number;
}

interface ImportRasResult {
  success: boolean;
  periodoCustoId: number;
  mes: number;
  ano: number;
  equipamentosImportados: number;
  despesasImportadas: number;
  criados: number;
  atualizados: number;
  erros: string[];
}

const MESES = [
  "", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

function formatNum(n: number) {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type ImportStep = "idle" | "step1" | "step2" | "done";

export default function ImportacaoCusto() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<ImportStep>("idle");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [rasResult, setRasResult] = useState<ImportRasResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setResult(null);
      setRasResult(null);
      setError(null);
      setStep("idle");
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f && (f.name.endsWith(".xlsx") || f.name.endsWith(".xls"))) {
      setFile(f);
      setResult(null);
      setRasResult(null);
      setError(null);
      setStep("idle");
    } else {
      toast.error("Arquivo inválido. Apenas arquivos .xlsx ou .xls são aceitos.");
    }
  }

  async function handleImport() {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setRasResult(null);

    try {
      // ── Etapa 1: Importar MEMGERAL (lançamentos consolidados por conta) ──
      setStep("step1");
      const formData1 = new FormData();
      formData1.append("file", file);

      const response1 = await fetch("/api/importacao-custo", {
        method: "POST",
        body: formData1,
        credentials: "include",
      });

      const data1 = await response1.json();

      if (!response1.ok || !data1.success) {
        setError(data1.error ?? "Erro desconhecido na importação (Etapa 1)");
        setStep("idle");
        return;
      }

      setResult(data1);

      // ── Etapa 2: Importar MEM+MSET (equipamentos e despesas analíticas por setor) ──
      setStep("step2");
      const formData2 = new FormData();
      formData2.append("file", file);

      const response2 = await fetch("/api/importacao-custo-setor-ras", {
        method: "POST",
        body: formData2,
        credentials: "include",
      });

      const data2 = await response2.json();

      if (!response2.ok || !data2.success) {
        // Etapa 1 foi bem-sucedida; apenas alertar sobre a etapa 2
        toast.warning(
          `Etapa 1 concluída, mas houve erro na importação analítica (MEM+MSET): ${data2.error ?? "Erro desconhecido"}`
        );
      } else {
        setRasResult(data2);
      }

      setStep("done");
      toast.success(
        `Importação concluída! ${data1.created + data1.updated} lançamentos + ${data2.equipamentosImportados ?? 0} equipamentos + ${data2.despesasImportadas ?? 0} despesas analíticas para ${MESES[data1.periodo.mes]}/${data1.periodo.ano}.`
      );
    } catch (err: any) {
      setError(err?.message ?? "Erro de rede. Tente novamente.");
      setStep("idle");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container py-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Importação de Planilha de Custos</h1>
        <p className="text-muted-foreground mt-1">
          Importe a planilha CUSTOSOLAR (.xlsx) para registrar automaticamente os lançamentos de custo do período.
        </p>
      </div>

      {/* Instruções */}
      <Alert className="mb-6 border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800">
        <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <AlertDescription className="text-blue-800 dark:text-blue-300">
          <strong>Como funciona:</strong> O sistema executa duas etapas automaticamente:
          <ol className="mt-2 space-y-1 list-decimal list-inside text-sm">
            <li>
              Lê a aba <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded text-xs">MEMGERAL</code> e importa os totais consolidados por tipo de desembolso (Plano de Contas).
            </li>
            <li>
              Lê as abas <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded text-xs">MEM</code> e <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded text-xs">MSET</code> e importa os custos analíticos por equipamento e despesa setorial (Relatório Analítico por Setor).
            </li>
          </ol>
          <span className="text-sm mt-2 block">
            Certifique-se de que os nomes das contas no sistema coincidem com os da planilha. Contas não mapeadas serão listadas no resultado.
          </span>
        </AlertDescription>
      </Alert>

      {/* Upload */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Selecionar Arquivo</CardTitle>
          <CardDescription>Arraste e solte ou clique para selecionar a planilha CUSTOSOLAR</CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragging
                ? "border-primary bg-primary/5"
                : file
                ? "border-green-400 bg-green-50 dark:bg-green-950/20"
                : "border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/30"
            }`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFileChange}
            />
            {file ? (
              <div className="flex flex-col items-center gap-2">
                <FileSpreadsheet className="h-10 w-10 text-green-600" />
                <p className="font-medium text-green-700 dark:text-green-400">{file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(file.size / 1024 / 1024).toFixed(2)} MB — clique para trocar
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-10 w-10 text-muted-foreground/50" />
                <p className="font-medium text-muted-foreground">Arraste a planilha aqui</p>
                <p className="text-sm text-muted-foreground">ou clique para selecionar (.xlsx)</p>
              </div>
            )}
          </div>

          {file && (
            <Button
              className="mt-4 w-full"
              onClick={handleImport}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {step === "step1" ? "Etapa 1/2: Importando MEMGERAL..." : "Etapa 2/2: Importando MEM+MSET..."}
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Importar Planilha
                </>
              )}
            </Button>
          )}

          {/* Barra de progresso das etapas */}
          {loading && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-3">
                <div className={`flex items-center gap-2 flex-1 rounded-lg px-3 py-2 text-sm transition-colors ${
                  step === "step1" ? "bg-blue-50 border border-blue-200 text-blue-700" :
                  step === "step2" || step === "done" ? "bg-green-50 border border-green-200 text-green-700" :
                  "bg-muted/30 text-muted-foreground"
                }`}>
                  {step === "step1" ? <Loader2 className="h-3 w-3 animate-spin" /> :
                   (step === "step2" || step === "done") ? <CheckCircle className="h-3 w-3" /> :
                   <div className="h-3 w-3 rounded-full border border-current" />}
                  Etapa 1: MEMGERAL (Plano de Contas)
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className={`flex items-center gap-2 flex-1 rounded-lg px-3 py-2 text-sm transition-colors ${
                  step === "step2" ? "bg-blue-50 border border-blue-200 text-blue-700" :
                  step === "done" ? "bg-green-50 border border-green-200 text-green-700" :
                  "bg-muted/30 text-muted-foreground"
                }`}>
                  {step === "step2" ? <Loader2 className="h-3 w-3 animate-spin" /> :
                   step === "done" ? <CheckCircle className="h-3 w-3" /> :
                   <div className="h-3 w-3 rounded-full border border-current" />}
                  Etapa 2: MEM+MSET (Analítico por Setor)
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Erro */}
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Resultado */}
      {result && step === "done" && (
        <Card className="border-green-200 dark:border-green-800">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <CardTitle className="text-base text-green-700 dark:text-green-400">
                Importação concluída com sucesso
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Período */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Período</p>
                <p className="font-semibold">{MESES[result.periodo.mes]}/{result.periodo.ano}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Produção Total (ton)</p>
                <p className="font-semibold">{result.producaoTotal > 0 ? formatNum(result.producaoTotal) : "—"}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Qtd. Vendida (ton)</p>
                <p className="font-semibold">{result.quantidadeVendida > 0 ? formatNum(result.quantidadeVendida) : "—"}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Lançamentos MEMGERAL</p>
                <p className="font-semibold">{result.totalLancamentos}</p>
              </div>
            </div>

            {/* Resumo Etapa 1 */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Etapa 1 — MEMGERAL (Plano de Contas)</p>
              <div className="flex gap-3">
                <div className="flex-1 bg-green-50 dark:bg-green-950/30 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-green-700 dark:text-green-400">{result.mapeados}</p>
                  <p className="text-xs text-green-600 dark:text-green-500">Contas mapeadas</p>
                </div>
                <div className="flex-1 bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold">{result.created}</p>
                  <p className="text-xs text-muted-foreground">Criados</p>
                </div>
                <div className="flex-1 bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold">{result.updated}</p>
                  <p className="text-xs text-muted-foreground">Atualizados</p>
                </div>
              </div>
            </div>

            {/* Resumo Etapa 2 */}
            {rasResult && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Etapa 2 — MEM+MSET (Analítico por Setor)</p>
                <div className="flex gap-3">
                  <div className="flex-1 bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{rasResult.equipamentosImportados}</p>
                    <p className="text-xs text-blue-600 dark:text-blue-500">Equipamentos</p>
                  </div>
                  <div className="flex-1 bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{rasResult.despesasImportadas}</p>
                    <p className="text-xs text-blue-600 dark:text-blue-500">Despesas setoriais</p>
                  </div>
                  <div className="flex-1 bg-muted/50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold">{rasResult.criados + rasResult.atualizados}</p>
                    <p className="text-xs text-muted-foreground">Registros</p>
                  </div>
                </div>
                {rasResult.erros.length > 0 && (
                  <Alert className="mt-3 border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-amber-800 dark:text-amber-300">
                      <strong>{rasResult.erros.length} aviso(s) na importação analítica:</strong>
                      <ul className="mt-2 space-y-1 text-sm">
                        {rasResult.erros.slice(0, 5).map((e, i) => (
                          <li key={i} className="text-xs">{e}</li>
                        ))}
                        {rasResult.erros.length > 5 && (
                          <li className="text-xs text-muted-foreground">...e mais {rasResult.erros.length - 5} avisos</li>
                        )}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            {/* Contas não mapeadas */}
            {result.naoMapeados.length > 0 && (
              <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800 dark:text-amber-300">
                  <strong>{result.naoMapeados.length} conta(s) não encontrada(s) no sistema:</strong>
                  <ul className="mt-2 space-y-1">
                    {result.naoMapeados.map((nome) => (
                      <li key={nome} className="flex items-center gap-2">
                        <Badge variant="outline" className="text-amber-700 border-amber-400 text-xs">{nome}</Badge>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-sm">
                    Cadastre essas contas em <strong>Planos de Conta</strong> com o mesmo nome e reimporte.
                  </p>
                </AlertDescription>
              </Alert>
            )}

            {/* Links de navegação */}
            <div className="flex gap-3">
              <Link href="/apuracao-custo" className="flex-1">
                <Button variant="outline" className="w-full">
                  Ver Apuração de Custo
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
              <Link href="/custo-setor-analitico" className="flex-1">
                <Button variant="outline" className="w-full">
                  Ver Relatório Analítico
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
