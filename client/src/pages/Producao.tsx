import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Plus, BarChart3, Search, TrendingUp, Pencil, Trash2, Filter, X } from "lucide-react";
import { ExportButtons } from "@/components/ExportButtons";
import { formatters } from "@/lib/export-utils";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";
import { SearchableSelect } from "@/components/ui/searchable-select";

type ProducaoItem = {
  id: number;
  data: Date;
  equipamentoId: number;
  produtoId: number;
  quantidade: string;
  metaDiaria: string | null;
  observacoes: string | null;
};

const emptyFormData = {
  data: new Date().toISOString().split('T')[0],
  equipamentoId: "",
  produtoId: "",
  quantidade: "",
  metaDiaria: "",
  observacoes: "",
};

export default function Producao() {
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filtroDataInicio, setFiltroDataInicio] = useState("");
  const [filtroDataFim, setFiltroDataFim] = useState("");
  const [filtroEquipamentoId, setFiltroEquipamentoId] = useState("");
  const [filtroGrupoId, setFiltroGrupoId] = useState("");
  const [filtroProdutoId, setFiltroProdutoId] = useState("");
  const [formData, setFormData] = useState(emptyFormData);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingItem, setDeletingItem] = useState<ProducaoItem | null>(null);

  const { canCreate, canEdit, canDelete } = usePermissions();

  const utils = trpc.useUtils();
  const { data: producoes, isLoading } = trpc.producao.list.useQuery();
  const { data: equipamentos } = trpc.equipamentos.list.useQuery();
  const { data: produtos } = trpc.produtos.list.useQuery();
  const { data: gruposEquipamentos } = trpc.gruposDeEquipamentos.list.useQuery();

  const grupoOptions = useMemo(() =>
    gruposEquipamentos?.map(g => ({ value: String(g.id), label: g.nome })) || []
  , [gruposEquipamentos]);

  const equipamentoOptions = useMemo(() => 
    equipamentos?.filter(eq => eq.ativo === "sim").map(eq => ({
      value: String(eq.id),
      label: `${eq.nomeDoEquipamento}${eq.codigoTag ? ` (${eq.codigoTag})` : ''}`
    })) || []
  , [equipamentos]);

  const produtoOptions = useMemo(() => 
    produtos?.map(p => ({ value: String(p.id), label: p.nome })) || []
  , [produtos]);

  const createMutation = trpc.producao.create.useMutation({
    onSuccess: () => {
      toast.success("Produção registrada com sucesso!");
      utils.producao.list.invalidate();
      setOpen(false);
      setFormData(emptyFormData);
    },
    onError: (error) => {
      toast.error(`Erro ao registrar: ${error.message}`);
    },
  });

  const updateMutation = trpc.producao.update.useMutation({
    onSuccess: () => {
      toast.success("Produção atualizada com sucesso!");
      utils.producao.list.invalidate();
      setEditOpen(false);
      setFormData(emptyFormData);
      setEditingId(null);
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar: ${error.message}`);
    },
  });

  const deleteMutation = trpc.producao.delete.useMutation({
    onSuccess: () => {
      toast.success("Produção excluída com sucesso!");
      utils.producao.list.invalidate();
      setDeleteOpen(false);
      setDeletingItem(null);
    },
    onError: (error) => {
      toast.error(`Erro ao excluir: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.equipamentoId || !formData.produtoId || !formData.quantidade) {
      toast.error("Equipamento, produto e quantidade são obrigatórios");
      return;
    }
    
    createMutation.mutate({
      data: formData.data,
      equipamentoId: Number(formData.equipamentoId),
      produtoId: Number(formData.produtoId),
      quantidade: formData.quantidade,
      metaDiaria: formData.metaDiaria || undefined,
      observacoes: formData.observacoes || undefined,
    });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.equipamentoId || !formData.produtoId || !formData.quantidade || !editingId) {
      toast.error("Equipamento, produto e quantidade são obrigatórios");
      return;
    }
    
    updateMutation.mutate({
      id: editingId,
      data: formData.data,
      equipamentoId: Number(formData.equipamentoId),
      produtoId: Number(formData.produtoId),
      quantidade: formData.quantidade,
      metaDiaria: formData.metaDiaria || undefined,
      observacoes: formData.observacoes || undefined,
    });
  };

  const handleEdit = (item: ProducaoItem) => {
    setEditingId(item.id);
    setFormData({
      data: typeof (item.data as any) === 'string' ? (item.data as any).split('T')[0] : new Date(item.data).toISOString().split('T')[0],
      equipamentoId: String(item.equipamentoId),
      produtoId: String(item.produtoId),
      quantidade: item.quantidade,
      metaDiaria: item.metaDiaria || "",
      observacoes: item.observacoes || "",
    });
    setEditOpen(true);
  };

  const handleDelete = (item: ProducaoItem) => {
    setDeletingItem(item);
    setDeleteOpen(true);
  };

  const confirmDelete = () => {
    if (deletingItem) {
      deleteMutation.mutate({ id: deletingItem.id });
    }
  };

  const getEquipamentoNome = (id: number) => {
    const eq = equipamentos?.find(e => e.id === id);
    return eq ? `${eq.nomeDoEquipamento}${eq.codigoTag ? ` (${eq.codigoTag})` : ''}` : `ID: ${id}`;
  };

  const getProdutoNome = (id: number) => {
    return produtos?.find(p => p.id === id)?.nome || `ID: ${id}`;
  };

  const filteredProducoes = useMemo(() => {
    if (!producoes) return [];
    return producoes.filter((prod) => {
      if (searchTerm) {
        const equipNome = getEquipamentoNome(prod.equipamentoId).toLowerCase();
        const prodNome = getProdutoNome(prod.produtoId).toLowerCase();
        const search = searchTerm.toLowerCase();
        if (!equipNome.includes(search) && !prodNome.includes(search)) return false;
      }
      if (filtroDataInicio) {
        const dataStr = prod.data instanceof Date ? prod.data.toISOString().split('T')[0] : String(prod.data).includes('T') ? String(prod.data).split('T')[0] : String(prod.data).slice(0, 10);
        if (dataStr < filtroDataInicio) return false;
      }
      if (filtroDataFim) {
        const dataStr = prod.data instanceof Date ? prod.data.toISOString().split('T')[0] : String(prod.data).includes('T') ? String(prod.data).split('T')[0] : String(prod.data).slice(0, 10);
        if (dataStr > filtroDataFim) return false;
      }
      if (filtroEquipamentoId && prod.equipamentoId !== Number(filtroEquipamentoId)) return false;
      if (filtroGrupoId) {
        const equip = equipamentos?.find(e => e.id === prod.equipamentoId);
        if (!equip || equip.grupoId !== Number(filtroGrupoId)) return false;
      }
      if (filtroProdutoId && prod.produtoId !== Number(filtroProdutoId)) return false;
      return true;
    });
  }, [producoes, searchTerm, filtroDataInicio, filtroDataFim, filtroEquipamentoId, filtroGrupoId, filtroProdutoId, equipamentos]);

  const limparFiltros = () => {
    setFiltroDataInicio(""); setFiltroDataFim(""); setFiltroEquipamentoId(""); setFiltroGrupoId(""); setFiltroProdutoId(""); setSearchTerm("");
  };

  const filtrosAtivos = [filtroDataInicio, filtroDataFim, filtroEquipamentoId, filtroGrupoId, filtroProdutoId].filter(Boolean).length;

  const formFieldsJSX = (
    <div className="grid gap-4 py-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="data">Data *</Label>
          <Input
            id="data"
            type="date"
            value={formData.data}
            onChange={(e) => setFormData({ ...formData, data: e.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="equipamentoId">Equipamento *</Label>
          <SearchableSelect
            options={equipamentoOptions}
            value={formData.equipamentoId}
            onValueChange={(value) => setFormData({ ...formData, equipamentoId: value })}
            placeholder="Selecione o equipamento"
            searchPlaceholder="Buscar equipamento..."
            emptyMessage="Nenhum equipamento encontrado."
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="produtoId">Produto *</Label>
        <SearchableSelect
          options={produtoOptions}
          value={formData.produtoId}
          onValueChange={(value) => setFormData({ ...formData, produtoId: value })}
          placeholder="Selecione o produto"
          searchPlaceholder="Buscar produto..."
          emptyMessage="Nenhum produto encontrado."
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="quantidade">Quantidade *</Label>
          <Input
            id="quantidade"
            type="number"
            step="0.01"
            value={formData.quantidade}
            onChange={(e) => setFormData({ ...formData, quantidade: e.target.value })}
            placeholder="0.00"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="metaDiaria">Meta Diária</Label>
          <Input
            id="metaDiaria"
            type="number"
            step="0.01"
            value={formData.metaDiaria}
            onChange={(e) => setFormData({ ...formData, metaDiaria: e.target.value })}
            placeholder="0.00"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="observacoes">Observações</Label>
        <Textarea
          id="observacoes"
          value={formData.observacoes}
          onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
          placeholder="Observações sobre a produção..."
          rows={3}
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="h-8 w-8 text-primary" />
            Produção
          </h1>
          <p className="text-muted-foreground mt-2">
            Registro de produção diária por equipamento e produto
          </p>
        </div>
        {canCreate("producao") && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nova Produção
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>Registrar Produção</DialogTitle>
                  <DialogDescription>
                    Preencha os dados da produção do equipamento
                  </DialogDescription>
                </DialogHeader>
                {formFieldsJSX}
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Salvando..." : "Salvar"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Dialog de Edição */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleEditSubmit}>
            <DialogHeader>
              <DialogTitle>Editar Produção</DialogTitle>
              <DialogDescription>
                Atualize os dados da produção
              </DialogDescription>
            </DialogHeader>
            {formFieldsJSX}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => {
                setEditOpen(false);
                setFormData(emptyFormData);
                setEditingId(null);
              }}>
                Cancelar
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este registro de produção?
              <br />
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingItem(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Registros de Produção</CardTitle>
              <CardDescription>
                {filtrosAtivos > 0
                  ? `${filteredProducoes.length} de ${producoes?.length || 0} registros (${filtrosAtivos} filtro${filtrosAtivos > 1 ? 's' : ''} ativo${filtrosAtivos > 1 ? 's' : ''})`
                  : `${filteredProducoes.length} registro(s) encontrado(s)`
                }
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant={showFilters ? "default" : "outline"} size="sm" onClick={() => setShowFilters(!showFilters)}>
                <Filter className="h-4 w-4 mr-1" /> Filtros
                {filtrosAtivos > 0 && <span className="ml-1 bg-white text-primary rounded-full h-5 w-5 flex items-center justify-center text-xs font-bold">{filtrosAtivos}</span>}
              </Button>
              <ExportButtons
              options={{
                title: "Relatório de Produção",
                subtitle: `Total: ${filteredProducoes.length} registros${filtrosAtivos > 0 ? ' (filtrado)' : ''}`,
                filename: `producao-${new Date().toISOString().split("T")[0]}`,
                columns: [
                  { header: "Data", key: "data", width: 12, format: formatters.date },
                  { header: "Equipamento", key: "equipamentoNome", width: 25 },
                  { header: "Produto", key: "produtoNome", width: 20 },
                  { header: "Quantidade", key: "quantidade", width: 14, format: formatters.decimal },
                  { header: "Meta Diária", key: "metaDiaria", width: 14, format: formatters.decimal },
                  { header: "Observações", key: "observacoes", width: 30 },
                ],
                data: (filteredProducoes || []).map((p) => {
                  const equip = equipamentos?.find((e) => e.id === p.equipamentoId);
                  const prod = produtos?.find((pr) => pr.id === p.produtoId);
                  return {
                    ...p,
                    equipamentoNome: equip?.codigoTag || equip?.nomeDoEquipamento || "",
                    produtoNome: prod?.nome || "",
                  };
                }),
              }}
            />
            </div>
          </div>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por equipamento ou produto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        {showFilters && (
          <div className="mx-6 mb-4 p-4 bg-muted/50 rounded-lg border space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm">Filtros Avançados</h4>
              {filtrosAtivos > 0 && <Button variant="ghost" size="sm" onClick={limparFiltros}><X className="h-4 w-4 mr-1" /> Limpar filtros</Button>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">Data Início</Label>
                <Input type="date" value={filtroDataInicio} onChange={(e) => setFiltroDataInicio(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Data Fim</Label>
                <Input type="date" value={filtroDataFim} onChange={(e) => setFiltroDataFim(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Grupo de Equipamentos</Label>
                <SearchableSelect options={grupoOptions} value={filtroGrupoId} onValueChange={(val) => { setFiltroGrupoId(val); setFiltroEquipamentoId(""); }} placeholder="Todos os grupos" searchPlaceholder="Buscar grupo..." emptyMessage="Nenhum grupo encontrado." />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Equipamento</Label>
                <SearchableSelect options={filtroGrupoId ? equipamentoOptions.filter(opt => { const equip = equipamentos?.find(e => String(e.id) === opt.value); return equip?.grupoId === Number(filtroGrupoId); }) : equipamentoOptions} value={filtroEquipamentoId} onValueChange={setFiltroEquipamentoId} placeholder="Todos os equipamentos" searchPlaceholder="Buscar equipamento..." emptyMessage="Nenhum equipamento encontrado." />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Produto</Label>
                <SearchableSelect options={produtoOptions} value={filtroProdutoId} onValueChange={setFiltroProdutoId} placeholder="Todos os produtos" searchPlaceholder="Buscar produto..." emptyMessage="Nenhum produto encontrado." />
              </div>
            </div>
          </div>
        )}
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : filteredProducoes.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Equipamento</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Quantidade</TableHead>
                    <TableHead>Meta Diária</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducoes.map((prod) => (
                    <TableRow key={prod.id}>
                      <TableCell className="font-medium">
                        {new Date(prod.data).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                      </TableCell>
                      <TableCell>{getEquipamentoNome(prod.equipamentoId)}</TableCell>
                      <TableCell>{getProdutoNome(prod.produtoId)}</TableCell>
                      <TableCell>{prod.quantidade}</TableCell>
                      <TableCell>{prod.metaDiaria || "-"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {canEdit("producao") && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(prod)}
                              title="Editar"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {canDelete("producao") && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(prod)}
                              className="text-destructive hover:text-destructive"
                              title="Excluir"
                            >
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
              {searchTerm ? "Nenhum registro encontrado com esse termo de busca." : "Nenhum registro de produção encontrado. Clique em 'Nova Produção' para começar."}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
