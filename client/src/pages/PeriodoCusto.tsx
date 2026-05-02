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
import { CalendarRange, Plus, Pencil, Lock, Unlock, Trash2, RefreshCw, TrendingUp, ShoppingCart } from "lucide-react";
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

export default function PeriodoCusto() {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [loadingProducao, setLoadingProducao] = useState(false);
  const [loadingVendas, setLoadingVendas] = useState(false);

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
                            <Button variant="outline" size="sm" onClick={() => toggleMutation.mutate({ id: p.id })} title={p.fechado === "sim" ? "Reabrir" : "Fechar"}>
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
