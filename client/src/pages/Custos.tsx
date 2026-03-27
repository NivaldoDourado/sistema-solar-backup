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
import { Plus, DollarSign, Search, TrendingDown, Pencil, Trash2, Filter, X } from "lucide-react";
import { ExportButtons } from "@/components/ExportButtons";
import { formatters } from "@/lib/export-utils";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";
import { SearchableSelect } from "@/components/ui/searchable-select";

type Custo = {
  id: number;
  data: Date;
  descricao: string;
  valor: string;
  setorDeCustoId: number;
  setorId: number | null;
  equipamentoId: number | null;
  contaCustoId: number | null;
  observacoes: string | null;
};

const emptyFormData = {
  data: new Date().toISOString().split('T')[0],
  descricao: "",
  valor: "",
  setorDeCustoId: "",
  setorId: "",
  equipamentoId: "",
  contaCustoId: "",
  observacoes: "",
};

export default function Custos() {
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filtroDataInicio, setFiltroDataInicio] = useState("");
  const [filtroDataFim, setFiltroDataFim] = useState("");
  const [filtroEquipamentoId, setFiltroEquipamentoId] = useState("");
  const [filtroSetorId, setFiltroSetorId] = useState("");
  const [filtroPlanoContasId, setFiltroPlanoContasId] = useState("");
  const [formData, setFormData] = useState(emptyFormData);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingItem, setDeletingItem] = useState<Custo | null>(null);

  const { canCreate, canEdit, canDelete } = usePermissions();

  const utils = trpc.useUtils();
  const { data: custos, isLoading } = trpc.custos.list.useQuery();
  const { data: equipamentos } = trpc.equipamentos.list.useQuery();
  const { data: setores } = trpc.setores.list.useQuery();
  const { data: planoContas } = trpc.setoresDeCusto.list.useQuery();
  const { data: contasCusto } = trpc.contasCusto.list.useQuery();

  const equipamentoOptions = useMemo(() => 
    equipamentos?.filter(eq => eq.ativo === "sim").map(eq => ({
      value: String(eq.id),
      label: `${eq.nomeDoEquipamento}${eq.codigoTag ? ` (${eq.codigoTag})` : ''}`
    })) || []
  , [equipamentos]);

  const setorOptions = useMemo(() => 
    setores?.map(s => ({ value: String(s.id), label: s.nome })) || []
  , [setores]);

  const planoContasOptions = useMemo(() => 
    planoContas?.map(p => ({ value: String(p.id), label: p.nome })) || []
  , [planoContas]);

  const contaCustoOptions = useMemo(() => 
    contasCusto?.map(c => ({ value: String(c.id), label: c.nome })) || []
  , [contasCusto]);

  const createMutation = trpc.custos.create.useMutation({
    onSuccess: () => {
      toast.success("Custo registrado com sucesso!");
      utils.custos.list.invalidate();
      setOpen(false);
      setFormData(emptyFormData);
    },
    onError: (error) => {
      toast.error(`Erro ao registrar: ${error.message}`);
    },
  });

  const updateMutation = trpc.custos.update.useMutation({
    onSuccess: () => {
      toast.success("Custo atualizado com sucesso!");
      utils.custos.list.invalidate();
      setEditOpen(false);
      setFormData(emptyFormData);
      setEditingId(null);
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar: ${error.message}`);
    },
  });

  const deleteMutation = trpc.custos.delete.useMutation({
    onSuccess: () => {
      toast.success("Custo excluído com sucesso!");
      utils.custos.list.invalidate();
      setDeleteOpen(false);
      setDeletingItem(null);
    },
    onError: (error) => {
      toast.error(`Erro ao excluir: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.descricao || !formData.valor || !formData.setorDeCustoId) {
      toast.error("Descrição, valor e plano de contas são obrigatórios");
      return;
    }
    
    createMutation.mutate({
      data: formData.data,
      descricao: formData.descricao,
      valor: formData.valor,
      setorDeCustoId: Number(formData.setorDeCustoId),
      setorId: formData.setorId ? Number(formData.setorId) : undefined,
      equipamentoId: formData.equipamentoId ? Number(formData.equipamentoId) : undefined,
      contaCustoId: formData.contaCustoId ? Number(formData.contaCustoId) : null,
      observacoes: formData.observacoes || undefined,
    });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.descricao || !formData.valor || !formData.setorDeCustoId || !editingId) {
      toast.error("Descrição, valor e plano de contas são obrigatórios");
      return;
    }
    
    updateMutation.mutate({
      id: editingId,
      data: formData.data,
      descricao: formData.descricao,
      valor: formData.valor,
      setorDeCustoId: Number(formData.setorDeCustoId),
      setorId: formData.setorId ? Number(formData.setorId) : undefined,
      equipamentoId: formData.equipamentoId ? Number(formData.equipamentoId) : undefined,
      contaCustoId: formData.contaCustoId ? Number(formData.contaCustoId) : null,
      observacoes: formData.observacoes || undefined,
    });
  };

  const handleEdit = (item: Custo) => {
    setEditingId(item.id);
    setFormData({
      data: typeof (item.data as any) === 'string' ? (item.data as any).split('T')[0] : new Date(item.data).toISOString().split('T')[0],
      descricao: item.descricao,
      valor: item.valor,
      setorDeCustoId: String(item.setorDeCustoId),
      setorId: item.setorId ? String(item.setorId) : "",
      equipamentoId: item.equipamentoId ? String(item.equipamentoId) : "",
      contaCustoId: item.contaCustoId ? String(item.contaCustoId) : "",
      observacoes: item.observacoes || "",
    });
    setEditOpen(true);
  };

  const handleDelete = (item: Custo) => {
    setDeletingItem(item);
    setDeleteOpen(true);
  };

  const confirmDelete = () => {
    if (deletingItem) {
      deleteMutation.mutate({ id: deletingItem.id });
    }
  };

  const getEquipamentoNome = (id: number | null) => {
    if (!id) return "-";
    const eq = equipamentos?.find(e => e.id === id);
    return eq ? `${eq.nomeDoEquipamento}${eq.codigoTag ? ` (${eq.codigoTag})` : ''}` : `ID: ${id}`;
  };

  const getSetorNome = (id: number | null) => {
    if (!id) return "-";
    return setores?.find(s => s.id === id)?.nome || `ID: ${id}`;
  };

  const getPlanoContasNome = (id: number) => {
    return planoContas?.find(p => p.id === id)?.nome || `ID: ${id}`;
  };

  const getContaCustoNome = (id: number | null) => {
    if (!id) return "-";
    return contasCusto?.find(c => c.id === id)?.nome || `ID: ${id}`;
  };

  const filteredCustos = useMemo(() => {
    if (!custos) return [];
    return custos.filter((custo) => {
      if (searchTerm) {
        const desc = custo.descricao.toLowerCase();
        const equipNome = getEquipamentoNome(custo.equipamentoId).toLowerCase();
        const setorNome = getSetorNome(custo.setorId).toLowerCase();
        const planoNome = getPlanoContasNome(custo.setorDeCustoId).toLowerCase();
        const search = searchTerm.toLowerCase();
        if (!desc.includes(search) && !equipNome.includes(search) && !setorNome.includes(search) && !planoNome.includes(search)) return false;
      }
      if (filtroDataInicio) { const d = custo.data instanceof Date ? custo.data.toISOString().split('T')[0] : String(custo.data).includes('T') ? String(custo.data).split('T')[0] : String(custo.data).slice(0, 10); if (d < filtroDataInicio) return false; }
      if (filtroDataFim) { const d = custo.data instanceof Date ? custo.data.toISOString().split('T')[0] : String(custo.data).includes('T') ? String(custo.data).split('T')[0] : String(custo.data).slice(0, 10); if (d > filtroDataFim) return false; }
      if (filtroEquipamentoId && custo.equipamentoId !== Number(filtroEquipamentoId)) return false;
      if (filtroSetorId && custo.setorId !== Number(filtroSetorId)) return false;
      if (filtroPlanoContasId && custo.setorDeCustoId !== Number(filtroPlanoContasId)) return false;
      return true;
    });
  }, [custos, searchTerm, filtroDataInicio, filtroDataFim, filtroEquipamentoId, filtroSetorId, filtroPlanoContasId]);

  const limparFiltros = () => {
    setFiltroDataInicio(""); setFiltroDataFim(""); setFiltroEquipamentoId(""); setFiltroSetorId(""); setFiltroPlanoContasId(""); setSearchTerm("");
  };

  const filtrosAtivos = [filtroDataInicio, filtroDataFim, filtroEquipamentoId, filtroSetorId, filtroPlanoContasId].filter(Boolean).length;

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
          <Label htmlFor="valor">Valor (R$) *</Label>
          <Input
            id="valor"
            type="number"
            step="0.01"
            value={formData.valor}
            onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
            placeholder="0.00"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="descricao">Descrição *</Label>
        <Input
          id="descricao"
          value={formData.descricao}
          onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
          placeholder="Descrição do custo"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="setorDeCustoId">Plano de Contas *</Label>
        <SearchableSelect
          options={planoContasOptions}
          value={formData.setorDeCustoId}
          onValueChange={(value) => setFormData({ ...formData, setorDeCustoId: value })}
          placeholder="Selecione o plano de contas"
          searchPlaceholder="Buscar plano de contas..."
          emptyMessage="Nenhum plano encontrado."
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="setorId">Setor</Label>
          <SearchableSelect
            options={setorOptions}
            value={formData.setorId}
            onValueChange={(value) => setFormData({ ...formData, setorId: value })}
            placeholder="Selecione o setor"
            searchPlaceholder="Buscar setor..."
            emptyMessage="Nenhum setor encontrado."
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="equipamentoId">Equipamento</Label>
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
        <Label htmlFor="contaCustoId">Conta Custo</Label>
        <SearchableSelect
          options={contaCustoOptions}
          value={formData.contaCustoId}
          onValueChange={(value) => setFormData({ ...formData, contaCustoId: value })}
          placeholder="Selecione a conta custo"
          searchPlaceholder="Buscar conta custo..."
          emptyMessage="Nenhuma conta custo encontrada."
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="observacoes">Observações</Label>
        <Textarea
          id="observacoes"
          value={formData.observacoes}
          onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
          placeholder="Observações sobre o custo..."
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
            <DollarSign className="h-8 w-8 text-primary" />
            Custos
          </h1>
          <p className="text-muted-foreground mt-2">
            Gerenciamento de custos operacionais por plano de contas, setor e equipamento
          </p>
        </div>
        {canCreate("custos") && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Novo Custo
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>Registrar Custo</DialogTitle>
                  <DialogDescription>
                    Preencha os dados do custo operacional
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
              <DialogTitle>Editar Custo</DialogTitle>
              <DialogDescription>
                Atualize os dados do custo
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
              Tem certeza que deseja excluir o custo "{deletingItem?.descricao}"?
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
              <CardTitle>Registros de Custos</CardTitle>
              <CardDescription>
                {filtrosAtivos > 0
                  ? `${filteredCustos.length} de ${custos?.length || 0} registros (${filtrosAtivos} filtro${filtrosAtivos > 1 ? 's' : ''} ativo${filtrosAtivos > 1 ? 's' : ''})`
                  : `${filteredCustos.length} registro(s) encontrado(s)`
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
                title: "Relatório de Custos",
                subtitle: `Total: ${filteredCustos.length} registros${filtrosAtivos > 0 ? ' (filtrado)' : ''}`,
                filename: `custos-${new Date().toISOString().split("T")[0]}`,
                columns: [
                  { header: "Data", key: "data", width: 12, format: formatters.date },
                  { header: "Descrição", key: "descricao", width: 30 },
                  { header: "Valor", key: "valor", width: 14, format: formatters.currency },
                  { header: "Plano de Contas", key: "planoContasNome", width: 20 },
                  { header: "Setor", key: "setorNome", width: 20 },
                  { header: "Equipamento", key: "equipamentoNome", width: 22 },
                  { header: "Conta Custo", key: "contaCustoNome", width: 20 },
                  { header: "Observações", key: "observacoes", width: 25 },
                ],
                data: (filteredCustos || []).map((c) => {
                  const equip = c.equipamentoId ? equipamentos?.find((e) => e.id === c.equipamentoId) : null;
                  const setor = c.setorId ? setores?.find((s) => s.id === c.setorId) : null;
                  const plano = planoContas?.find((p) => p.id === c.setorDeCustoId);
                  return {
                    ...c,
                    equipamentoNome: equip?.codigoTag || equip?.nomeDoEquipamento || "",
                    setorNome: setor?.nome || "",
                    planoContasNome: plano?.nome || "",
                    contaCustoNome: c.contaCustoId ? contasCusto?.find((cc) => cc.id === c.contaCustoId)?.nome || "" : "",
                  };
                }),
              }}
            />
            </div>
          </div>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por descrição, equipamento, setor ou plano de contas..."
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
                <Label className="text-xs">Plano de Contas</Label>
                <SearchableSelect options={planoContasOptions} value={filtroPlanoContasId} onValueChange={setFiltroPlanoContasId} placeholder="Todos os planos" searchPlaceholder="Buscar plano..." emptyMessage="Nenhum plano encontrado." />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Setor</Label>
                <SearchableSelect options={setorOptions} value={filtroSetorId} onValueChange={setFiltroSetorId} placeholder="Todos os setores" searchPlaceholder="Buscar setor..." emptyMessage="Nenhum setor encontrado." />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Equipamento</Label>
                <SearchableSelect options={equipamentoOptions} value={filtroEquipamentoId} onValueChange={setFiltroEquipamentoId} placeholder="Todos os equipamentos" searchPlaceholder="Buscar equipamento..." emptyMessage="Nenhum equipamento encontrado." />
              </div>
            </div>
          </div>
        )}
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : filteredCustos.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Plano de Contas</TableHead>
                    <TableHead>Setor</TableHead>
                    <TableHead>Equipamento</TableHead>
                    <TableHead>Conta Custo</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCustos.map((custo) => (
                    <TableRow key={custo.id}>
                      <TableCell className="font-medium">
                        {new Date(custo.data).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                      </TableCell>
                      <TableCell>{custo.descricao}</TableCell>
                      <TableCell>{getPlanoContasNome(custo.setorDeCustoId)}</TableCell>
                      <TableCell>{getSetorNome(custo.setorId)}</TableCell>
                      <TableCell>{getEquipamentoNome(custo.equipamentoId)}</TableCell>
                      <TableCell>{getContaCustoNome(custo.contaCustoId)}</TableCell>
                      <TableCell className="font-semibold">
                        R$ {parseFloat(custo.valor).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {canEdit("custos") && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(custo)}
                              title="Editar"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {canDelete("custos") && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(custo)}
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
              {searchTerm ? "Nenhum registro encontrado com esse termo de busca." : "Nenhum registro de custo encontrado. Clique em 'Novo Custo' para começar."}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
