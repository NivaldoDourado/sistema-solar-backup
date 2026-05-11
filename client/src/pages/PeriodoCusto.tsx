import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarRange, Plus, Pencil, Lock, Unlock, Trash2, RefreshCw, TrendingUp, ShoppingCart, CheckCircle2, XCircle, AlertTriangle, ClipboardCheck } from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const anoAtual = new Date().getFullYear();
const mesAtual = new Date().getMonth() + 1;

const emptyForm = {
  mes: mesAtual,
  ano: anoAtual,
  producaoTotal: "",
  quantidadeVendida: "",
  despesasIndiretas: "0",
  observacoes: "",
};

function fmt(val: string | null | undefined, decimals = 2) {
  if (!val) return "-";
  const n = parseFloat(val);
  if (isNaN(n)) return "-";
  return n.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtBRL(val: number) {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
}

function getUltimoDia(ano: number, mes: number) {
  return new Date(ano, mes, 0).getDate();
}

function getPeriodoDates(ano: number, mes: number) {
  const mm = String(mes).padStart(2, "0");
  const dd = String(getUltimoDia(ano, mes)).padStart(2, "0");
  return {
    dataInicio: `${ano}-${mm}-01`,
    dataFim: `${ano}-${mm}-${dd}`,
  };
}

// ─── Componente de Checklist de Validação ────────────────────────────────────
function ChecklistDialog({
  open,
  onOpenChange,
  periodoCustoId,
  periodoLabel,
  onConfirmFechar,
  isPending,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  periodoCustoId: number;
  periodoLabel: string;
  onConfirmFechar: () => void;
  isPending: boolean;
}) {
  const { data: checklist, isLoading } = trpc.validacaoFechamento.verificar.useQuery(
    { periodoCustoId },
    { enabled: open && !!periodoCustoId }
  );

  const totalItems = checklist?.items?.length ?? 0;
  const completoItems = checklist?.items?.filter((i: any) => i.status === "completo").length ?? 0;
  const todosCompletos = totalItems > 0 && completoItems === totalItems;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            Checklist de Fechamento — {periodoLabel}
          </DialogTitle>
          <DialogDescription>
            Verifique se todos os lançamentos foram realizados antes de fechar o período.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            <span className="ml-3 text-muted-foreground text-sm">Verificando lançamentos...</span>
          </div>
        ) : (
          <div className="space-y-3 py-2">
            {/* Barra de progresso */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${todosCompletos ? "bg-green-500" : "bg-amber-500"}`}
                  style={{ width: `${totalItems > 0 ? (completoItems / totalItems) * 100 : 0}%` }}
                />
              </div>
              <span className="text-sm font-medium text-muted-foreground">
                {completoItems}/{totalItems}
              </span>
            </div>

            {/* Lista de itens */}
            {checklist?.items?.map((item: any) => (
              <div
                key={item.id}
                className={`flex items-start gap-3 p-3 rounded-lg border ${
                  item.status === "completo"
                    ? "bg-green-50/50 border-green-200"
                    : "bg-red-50/50 border-red-200"
                }`}
              >
                {item.status === "completo" ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm">{item.nome}</p>
                    {item.valor !== undefined && item.valor > 0 && (
                      <span className="text-xs font-mono text-muted-foreground">
                        {fmtBRL(item.valor)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.detalhes}</p>
                </div>
              </div>
            ))}

            {/* Aviso se não está tudo completo */}
            {!todosCompletos && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg mt-4">
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-800">Itens pendentes</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Há {totalItems - completoItems} item(ns) pendente(s). Você pode fechar mesmo assim, mas
                    os relatórios podem ficar incompletos.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={onConfirmFechar}
            disabled={isPending}
            variant={todosCompletos ? "default" : "destructive"}
          >
            {isPending ? "Fechando..." : todosCompletos ? "Fechar Período" : "Fechar Mesmo Assim"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Página principal ────────────────────────────────────────────────────────
export default function PeriodoCusto() {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [loadingProducao, setLoadingProducao] = useState(false);
  const [loadingVendas, setLoadingVendas] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [checklistPeriodo, setChecklistPeriodo] = useState<{ id: number; label: string } | null>(null);

  const { canCreate, canEdit, canDelete } = usePermissions();
  const utils = trpc.useUtils();

  const { data: periodos, refetch } = trpc.periodoCusto.list.useQuery();

  const upsertMutation = trpc.periodoCusto.upsert.useMutation({
    onSuccess: () => {
      toast.success("Período salvo com sucesso!");
      refetch();
      setOpen(false);
      resetForm();
    },
    onError: (error) => toast.error(error.message || "Erro ao salvar período"),
  });

  const toggleMutation = trpc.periodoCusto.toggleFechado.useMutation({
    onSuccess: (data) => {
      toast.success(data.fechado === "sim" ? "Período fechado!" : "Período reaberto!");
      refetch();
      setChecklistOpen(false);
      setChecklistPeriodo(null);
    },
    onError: (error) => toast.error(error.message || "Erro ao alterar status"),
  });

  const deleteMutation = trpc.periodoCusto.delete.useMutation({
    onSuccess: () => { toast.success("Período excluído!"); refetch(); },
    onError: (error) => toast.error(error.message || "Erro ao excluir"),
  });

  const resetForm = () => {
    setFormData(emptyForm);
    setEditingId(null);
  };

  const handleEdit = (periodo: any) => {
    setEditingId(periodo.id);
    setFormData({
      mes: periodo.mes,
      ano: periodo.ano,
      producaoTotal: periodo.producaoTotal ?? "",
      quantidadeVendida: periodo.quantidadeVendida ?? "",
      despesasIndiretas: periodo.despesasIndiretas ?? "0",
      observacoes: periodo.observacoes ?? "",
    });
    setOpen(true);
  };

  const handleToggleFechado = (periodo: any) => {
    if (periodo.fechado === "sim") {
      // Reabrir: sem checklist, direto
      toggleMutation.mutate({ id: periodo.id });
    } else {
      // Fechar: mostrar checklist primeiro
      setChecklistPeriodo({
        id: periodo.id,
        label: `${MESES[periodo.mes - 1]}/${periodo.ano}`,
      });
      setChecklistOpen(true);
    }
  };

  const handleBuscarProducao = async () => {
    setLoadingProducao(true);
    try {
      const dates = getPeriodoDates(formData.ano, formData.mes);
      const result = await utils.parteDiaria.producaoMetodoCaminhoes.fetch(dates);
      const total = (result as any)?.total ?? 0;
      setFormData((f) => ({ ...f, producaoTotal: total.toFixed(2) }));
      toast.success(`Produção carregada: ${total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} t`);
    } catch {
      toast.error("Erro ao buscar produção. Verifique se há dados no Método Caminhões para este período.");
    } finally {
      setLoadingProducao(false);
    }
  };

  const handleBuscarVendas = async () => {
    setLoadingVendas(true);
    try {
      const dates = getPeriodoDates(formData.ano, formData.mes);
      const result = await utils.vendas.vendasResumoPorProduto.fetch(dates);
      const total = (result as any)?.totalQuantidade ?? 0;
      setFormData((f) => ({ ...f, quantidadeVendida: total.toFixed(2) }));
      toast.success(`Vendas carregadas: ${total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} t`);
    } catch {
      toast.error("Erro ao buscar vendas. Verifique se há dados no módulo de Vendas para este período.");
    } finally {
      setLoadingVendas(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    upsertMutation.mutate({
      mes: formData.mes,
      ano: formData.ano,
      producaoTotal: formData.producaoTotal || undefined,
      quantidadeVendida: formData.quantidadeVendida || undefined,
      despesasIndiretas: formData.despesasIndiretas || "0",
      observacoes: formData.observacoes || undefined,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <CalendarRange className="h-8 w-8 text-primary" />
            Períodos de Custo
          </h1>
          <p className="text-muted-foreground mt-1">
            Cabeçalho mensal com produção, vendas e despesas indiretas
          </p>
        </div>
        {canCreate("custos") && (
          <Button onClick={() => { resetForm(); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Período
          </Button>
        )}
      </div>

      {/* Dialog de Formulário */}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Período de Custo" : "Novo Período de Custo"}</DialogTitle>
            <DialogDescription>
              Defina o mês/ano e preencha os dados de produção e vendas. Use os botões para buscar automaticamente.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Mês *</Label>
                  <Select
                    value={String(formData.mes)}
                    onValueChange={(v) => setFormData({ ...formData, mes: Number(v) })}
                    disabled={!!editingId}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MESES.map((m, i) => (
                        <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Ano *</Label>
                  <Select
                    value={String(formData.ano)}
                    onValueChange={(v) => setFormData({ ...formData, ano: Number(v) })}
                    disabled={!!editingId}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[anoAtual - 1, anoAtual, anoAtual + 1].map((a) => (
                        <SelectItem key={a} value={String(a)}>{a}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Produção Total (t)</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.producaoTotal}
                    onChange={(e) => setFormData({ ...formData, producaoTotal: e.target.value })}
                    placeholder="0,00"
                    className="flex-1"
                  />
                  <Button type="button" variant="outline" onClick={handleBuscarProducao} disabled={loadingProducao} title="Buscar do Método Caminhões">
                    {loadingProducao ? <RefreshCw className="h-4 w-4 animate-spin" /> : <TrendingUp className="h-4 w-4" />}
                    <span className="ml-1 hidden sm:inline">Buscar</span>
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Clique em "Buscar" para puxar automaticamente do Método Caminhões</p>
              </div>

              <div className="space-y-2">
                <Label>Quantidade Vendida (t)</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.quantidadeVendida}
                    onChange={(e) => setFormData({ ...formData, quantidadeVendida: e.target.value })}
                    placeholder="0,00"
                    className="flex-1"
                  />
                  <Button type="button" variant="outline" onClick={handleBuscarVendas} disabled={loadingVendas} title="Buscar do módulo de Vendas">
                    {loadingVendas ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}
                    <span className="ml-1 hidden sm:inline">Buscar</span>
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Clique em "Buscar" para puxar automaticamente do módulo de Vendas</p>
              </div>

              <div className="space-y-2">
                <Label>Despesas Indiretas (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.despesasIndiretas}
                  onChange={(e) => setFormData({ ...formData, despesasIndiretas: e.target.value })}
                  placeholder="0,00"
                />
                <p className="text-xs text-muted-foreground">Lançamento manual de despesas indiretas do período</p>
              </div>

              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  placeholder="Observações sobre o período..."
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setOpen(false); resetForm(); }}>Cancelar</Button>
              <Button type="submit" disabled={upsertMutation.isPending}>
                {upsertMutation.isPending ? "Salvando..." : editingId ? "Salvar Alterações" : "Criar Período"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog de Checklist de Fechamento */}
      {checklistPeriodo && (
        <ChecklistDialog
          open={checklistOpen}
          onOpenChange={(v) => {
            setChecklistOpen(v);
            if (!v) setChecklistPeriodo(null);
          }}
          periodoCustoId={checklistPeriodo.id}
          periodoLabel={checklistPeriodo.label}
          onConfirmFechar={() => toggleMutation.mutate({ id: checklistPeriodo.id })}
          isPending={toggleMutation.isPending}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Histórico de Períodos</CardTitle>
          <CardDescription>{periodos?.length ?? 0} período(s) cadastrado(s)</CardDescription>
        </CardHeader>
        <CardContent>
          {periodos && periodos.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Período</TableHead>
                    <TableHead className="text-right">Produção (t)</TableHead>
                    <TableHead className="text-right">Qtd. Vendida (t)</TableHead>
                    <TableHead className="text-right">Desp. Indiretas (R$)</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Observações</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {periodos.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-semibold">{MESES[p.mes - 1]}/{p.ano}</TableCell>
                      <TableCell className="text-right font-mono">{fmt(p.producaoTotal)}</TableCell>
                      <TableCell className="text-right font-mono">{fmt(p.quantidadeVendida)}</TableCell>
                      <TableCell className="text-right font-mono">{p.despesasIndiretas ? `R$ ${fmt(p.despesasIndiretas)}` : "-"}</TableCell>
                      <TableCell>
                        <Badge variant={p.fechado === "sim" ? "secondary" : "default"}>
                          {p.fechado === "sim" ? "Fechado" : "Aberto"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm max-w-xs truncate">{p.observacoes || "-"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {canEdit("custos") && p.fechado === "nao" && (
                            <Button variant="outline" size="sm" onClick={() => handleEdit(p)} title="Editar">
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {canEdit("custos") && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleToggleFechado(p)}
                              title={p.fechado === "sim" ? "Reabrir" : "Fechar"}
                            >
                              {p.fechado === "sim" ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                            </Button>
                          )}
                          {canDelete("custos") && p.fechado === "nao" && (
                            <Button variant="outline" size="sm" onClick={() => { if (confirm(`Excluir ${MESES[p.mes - 1]}/${p.ano}?`)) deleteMutation.mutate({ id: p.id }); }} className="text-destructive hover:text-destructive" title="Excluir">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum período cadastrado. Clique em "Novo Período" para começar.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
