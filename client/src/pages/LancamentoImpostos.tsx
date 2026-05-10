import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Trash2, Edit2, Plus, Receipt, FileText, Calculator } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

function formatCurrency(value: number | string): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function LancamentoImpostos() {
  const [periodoId, setPeriodoId] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Form state
  const [formValor, setFormValor] = useState("");
  const [formDescricao, setFormDescricao] = useState("");
  const [formPeriodoId, setFormPeriodoId] = useState<string>("");

  // Queries
  const { data: periodos } = trpc.periodoCusto.list.useQuery();
  const { data: lancamentos, refetch: refetchLancamentos } = trpc.impostos.listByPeriodo.useQuery(
    { periodoCustoId: periodoId! },
    { enabled: !!periodoId }
  );
  const { data: resumo, refetch: refetchResumo } = trpc.impostos.resumoPorPeriodo.useQuery(
    { periodoCustoId: periodoId! },
    { enabled: !!periodoId }
  );

  // Mutations
  const createMutation = trpc.impostos.create.useMutation({
    onSuccess: () => {
      toast.success("Lançamento de imposto criado com sucesso!");
      refetchLancamentos();
      refetchResumo();
      resetForm();
      setDialogOpen(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.impostos.update.useMutation({
    onSuccess: () => {
      toast.success("Lançamento atualizado com sucesso!");
      refetchLancamentos();
      refetchResumo();
      resetForm();
      setDialogOpen(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.impostos.delete.useMutation({
    onSuccess: () => {
      toast.success("Lançamento excluído com sucesso!");
      refetchLancamentos();
      refetchResumo();
    },
    onError: (err) => toast.error(err.message),
  });

  const periodoSelecionado = useMemo(
    () => periodos?.find(p => p.id === periodoId),
    [periodos, periodoId]
  );

  function resetForm() {
    setFormValor("");
    setFormDescricao("");
    setFormPeriodoId("");
    setEditingId(null);
  }

  function openCreateDialog() {
    resetForm();
    if (periodoId) setFormPeriodoId(String(periodoId));
    setDialogOpen(true);
  }

  function openEditDialog(lanc: any) {
    setEditingId(lanc.id);
    setFormValor(String(lanc.valor));
    // Extrair a descrição removendo o prefixo "[Impostos Manual] "
    const obs = lanc.observacoes || "";
    const desc = obs.replace("[Impostos Manual] ", "");
    setFormDescricao(desc);
    if (periodoId) setFormPeriodoId(String(periodoId));
    setDialogOpen(true);
  }

  function handleSubmit() {
    if (!formValor) {
      toast.error("Informe o valor dos impostos.");
      return;
    }

    const targetPeriodoId = editingId ? periodoId! : Number(formPeriodoId);
    if (!targetPeriodoId) {
      toast.error("Selecione o período de apropriação.");
      return;
    }

    if (editingId) {
      updateMutation.mutate({
        id: editingId,
        valor: formValor,
        descricao: formDescricao || undefined,
      });
    } else {
      createMutation.mutate({
        periodoCustoId: targetPeriodoId,
        valor: formValor,
        descricao: formDescricao || undefined,
      });
    }
  }

  // Selecionar o período mais recente automaticamente
  if (periodos && periodos.length > 0 && periodoId === null) {
    setPeriodoId(periodos[0].id);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Lançamento de Impostos</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Previsão de impostos apurados por competência (ICMS, PIS, COFINS, CEFEM, etc.)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select
            value={periodoId?.toString() ?? ""}
            onValueChange={(v) => setPeriodoId(Number(v))}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Selecione o período" />
            </SelectTrigger>
            <SelectContent>
              {periodos?.map((p) => (
                <SelectItem key={p.id} value={p.id.toString()}>
                  {p.mes}/{p.ano}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={openCreateDialog} disabled={!periodoId}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Lançamento
          </Button>
        </div>
      </div>

      {/* Resumo Cards */}
      {resumo && periodoId && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-500/10">
                  <Receipt className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Impostos Manual</p>
                  <p className="text-lg font-semibold">{formatCurrency(resumo.totalManual)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <FileText className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Impostos Importado</p>
                  <p className="text-lg font-semibold">{formatCurrency(resumo.totalImportado)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Calculator className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total da Conta</p>
                  <p className="text-lg font-semibold text-blue-600">{formatCurrency(resumo.totalGeral)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabela de Lançamentos Manuais */}
      {periodoId && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">
                Lançamentos Manuais — {periodoSelecionado ? `${periodoSelecionado.mes}/${periodoSelecionado.ano}` : ""}
              </h2>
              {periodoSelecionado?.fechado === "sim" && (
                <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-medium">
                  Período Fechado
                </span>
              )}
            </div>

            {!lancamentos || lancamentos.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Receipt className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p>Nenhum lançamento manual de impostos neste período.</p>
                <p className="text-xs mt-1">Clique em "Novo Lançamento" para adicionar a previsão de impostos.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-2 font-medium">#</th>
                      <th className="pb-2 font-medium">Descrição</th>
                      <th className="pb-2 font-medium text-right">Valor</th>
                      <th className="pb-2 font-medium text-right">Data</th>
                      <th className="pb-2 font-medium text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lancamentos.map((lanc: any, idx: number) => (
                      <tr key={lanc.id} className="border-b hover:bg-muted/50">
                        <td className="py-2 text-muted-foreground">{idx + 1}</td>
                        <td className="py-2">
                          <span className="font-medium">
                            {lanc.observacoes?.replace("[Impostos Manual] ", "") || "Previsão de Impostos"}
                          </span>
                        </td>
                        <td className="py-2 text-right font-semibold text-red-600">
                          {formatCurrency(lanc.valor)}
                        </td>
                        <td className="py-2 text-right text-muted-foreground text-xs">
                          {lanc.createdAt ? new Date(lanc.createdAt).toLocaleDateString("pt-BR") : "-"}
                        </td>
                        <td className="py-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => openEditDialog(lanc)}
                              disabled={periodoSelecionado?.fechado === "sim"}
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive"
                                  disabled={periodoSelecionado?.fechado === "sim"}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Excluir lançamento?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Esta ação não pode ser desfeita. O valor será removido da conta de impostos.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteMutation.mutate({ id: lanc.id })}>
                                    Excluir
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 font-bold">
                      <td colSpan={2} className="pt-3">Total Manual</td>
                      <td className="pt-3 text-right text-red-600">
                        {formatCurrency(lancamentos.reduce((sum: number, l: any) => sum + Number(l.valor || 0), 0))}
                      </td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Informação sobre a conta */}
      {periodoId && (
        <Card className="border-dashed">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10 mt-0.5">
                <FileText className="h-4 w-4 text-blue-500" />
              </div>
              <div className="text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">Como funciona</p>
                <p>
                  Os valores lançados aqui são somados automaticamente à conta <strong>"Impostos, CEFEM e Outras Taxas"</strong> na 
                  Apuração de Custo. Informe o valor total da previsão de impostos apurados pela competência 
                  (ICMS + PIS + COFINS + CEFEM + CSLL + IRPJ + SIMPLES). Os valores importados da planilha DataGold 
                  continuam sendo exibidos separadamente.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialog de Criação/Edição */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Editar Lançamento de Imposto" : "Novo Lançamento de Imposto"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Período de Apropriação */}
            {!editingId && (
              <div className="space-y-2">
                <Label>Período de Apropriação *</Label>
                <Select value={formPeriodoId} onValueChange={setFormPeriodoId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o período" />
                  </SelectTrigger>
                  <SelectContent>
                    {periodos?.map((p) => (
                      <SelectItem key={p.id} value={p.id.toString()}>
                        {p.mes}/{p.ano} {p.fechado === "sim" ? "(Fechado)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Valor */}
            <div className="space-y-2">
              <Label>Valor dos Impostos (R$) *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="Ex: 309340.07"
                value={formValor}
                onChange={(e) => setFormValor(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Informe o valor total da previsão (ICMS + PIS + COFINS + CEFEM + CSLL + IRPJ + SIMPLES)
              </p>
            </div>

            {/* Descrição */}
            <div className="space-y-2">
              <Label>Descrição / Composição</Label>
              <Textarea
                placeholder="Ex: ICMS R$65.747,49 + PIS R$34.412,60 + COFINS R$158.827,39 + CEFEM R$50.352,59"
                value={formDescricao}
                onChange={(e) => setFormDescricao(e.target.value)}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Opcional. Detalhe a composição dos impostos para referência futura.
              </p>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
