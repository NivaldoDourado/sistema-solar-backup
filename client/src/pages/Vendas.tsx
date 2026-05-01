import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Search, FileText, Eye, X, DollarSign, Package, ShoppingCart, Truck, Gift, RefreshCw, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";

interface ItemVenda {
  produtoId: number;
  quantidade: number;
  valorUnitario: number;
}

type TipoVenda = "venda" | "amortizacao" | "doacao";

const tipoLabels: Record<TipoVenda, string> = {
  venda: "Venda",
  amortizacao: "Amortização",
  doacao: "Doação",
};

const tipoBadgeVariants: Record<TipoVenda, string> = {
  venda: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  amortizacao: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  doacao: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};

const emptyForm = {
  tipo: "venda" as TipoVenda,
  numeroNF: "",
  serieNF: "",
  data: new Date().toISOString().split("T")[0],
  clienteId: 0,
  observacoes: "",
  transportadoraNome: "",
  motoristaNome: "",
  placaVeiculo: "",
};

const emptyItem: ItemVenda = { produtoId: 0, quantidade: 0, valorUnitario: 0 };

export default function Vendas() {
  const [open, setOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [formData, setFormData] = useState(emptyForm);
  const [itens, setItens] = useState<ItemVenda[]>([]);
  const [currentItem, setCurrentItem] = useState<ItemVenda>(emptyItem);
  const [viewingVenda, setViewingVenda] = useState<any>(null);
  const [filterClienteId, setFilterClienteId] = useState<string>("all");
  const [filterTipo, setFilterTipo] = useState<string>("all");
  const [filterDataInicio, setFilterDataInicio] = useState(() => {
    const hoje = new Date();
    return new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split("T")[0];
  });
  const [filterDataFim, setFilterDataFim] = useState(() => new Date().toISOString().split("T")[0]);

  const { canCreate, canEdit, canDelete } = usePermissions();
  const canCreateItem = canCreate("vendas");
  const canEditItem = canEdit("vendas");
  const canDeleteItem = canDelete("vendas");

  const { data: vendasData, refetch } = trpc.vendas.vendasList.useQuery(
    filterClienteId !== "all" ? { clienteId: Number(filterClienteId) } : undefined
  );
  const { data: resumoPorProduto, isLoading: loadingPorProduto } = trpc.vendas.vendasResumoPorProduto.useQuery(
    { dataInicio: filterDataInicio, dataFim: filterDataFim }
  );
  const { data: clientesData } = trpc.vendas.clientesList.useQuery();
  const { data: produtosData } = trpc.produtos.list.useQuery();
  const { data: unidadesData } = trpc.unidades.list.useQuery();

  const clientesMap = useMemo(() => {
    const map = new Map<number, any>();
    clientesData?.forEach(c => map.set(c.id, c));
    return map;
  }, [clientesData]);

  const produtosMap = useMemo(() => {
    const map = new Map<number, any>();
    produtosData?.forEach((p: any) => map.set(p.id, p));
    return map;
  }, [produtosData]);

  const unidadesMap = useMemo(() => {
    const map = new Map<number, any>();
    unidadesData?.forEach((u: any) => map.set(u.id, u));
    return map;
  }, [unidadesData]);

  const createMutation = trpc.vendas.vendaCreate.useMutation({
    onSuccess: () => { toast.success("Registro lançado com sucesso!"); refetch(); setOpen(false); resetForm(); },
    onError: (error) => { toast.error(error.message || "Erro ao lançar registro"); },
  });

  const updateMutation = trpc.vendas.vendaUpdate.useMutation({
    onSuccess: () => { toast.success("Registro atualizado com sucesso!"); refetch(); setOpen(false); resetForm(); },
    onError: (error) => { toast.error(error.message || "Erro ao atualizar registro"); },
  });

  const deleteMutation = trpc.vendas.vendaDelete.useMutation({
    onSuccess: () => { toast.success("Registro excluído com sucesso!"); refetch(); },
    onError: (error) => { toast.error(error.message || "Erro ao excluir registro"); },
  });

  const resetForm = () => {
    setFormData({ ...emptyForm, data: new Date().toISOString().split("T")[0] });
    setItens([]);
    setCurrentItem(emptyItem);
    setEditingId(null);
  };

  const handleAddItem = () => {
    if (!currentItem.produtoId) { toast.error("Selecione um produto"); return; }
    if (currentItem.quantidade <= 0) { toast.error("Quantidade deve ser maior que zero"); return; }
    if (currentItem.valorUnitario < 0) { toast.error("Valor unitário deve ser positivo"); return; }
    setItens(prev => [...prev, { ...currentItem }]);
    setCurrentItem(emptyItem);
  };

  const handleRemoveItem = (index: number) => {
    setItens(prev => prev.filter((_, i) => i !== index));
  };

  const totalVenda = useMemo(() => {
    return itens.reduce((sum, item) => sum + (item.quantidade * item.valorUnitario), 0);
  }, [itens]);

  const totalPeso = useMemo(() => {
    return itens.reduce((sum, item) => sum + item.quantidade, 0);
  }, [itens]);

  const nfObrigatoria = formData.tipo === "venda";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.clienteId) { toast.error("Selecione um cliente"); return; }
    if (itens.length === 0) { toast.error("Adicione pelo menos um item"); return; }
    if (nfObrigatoria && !formData.numeroNF.trim()) {
      toast.error("Nº Nota Fiscal é obrigatório para vendas");
      return;
    }

    const payload = {
      tipo: formData.tipo,
      numeroNF: formData.numeroNF || undefined,
      serieNF: formData.serieNF || undefined,
      data: new Date(formData.data + "T12:00:00"),
      clienteId: formData.clienteId,
      observacoes: formData.observacoes || undefined,
      transportadoraNome: formData.transportadoraNome || undefined,
      motoristaNome: formData.motoristaNome || undefined,
      placaVeiculo: formData.placaVeiculo || undefined,
      itens: itens.map(i => ({
        produtoId: i.produtoId,
        quantidade: i.quantidade,
        valorUnitario: i.valorUnitario,
      })),
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleEdit = (venda: any) => {
    if (!canEditItem) { toast.error("Sem permissão"); return; }
    const dataStr = venda.data instanceof Date
      ? venda.data.toISOString().split("T")[0]
      : String(venda.data).split("T")[0];
    setFormData({
      tipo: (venda.tipo as TipoVenda) || "venda",
      numeroNF: venda.numeroNF || "",
      serieNF: venda.serieNF || "",
      data: dataStr,
      clienteId: venda.clienteId,
      observacoes: venda.observacoes || "",
      transportadoraNome: venda.transportadoraNome || "",
      motoristaNome: venda.motoristaNome || "",
      placaVeiculo: venda.placaVeiculo || "",
    });
    setItens(
      (venda.itens || []).map((i: any) => ({
        produtoId: i.produtoId,
        quantidade: parseFloat(String(i.quantidade)),
        valorUnitario: parseFloat(String(i.valorUnitario)),
      }))
    );
    setEditingId(venda.id);
    setOpen(true);
  };

  const handleView = (venda: any) => {
    setViewingVenda(venda);
    setViewOpen(true);
  };

  const handleDelete = (id: number) => {
    if (!canDeleteItem) { toast.error("Sem permissão"); return; }
    if (confirm("Confirma exclusão deste registro?")) { deleteMutation.mutate({ id }); }
  };

  const formatCurrency = (value: number | string) => {
    const num = typeof value === "string" ? parseFloat(value) : value;
    return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  const formatDate = (d: any) => {
    if (!d) return "-";
    const date = d instanceof Date ? d : new Date(String(d).includes("T") ? d : d + "T12:00:00");
    return date.toLocaleDateString("pt-BR");
  };

  const filteredVendas = vendasData?.filter((venda) => {
    // Filtro por tipo
    if (filterTipo !== "all" && (venda as any).tipo !== filterTipo) return false;
    // Filtro por texto
    const searchLower = searchTerm.toLowerCase();
    return [
      venda.numeroNF,
      venda.cliente?.nome,
      venda.serieNF,
      venda.transportadoraNome,
      venda.motoristaNome,
      venda.placaVeiculo,
    ].some((value) => value && String(value).toLowerCase().includes(searchLower));
  });

  const set = (field: string, value: any) => setFormData(prev => ({ ...prev, [field]: value }));

  const formatNumber = (n: number, decimals = 2) =>
    n.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

  // Resumo por tipo
  const resumoPorTipo = useMemo(() => {
    if (!vendasData) return {
      venda: { total: 0, valor: 0 },
      amortizacao: { total: 0, valor: 0 },
      doacao: { total: 0, valor: 0 },
    };
    const r = {
      venda: { total: 0, valor: 0 },
      amortizacao: { total: 0, valor: 0 },
      doacao: { total: 0, valor: 0 },
    };
    vendasData.forEach((v: any) => {
      const tipo = (v.tipo || "venda") as TipoVenda;
      if (r[tipo]) {
        r[tipo].total += 1;
        r[tipo].valor += parseFloat(String(v.valorTotal || "0"));
      }
    });
    return r;
  }, [vendasData]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ShoppingCart className="h-8 w-8 text-primary" />
            Vendas de Material
          </h1>
          <p className="text-muted-foreground mt-1">Lançamento de vendas, amortizações e doações</p>
        </div>
        {canCreateItem && (
          <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); setOpen(v); }}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}><Plus className="mr-2 h-4 w-4" />Novo Lançamento</Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>{editingId ? "Editar" : "Novo"} Lançamento</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  {/* Tipo de Lançamento */}
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Tipo de Lançamento *</Label>
                    <div className="grid grid-cols-3 gap-3">
                      {(["venda", "amortizacao", "doacao"] as TipoVenda[]).map((tipo) => {
                        const isSelected = formData.tipo === tipo;
                        const colors: Record<TipoVenda, string> = {
                          venda: isSelected ? "bg-blue-600 text-white border-blue-600 hover:bg-blue-700" : "border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-950",
                          amortizacao: isSelected ? "bg-amber-600 text-white border-amber-600 hover:bg-amber-700" : "border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-950",
                          doacao: isSelected ? "bg-green-600 text-white border-green-600 hover:bg-green-700" : "border-green-300 text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-300 dark:hover:bg-green-950",
                        };
                        const icons: Record<TipoVenda, React.ReactNode> = {
                          venda: <ShoppingCart className="h-4 w-4" />,
                          amortizacao: <RefreshCw className="h-4 w-4" />,
                          doacao: <Gift className="h-4 w-4" />,
                        };
                        return (
                          <Button
                            key={tipo}
                            type="button"
                            variant="outline"
                            className={`h-12 flex items-center gap-2 border-2 font-semibold transition-all ${colors[tipo]}`}
                            onClick={() => set("tipo", tipo)}
                          >
                            {icons[tipo]}
                            {tipoLabels[tipo]}
                          </Button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Dados da NF */}
                  <div className="grid grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label>Nº Nota Fiscal {nfObrigatoria ? "*" : "(opcional)"}</Label>
                      <Input
                        value={formData.numeroNF}
                        onChange={(e) => set("numeroNF", e.target.value)}
                        required={nfObrigatoria}
                        placeholder="000001"
                        className={nfObrigatoria ? "" : "border-dashed"}
                      />
                      {!nfObrigatoria && (
                        <p className="text-xs text-muted-foreground">Não obrigatório para {tipoLabels[formData.tipo]}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Série</Label>
                      <Input value={formData.serieNF} onChange={(e) => set("serieNF", e.target.value)} placeholder="001" />
                    </div>
                    <div className="space-y-2">
                      <Label>Data *</Label>
                      <Input type="date" value={formData.data} onChange={(e) => set("data", e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Cliente *</Label>
                      <Select value={formData.clienteId ? String(formData.clienteId) : "none"} onValueChange={(v) => set("clienteId", v === "none" ? 0 : Number(v))}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Selecione o cliente</SelectItem>
                          {clientesData?.filter(c => c.ativo === "sim").map(c => (
                            <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Dados do Transportador */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Truck className="h-4 w-4" />
                        Transportador
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label>Empresa Transportadora</Label>
                          <Input value={formData.transportadoraNome} onChange={(e) => set("transportadoraNome", e.target.value)} placeholder="Nome da transportadora" />
                        </div>
                        <div className="space-y-2">
                          <Label>Motorista</Label>
                          <Input value={formData.motoristaNome} onChange={(e) => set("motoristaNome", e.target.value)} placeholder="Nome do motorista" />
                        </div>
                        <div className="space-y-2">
                          <Label>Placa do Veículo</Label>
                          <Input value={formData.placaVeiculo} onChange={(e) => set("placaVeiculo", e.target.value.toUpperCase())} placeholder="ABC-1234" maxLength={8} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Adicionar Item */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Itens</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-12 gap-2 items-end mb-4">
                        <div className="col-span-5 space-y-1">
                          <Label className="text-xs">Produto</Label>
                          <Select value={currentItem.produtoId ? String(currentItem.produtoId) : "none"} onValueChange={(v) => setCurrentItem(prev => ({ ...prev, produtoId: v === "none" ? 0 : Number(v) }))}>
                            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Selecione o produto</SelectItem>
                              {produtosData?.map((p: any) => (
                                <SelectItem key={p.id} value={String(p.id)}>
                                  {p.nome} {p.unidadeId && unidadesMap.get(p.unidadeId) ? `(${unidadesMap.get(p.unidadeId)?.sigla})` : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-2 space-y-1">
                          <Label className="text-xs">Quantidade</Label>
                          <Input type="number" step="0.01" min="0" value={currentItem.quantidade || ""} onChange={(e) => setCurrentItem(prev => ({ ...prev, quantidade: parseFloat(e.target.value) || 0 }))} placeholder="0,00" />
                        </div>
                        <div className="col-span-2 space-y-1">
                          <Label className="text-xs">Valor Unit. (R$)</Label>
                          <Input type="number" step="0.01" min="0" value={currentItem.valorUnitario || ""} onChange={(e) => setCurrentItem(prev => ({ ...prev, valorUnitario: parseFloat(e.target.value) || 0 }))} placeholder="0,00" />
                        </div>
                        <div className="col-span-2 space-y-1">
                          <Label className="text-xs">Subtotal</Label>
                          <div className="h-9 flex items-center px-3 bg-muted rounded-md text-sm font-medium">
                            {formatCurrency(currentItem.quantidade * currentItem.valorUnitario)}
                          </div>
                        </div>
                        <div className="col-span-1">
                          <Button type="button" size="sm" onClick={handleAddItem} className="w-full">
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Lista de itens adicionados */}
                      {itens.length > 0 && (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Produto</TableHead>
                              <TableHead className="text-right">Qtd</TableHead>
                              <TableHead className="text-right">Valor Unit.</TableHead>
                              <TableHead className="text-right">Subtotal</TableHead>
                              <TableHead className="w-10"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {itens.map((item, idx) => {
                              const produto = produtosMap.get(item.produtoId);
                              const unidade = produto?.unidadeId ? unidadesMap.get(produto.unidadeId) : null;
                              return (
                                <TableRow key={idx}>
                                  <TableCell>{produto?.nome || "Produto não encontrado"}</TableCell>
                                  <TableCell className="text-right">{item.quantidade.toLocaleString("pt-BR")} {unidade?.sigla || ""}</TableCell>
                                  <TableCell className="text-right">{formatCurrency(item.valorUnitario)}</TableCell>
                                  <TableCell className="text-right font-medium">{formatCurrency(item.quantidade * item.valorUnitario)}</TableCell>
                                  <TableCell>
                                    <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveItem(idx)}>
                                      <X className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                            <TableRow className="bg-muted/50 font-bold">
                              <TableCell>Total</TableCell>
                              <TableCell className="text-right">{totalPeso.toLocaleString("pt-BR")}</TableCell>
                              <TableCell></TableCell>
                              <TableCell className="text-right">{formatCurrency(totalVenda)}</TableCell>
                              <TableCell></TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>

                  <div className="space-y-2">
                    <Label>Observações</Label>
                    <Textarea value={formData.observacoes} onChange={(e) => set("observacoes", e.target.value)} rows={2} />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => { setOpen(false); resetForm(); }}>Cancelar</Button>
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                    {editingId ? "Atualizar" : "Lançar"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Cards de Resumo por Tipo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vendas</CardTitle>
            <ShoppingCart className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-end">
              <div>
                <p className="text-xs text-muted-foreground">Qtd Total</p>
                <div className="text-2xl font-bold">{resumoPorTipo.venda.total}</div>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Valor Total</p>
                <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{formatCurrency(resumoPorTipo.venda.valor)}</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Amortizações</CardTitle>
            <RefreshCw className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-end">
              <div>
                <p className="text-xs text-muted-foreground">Qtd Total</p>
                <div className="text-2xl font-bold">{resumoPorTipo.amortizacao.total}</div>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Valor Total</p>
                <div className="text-lg font-bold text-amber-600 dark:text-amber-400">{formatCurrency(resumoPorTipo.amortizacao.valor)}</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Doações</CardTitle>
            <Gift className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-end">
              <div>
                <p className="text-xs text-muted-foreground">Qtd Total</p>
                <div className="text-2xl font-bold">{resumoPorTipo.doacao.total}</div>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Valor Total</p>
                <div className="text-lg font-bold text-green-600 dark:text-green-400">{formatCurrency(resumoPorTipo.doacao.valor)}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Card de Vendas por Produto (Granulometria) */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Vendas por Produto (Granulometria)
              </CardTitle>
              <CardDescription>Quantidade total vendida por produto no período selecionado</CardDescription>
            </div>
            <div className="flex gap-3 items-end flex-wrap">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Data Início</label>
                <Input
                  type="date"
                  value={filterDataInicio}
                  onChange={(e) => setFilterDataInicio(e.target.value)}
                  className="h-9 w-40"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Data Fim</label>
                <Input
                  type="date"
                  value={filterDataFim}
                  onChange={(e) => setFilterDataFim(e.target.value)}
                  className="h-9 w-40"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingPorProduto ? (
            <div className="text-sm text-muted-foreground py-6 text-center">Carregando...</div>
          ) : !resumoPorProduto || resumoPorProduto.itens.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">Nenhuma venda registrada no período selecionado</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto (Granulometria)</TableHead>
                    <TableHead className="text-right">Quantidade Total</TableHead>
                    <TableHead className="text-right">Valor Total</TableHead>
                    <TableHead className="text-right">Preço Médio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resumoPorProduto.itens.map((item) => (
                    <TableRow key={item.produtoId}>
                      <TableCell className="font-medium">{item.produtoNome}</TableCell>
                      <TableCell className="text-right">{formatNumber(item.quantidade)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.valorTotal)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.precoMedio)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right">{formatNumber(resumoPorProduto.totalQuantidade)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(resumoPorProduto.totalValor)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(resumoPorProduto.precoMedioGeral)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lista de Vendas */}
      <Card>
        <CardHeader>
          <CardTitle>Registros</CardTitle>
          <CardDescription>{vendasData?.length || 0} registro(s) lançado(s)</CardDescription>
          <div className="flex gap-4 mt-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por nº NF, cliente ou série..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-8" />
            </div>
            <Select value={filterTipo} onValueChange={setFilterTipo}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Filtrar por tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="venda">Venda</SelectItem>
                <SelectItem value="amortizacao">Amortização</SelectItem>
                <SelectItem value="doacao">Doação</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterClienteId} onValueChange={setFilterClienteId}>
              <SelectTrigger className="w-[250px]"><SelectValue placeholder="Filtrar por cliente" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os clientes</SelectItem>
                {clientesData?.filter(c => c.ativo === "sim").map(c => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Nº NF</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-right">Itens</TableHead>
                  <TableHead className="text-right">Qtd Total</TableHead>
                  <TableHead className="text-right">Valor Total</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVendas?.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Nenhum registro encontrado</TableCell></TableRow>
                ) : (
                  filteredVendas?.map((venda: any) => (
                    <TableRow key={venda.id}>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${tipoBadgeVariants[(venda.tipo || "venda") as TipoVenda]}`}>
                          {tipoLabels[(venda.tipo || "venda") as TipoVenda]}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium">
                        {venda.numeroNF || <span className="text-muted-foreground italic text-xs">Sem NF</span>}
                        {venda.serieNF && <span className="text-muted-foreground text-xs ml-1">({venda.serieNF})</span>}
                      </TableCell>
                      <TableCell>{formatDate(venda.data)}</TableCell>
                      <TableCell>{venda.cliente?.nome || "-"}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary">{venda.itens?.length || 0}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{parseFloat(String(venda.pesoTotal || "0")).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(parseFloat(String(venda.valorTotal || "0")))}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleView(venda)} title="Visualizar">
                            <Eye className="h-4 w-4" />
                          </Button>
                          {canEditItem && (
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(venda)} title="Editar">
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {canDeleteItem && (
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(venda.id)} title="Excluir">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog de Visualização */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {viewingVenda?.numeroNF ? `Nota Fiscal ${viewingVenda.numeroNF}` : tipoLabels[(viewingVenda?.tipo || "venda") as TipoVenda]}
              {viewingVenda?.serieNF && <span className="text-muted-foreground text-sm">Série: {viewingVenda.serieNF}</span>}
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${tipoBadgeVariants[(viewingVenda?.tipo || "venda") as TipoVenda]}`}>
                {tipoLabels[(viewingVenda?.tipo || "venda") as TipoVenda]}
              </span>
            </DialogTitle>
          </DialogHeader>
          {viewingVenda && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Data</Label>
                  <p className="font-medium">{formatDate(viewingVenda.data)}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Cliente</Label>
                  <p className="font-medium">{viewingVenda.cliente?.nome || "-"}</p>
                  {viewingVenda.cliente?.cpfCnpj && (
                    <p className="text-xs text-muted-foreground">{viewingVenda.cliente.cpfCnpj}</p>
                  )}
                </div>
              </div>

              {(viewingVenda.transportadoraNome || viewingVenda.motoristaNome || viewingVenda.placaVeiculo) && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Truck className="h-4 w-4" />
                      Transportador
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label className="text-xs text-muted-foreground">Empresa Transportadora</Label>
                        <p className="text-sm font-medium">{viewingVenda.transportadoraNome || "-"}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Motorista</Label>
                        <p className="text-sm font-medium">{viewingVenda.motoristaNome || "-"}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Placa do Veículo</Label>
                        <p className="text-sm font-medium">{viewingVenda.placaVeiculo || "-"}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-right">Quantidade</TableHead>
                    <TableHead className="text-right">Valor Unit.</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {viewingVenda.itens?.map((item: any, idx: number) => {
                    const unidade = item.produto?.unidadeId ? unidadesMap.get(item.produto.unidadeId) : null;
                    return (
                      <TableRow key={idx}>
                        <TableCell>{item.produto?.nome || "Produto não encontrado"}</TableCell>
                        <TableCell className="text-right">
                          {parseFloat(String(item.quantidade)).toLocaleString("pt-BR")} {unidade?.sigla || ""}
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(parseFloat(String(item.valorUnitario)))}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(parseFloat(String(item.valorTotal)))}</TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right">{parseFloat(String(viewingVenda.pesoTotal || "0")).toLocaleString("pt-BR")}</TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-right">{formatCurrency(parseFloat(String(viewingVenda.valorTotal || "0")))}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>

              {viewingVenda.observacoes && (
                <div>
                  <Label className="text-xs text-muted-foreground">Observações</Label>
                  <p className="text-sm">{viewingVenda.observacoes}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
