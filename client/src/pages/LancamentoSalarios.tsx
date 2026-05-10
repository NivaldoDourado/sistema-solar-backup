import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { toast } from "sonner";
import { Trash2, Edit2, Plus, DollarSign, Users, Building2, Truck } from "lucide-react";
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

export default function LancamentoSalarios() {
  const [periodoId, setPeriodoId] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Form state
  const [formContaCustoId, setFormContaCustoId] = useState<string>("");
  const [formValor, setFormValor] = useState("");
  const [formEquipamentoId, setFormEquipamentoId] = useState<string>("");
  const [formSetorId, setFormSetorId] = useState<string>("");
  const [formDescricao, setFormDescricao] = useState("");
  const [formObservacoes, setFormObservacoes] = useState("");
  const [formPeriodoId, setFormPeriodoId] = useState<string>("");

  // Queries
  const { data: periodos } = trpc.periodoCusto.list.useQuery();
  const { data: contasSalario } = trpc.salarios.contasSalario.useQuery();
  const { data: lancamentos, refetch: refetchLancamentos } = trpc.salarios.listByPeriodo.useQuery(
    { periodoCustoId: periodoId! },
    { enabled: !!periodoId }
  );
  const { data: resumo } = trpc.salarios.resumoPorPeriodo.useQuery(
    { periodoCustoId: periodoId! },
    { enabled: !!periodoId }
  );
  const { data: equipamentosList } = trpc.equipamentos.list.useQuery();
  const { data: setoresList } = trpc.setores.list.useQuery();

  // Mutations
  const createMutation = trpc.salarios.create.useMutation({
    onSuccess: () => {
      toast.success("Lançamento de salário criado com sucesso!");
      refetchLancamentos();
      resetForm();
      setDialogOpen(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.salarios.update.useMutation({
    onSuccess: () => {
      toast.success("Lançamento atualizado com sucesso!");
      refetchLancamentos();
      resetForm();
      setDialogOpen(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.salarios.delete.useMutation({
    onSuccess: () => {
      toast.success("Lançamento excluído com sucesso!");
      refetchLancamentos();
    },
    onError: (err) => toast.error(err.message),
  });

  // Derived state
  const selectedConta = useMemo(
    () => contasSalario?.find(c => c.id === Number(formContaCustoId)),
    [contasSalario, formContaCustoId]
  );
  const tipoDestino = selectedConta?.tipoDestino;

  // Período selecionado (para exibição na tabela)
  const periodoSelecionado = useMemo(
    () => periodos?.find(p => p.id === periodoId),
    [periodos, periodoId]
  );

  // Options para SearchableSelect
  const equipamentosOptions = useMemo(() => {
    if (!equipamentosList) return [];
    return equipamentosList
      .filter((e: any) => e.ativo === "sim")
      .map((e: any) => ({
        value: String(e.id),
        label: e.codigoTag ? `${e.codigoTag} - ${e.nomeDoEquipamento}` : e.nomeDoEquipamento,
      }));
  }, [equipamentosList]);

  const setoresOptions = useMemo(() => {
    if (!setoresList) return [];
    return setoresList.map((s: any) => ({
      value: String(s.id),
      label: s.nome,
    }));
  }, [setoresList]);

  // Equipamentos e setores para lookup de nomes (tabela)
  const equipamentosMap = useMemo(() => {
    const map: Record<number, string> = {};
    if (equipamentosList) {
      for (const e of equipamentosList as any[]) {
        map[e.id] = e.codigoTag ? `${e.codigoTag} - ${e.nomeDoEquipamento}` : e.nomeDoEquipamento;
      }
    }
    return map;
  }, [equipamentosList]);

  const setoresMap = useMemo(() => {
    const map: Record<number, string> = {};
    if (setoresList) {
      for (const s of setoresList as any[]) {
        map[s.id] = s.nome;
      }
    }
    return map;
  }, [setoresList]);

  function resetForm() {
    setFormContaCustoId("");
    setFormValor("");
    setFormEquipamentoId("");
    setFormSetorId("");
    setFormDescricao("");
    setFormObservacoes("");
    setFormPeriodoId("");
    setEditingId(null);
  }

  function openCreateDialog() {
    resetForm();
    // Pré-selecionar o período da página
    if (periodoId) setFormPeriodoId(String(periodoId));
    setDialogOpen(true);
  }

  function openEditDialog(lanc: any) {
    setEditingId(lanc.id);
    setFormContaCustoId(String(lanc.contaCustoId));
    setFormValor(String(lanc.valor));
    setFormEquipamentoId(lanc.equipamentoId ? String(lanc.equipamentoId) : "");
    setFormSetorId(lanc.setorId ? String(lanc.setorId) : "");
    setFormDescricao(lanc.descricao || "");
    setFormObservacoes(lanc.observacoes || "");
    if (periodoId) setFormPeriodoId(String(periodoId));
    setDialogOpen(true);
  }

  function handleSubmit() {
    if (!formContaCustoId || !formValor || !formPeriodoId) {
      toast.error("Preencha todos os campos obrigatórios (conta, período e valor).");
      return;
    }

    const contaId = Number(formContaCustoId);
    const conta = contasSalario?.find(c => c.id === contaId);
    if (conta?.tipoDestino === "equipamento" && !formEquipamentoId) {
      toast.error("Selecione o equipamento de destino.");
      return;
    }
    if (conta?.tipoDestino === "setor" && !formSetorId) {
      toast.error("Selecione o setor de destino.");
      return;
    }

    if (editingId) {
      updateMutation.mutate({
        id: editingId,
        valor: formValor,
        equipamentoId: formEquipamentoId ? Number(formEquipamentoId) : undefined,
        setorId: formSetorId ? Number(formSetorId) : undefined,
        descricao: formDescricao || undefined,
        observacoes: formObservacoes || undefined,
      });
    } else {
      createMutation.mutate({
        periodoCustoId: Number(formPeriodoId),
        contaCustoId: contaId,
        valor: formValor,
        equipamentoId: formEquipamentoId ? Number(formEquipamentoId) : undefined,
        setorId: formSetorId ? Number(formSetorId) : undefined,
        descricao: formDescricao || undefined,
        observacoes: formObservacoes || undefined,
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
          <h1 className="text-2xl font-bold">Lançamento de Salários</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Alocação de salários em equipamentos e setores
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Truck className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Sal. Operação</p>
                  <p className="text-lg font-semibold">{formatCurrency(resumo.totalSalOper)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <Building2 className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Sal. Adm./Encargos</p>
                  <p className="text-lg font-semibold">{formatCurrency(resumo.totalSalAdm)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <Users className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Sal. Diretoria</p>
                  <p className="text-lg font-semibold">{formatCurrency(resumo.totalSalDiretoria)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <DollarSign className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Salários</p>
                  <p className="text-lg font-semibold">{formatCurrency(resumo.total)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabela de lançamentos */}
      {periodoId && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Lançamentos do Período {periodoSelecionado ? `${periodoSelecionado.mes}/${periodoSelecionado.ano}` : ""}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!lancamentos || lancamentos.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Nenhum lançamento de salário neste período.</p>
                <p className="text-sm mt-1">Clique em "Novo Lançamento" para começar.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="py-2 px-2 font-medium">#</th>
                      <th className="py-2 px-2 font-medium">Conta</th>
                      <th className="py-2 px-2 font-medium">Destino</th>
                      <th className="py-2 px-2 font-medium">Descrição</th>
                      <th className="py-2 px-2 font-medium text-right">Valor</th>
                      <th className="py-2 px-2 font-medium text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lancamentos.map((lanc, idx) => {
                      const destino = lanc.equipamentoId
                        ? equipamentosMap[lanc.equipamentoId] || `Equip. #${lanc.equipamentoId}`
                        : lanc.setorId
                        ? setoresMap[lanc.setorId] || `Setor #${lanc.setorId}`
                        : "-";
                      const tipoIcon = lanc.equipamentoId ? (
                        <Truck className="h-3.5 w-3.5 text-blue-500 inline mr-1" />
                      ) : (
                        <Building2 className="h-3.5 w-3.5 text-green-500 inline mr-1" />
                      );
                      return (
                        <tr key={lanc.id} className="border-b hover:bg-muted/50">
                          <td className="py-2 px-2 text-muted-foreground">{idx + 1}</td>
                          <td className="py-2 px-2">
                            <span className="text-xs font-medium">{lanc.contaNome}</span>
                          </td>
                          <td className="py-2 px-2">
                            {tipoIcon}
                            <span className="text-xs">{destino}</span>
                          </td>
                          <td className="py-2 px-2 text-xs text-muted-foreground">
                            {lanc.descricao || "-"}
                          </td>
                          <td className="py-2 px-2 text-right font-medium">
                            {formatCurrency(lanc.valor)}
                          </td>
                          <td className="py-2 px-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => openEditDialog(lanc)}
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive">
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Excluir lançamento?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Esta ação não pode ser desfeita. O lançamento de {formatCurrency(lanc.valor)} será removido.
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
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="font-semibold">
                      <td colSpan={4} className="py-2 px-2 text-right">Total:</td>
                      <td className="py-2 px-2 text-right">
                        {formatCurrency(lancamentos.reduce((sum, l) => sum + (Number(l.valor) || 0), 0))}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dialog de criação/edição */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setDialogOpen(open); }}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Editar Lançamento de Salário" : "Novo Lançamento de Salário"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Período */}
            <div className="space-y-2">
              <Label>Período de Apropriação *</Label>
              <Select
                value={formPeriodoId}
                onValueChange={setFormPeriodoId}
                disabled={!!editingId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o período" />
                </SelectTrigger>
                <SelectContent>
                  {periodos?.map((p) => (
                    <SelectItem key={p.id} value={p.id.toString()}>
                      {p.mes}/{p.ano}{p.fechado ? " (Fechado)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                O salário será apropriado neste período de custo
              </p>
            </div>

            {/* Conta de Salário */}
            <div className="space-y-2">
              <Label>Conta de Salário *</Label>
              <Select
                value={formContaCustoId}
                onValueChange={(v) => {
                  setFormContaCustoId(v);
                  // Limpar destino ao trocar conta
                  setFormEquipamentoId("");
                  setFormSetorId("");
                }}
                disabled={!!editingId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a conta" />
                </SelectTrigger>
                <SelectContent>
                  {contasSalario?.map(c => (
                    <SelectItem key={c.id} value={c.id.toString()}>
                      {c.nome} ({c.tipoDestino === "equipamento" ? "→ Equipamento" : "→ Setor"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedConta && (
                <p className="text-xs text-muted-foreground">
                  {selectedConta.tipoDestino === "equipamento"
                    ? "Esta conta é alocada em equipamentos"
                    : "Esta conta é alocada em setores"}
                </p>
              )}
            </div>

            {/* Valor */}
            <div className="space-y-2">
              <Label>Valor (R$) *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={formValor}
                onChange={(e) => setFormValor(e.target.value)}
              />
            </div>

            {/* Destino: Equipamento com busca */}
            {tipoDestino === "equipamento" && (
              <div className="space-y-2">
                <Label>Equipamento *</Label>
                <SearchableSelect
                  options={equipamentosOptions}
                  value={formEquipamentoId}
                  onValueChange={setFormEquipamentoId}
                  placeholder="Selecione o equipamento"
                  searchPlaceholder="Buscar equipamento (código ou nome)..."
                  emptyMessage="Nenhum equipamento encontrado."
                />
              </div>
            )}

            {/* Destino: Setor com busca */}
            {tipoDestino === "setor" && (
              <div className="space-y-2">
                <Label>Setor *</Label>
                <SearchableSelect
                  options={setoresOptions}
                  value={formSetorId}
                  onValueChange={setFormSetorId}
                  placeholder="Selecione o setor"
                  searchPlaceholder="Buscar setor..."
                  emptyMessage="Nenhum setor encontrado."
                />
              </div>
            )}

            {/* Descrição */}
            <div className="space-y-2">
              <Label>Descrição (opcional)</Label>
              <Input
                placeholder="Ex: Operador João - Escavadeira"
                value={formDescricao}
                onChange={(e) => setFormDescricao(e.target.value)}
              />
            </div>

            {/* Observações */}
            <div className="space-y-2">
              <Label>Observações (opcional)</Label>
              <Textarea
                placeholder="Observações adicionais..."
                value={formObservacoes}
                onChange={(e) => setFormObservacoes(e.target.value)}
                rows={2}
              />
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
              {createMutation.isPending || updateMutation.isPending ? "Salvando..." : editingId ? "Atualizar" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
