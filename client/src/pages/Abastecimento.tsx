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
import { Plus, Fuel, Search, TrendingUp, Pencil, Trash2, Filter, X } from "lucide-react";
import { ExportButtons } from "@/components/ExportButtons";
import { formatters } from "@/lib/export-utils";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";
import { SearchableSelect } from "@/components/ui/searchable-select";

type Abastecimento = {
  id: number;
  data: Date;
  equipamentoId: number;
  combustivelId: number;
  quantidade: string;
  horaKm: string | null;
  valorUnitario: string | null;
  valorTotal: string | null;
  observacoes: string | null;
};

const emptyFormData = {
  data: new Date().toISOString().split('T')[0],
  equipamentoId: "",
  combustivelId: "",
  quantidade: "",
  horaKm: "",
  valorUnitario: "",
  valorTotal: "",
  observacoes: "",
};

export default function Abastecimento() {
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filtroDataInicio, setFiltroDataInicio] = useState("");
  const [filtroDataFim, setFiltroDataFim] = useState("");
  const [filtroEquipamentoId, setFiltroEquipamentoId] = useState("");
  const [filtroCombustivelId, setFiltroCombustivelId] = useState("");
  const [formData, setFormData] = useState(emptyFormData);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingItem, setDeletingItem] = useState<Abastecimento | null>(null);

  const { canCreate, canEdit, canDelete } = usePermissions();

  const utils = trpc.useUtils();
  const { data: abastecimentos, isLoading } = trpc.abastecimento.list.useQuery();
  const { data: equipamentos } = trpc.equipamentos.list.useQuery();
  const { data: combustiveis } = trpc.combustiveis.list.useQuery();
  const { data: gruposEquipamentos } = trpc.gruposDeEquipamentos.list.useQuery();

  const [filtroGrupoId, setFiltroGrupoId] = useState("");

  const equipamentoOptions = useMemo(() => 
    equipamentos?.filter(eq => eq.ativo === "sim").map(eq => ({
      value: String(eq.id),
      label: `${eq.nomeDoEquipamento}${eq.codigoTag ? ` (${eq.codigoTag})` : ''}`
    })) || []
  , [equipamentos]);

  const combustivelOptions = useMemo(() => 
    combustiveis?.map(c => ({ value: String(c.id), label: c.nome })) || []
  , [combustiveis]);

  const createMutation = trpc.abastecimento.create.useMutation({
    onSuccess: () => {
      toast.success("Abastecimento registrado com sucesso!");
      utils.abastecimento.list.invalidate();
      setOpen(false);
      setFormData(emptyFormData);
    },
    onError: (error) => {
      toast.error(`Erro ao registrar: ${error.message}`);
    },
  });

  const updateMutation = trpc.abastecimento.update.useMutation({
    onSuccess: () => {
      toast.success("Abastecimento atualizado com sucesso!");
      utils.abastecimento.list.invalidate();
      setEditOpen(false);
      setFormData(emptyFormData);
      setEditingId(null);
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar: ${error.message}`);
    },
  });

  const deleteMutation = trpc.abastecimento.delete.useMutation({
    onSuccess: () => {
      toast.success("Abastecimento excluído com sucesso!");
      utils.abastecimento.list.invalidate();
      setDeleteOpen(false);
      setDeletingItem(null);
    },
    onError: (error) => {
      toast.error(`Erro ao excluir: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.equipamentoId || !formData.combustivelId || !formData.quantidade) {
      toast.error("Equipamento, combustível e quantidade são obrigatórios");
      return;
    }
    
    createMutation.mutate({
      data: formData.data,
      equipamentoId: Number(formData.equipamentoId),
      combustivelId: Number(formData.combustivelId),
      quantidade: formData.quantidade,
      horaKm: formData.horaKm || undefined,
      valorUnitario: formData.valorUnitario || undefined,
      valorTotal: formData.valorTotal || undefined,
      observacoes: formData.observacoes || undefined,
    });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.equipamentoId || !formData.combustivelId || !formData.quantidade || !editingId) {
      toast.error("Equipamento, combustível e quantidade são obrigatórios");
      return;
    }
    
    updateMutation.mutate({
      id: editingId,
      data: formData.data,
      equipamentoId: Number(formData.equipamentoId),
      combustivelId: Number(formData.combustivelId),
      quantidade: formData.quantidade,
      horaKm: formData.horaKm || undefined,
      valorUnitario: formData.valorUnitario || undefined,
      valorTotal: formData.valorTotal || undefined,
      observacoes: formData.observacoes || undefined,
    });
  };

  const handleEdit = (item: Abastecimento) => {
    setEditingId(item.id);
    setFormData({
      data: typeof (item.data as any) === 'string' ? (item.data as any).split('T')[0] : new Date(item.data).toISOString().split('T')[0],
      equipamentoId: String(item.equipamentoId),
      combustivelId: String(item.combustivelId),
      quantidade: item.quantidade,
      horaKm: item.horaKm || "",
      valorUnitario: item.valorUnitario || "",
      valorTotal: item.valorTotal || "",
      observacoes: item.observacoes || "",
    });
    setEditOpen(true);
  };

  const handleDelete = (item: Abastecimento) => {
    setDeletingItem(item);
    setDeleteOpen(true);
  };

  const confirmDelete = () => {
    if (deletingItem) {
      deleteMutation.mutate({ id: deletingItem.id });
    }
  };

  const handleQuantidadeChange = (value: string, isEdit = false) => {
    const newFormData = { ...formData, quantidade: value };
    if (formData.valorUnitario && value) {
      const total = (parseFloat(value) * parseFloat(formData.valorUnitario)).toFixed(2);
      newFormData.valorTotal = total;
    }
    setFormData(newFormData);
  };

  const handleValorUnitarioChange = (value: string) => {
    const newFormData = { ...formData, valorUnitario: value };
    if (formData.quantidade && value) {
      const total = (parseFloat(formData.quantidade) * parseFloat(value)).toFixed(2);
      newFormData.valorTotal = total;
    }
    setFormData(newFormData);
  };

  const getEquipamentoNome = (id: number) => {
    const eq = equipamentos?.find(e => e.id === id);
    return eq ? `${eq.nomeDoEquipamento}${eq.codigoTag ? ` (${eq.codigoTag})` : ''}` : `ID: ${id}`;
  };

  const getCombustivelNome = (id: number) => {
    return combustiveis?.find(c => c.id === id)?.nome || `ID: ${id}`;
  };

  const filteredAbastecimentos = useMemo(() => {
    if (!abastecimentos) return [];
    return abastecimentos.filter((ab) => {
      // Filtro por texto
      if (searchTerm) {
        const equipNome = getEquipamentoNome(ab.equipamentoId).toLowerCase();
        const combNome = getCombustivelNome(ab.combustivelId).toLowerCase();
        const search = searchTerm.toLowerCase();
        if (!equipNome.includes(search) && !combNome.includes(search)) return false;
      }
      // Filtro por data
      if (filtroDataInicio) {
        const dataStr = ab.data instanceof Date ? ab.data.toISOString().split('T')[0] : String(ab.data).includes('T') ? String(ab.data).split('T')[0] : String(ab.data).slice(0, 10);
        if (dataStr < filtroDataInicio) return false;
      }
      if (filtroDataFim) {
        const dataStr = ab.data instanceof Date ? ab.data.toISOString().split('T')[0] : String(ab.data).includes('T') ? String(ab.data).split('T')[0] : String(ab.data).slice(0, 10);
        if (dataStr > filtroDataFim) return false;
      }
      // Filtro por equipamento
      if (filtroEquipamentoId && ab.equipamentoId !== Number(filtroEquipamentoId)) return false;
      // Filtro por grupo de equipamento
      if (filtroGrupoId) {
        const equip = equipamentos?.find(e => e.id === ab.equipamentoId);
        if (!equip || equip.grupoId !== Number(filtroGrupoId)) return false;
      }
      // Filtro por combustível
      if (filtroCombustivelId && ab.combustivelId !== Number(filtroCombustivelId)) return false;
      return true;
    });
  }, [abastecimentos, searchTerm, filtroDataInicio, filtroDataFim, filtroEquipamentoId, filtroGrupoId, filtroCombustivelId, equipamentos]);

  const limparFiltros = () => {
    setFiltroDataInicio("");
    setFiltroDataFim("");
    setFiltroEquipamentoId("");
    setFiltroGrupoId("");
    setFiltroCombustivelId("");
    setSearchTerm("");
  };

  const filtrosAtivos = [filtroDataInicio, filtroDataFim, filtroEquipamentoId, filtroGrupoId, filtroCombustivelId].filter(Boolean).length;

  const grupoOptions = useMemo(() =>
    gruposEquipamentos?.map(g => ({ value: String(g.id), label: g.nome })) || []
  , [gruposEquipamentos]);

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

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="combustivelId">Combustível *</Label>
          <SearchableSelect
            options={combustivelOptions}
            value={formData.combustivelId}
            onValueChange={(value) => setFormData({ ...formData, combustivelId: value })}
            placeholder="Selecione o combustível"
            searchPlaceholder="Buscar combustível..."
            emptyMessage="Nenhum combustível encontrado."
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="quantidade">Quantidade (L) *</Label>
          <Input
            id="quantidade"
            type="number"
            step="0.01"
            value={formData.quantidade}
            onChange={(e) => handleQuantidadeChange(e.target.value)}
            placeholder="0.00"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="horaKm">Hodômetro / Horímetro</Label>
        <Input
          id="horaKm"
          value={formData.horaKm}
          onChange={(e) => setFormData({ ...formData, horaKm: e.target.value })}
          placeholder="Ex: 12345 km ou 1234.5 h"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="valorUnitario">Valor Unitário (R$)</Label>
          <Input
            id="valorUnitario"
            type="number"
            step="0.01"
            value={formData.valorUnitario}
            onChange={(e) => handleValorUnitarioChange(e.target.value)}
            placeholder="0.00"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="valorTotal">Valor Total (R$)</Label>
          <Input
            id="valorTotal"
            type="number"
            step="0.01"
            value={formData.valorTotal}
            onChange={(e) => setFormData({ ...formData, valorTotal: e.target.value })}
            placeholder="0.00"
            readOnly={!!(formData.quantidade && formData.valorUnitario)}
            className={formData.quantidade && formData.valorUnitario ? "bg-muted" : ""}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="observacoes">Observações</Label>
        <Textarea
          id="observacoes"
          value={formData.observacoes}
          onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
          placeholder="Observações sobre o abastecimento..."
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
            <Fuel className="h-8 w-8 text-primary" />
            Abastecimento
          </h1>
          <p className="text-muted-foreground mt-2">
            Controle de abastecimento e consumo de combustível
          </p>
        </div>
        {canCreate("abastecimento") && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Novo Abastecimento
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>Registrar Abastecimento</DialogTitle>
                  <DialogDescription>
                    Preencha os dados do abastecimento do equipamento
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
              <DialogTitle>Editar Abastecimento</DialogTitle>
              <DialogDescription>
                Atualize os dados do abastecimento
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
              Tem certeza que deseja excluir este registro de abastecimento?
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
              <CardTitle>Registros de Abastecimento</CardTitle>
              <CardDescription>
                {filtrosAtivos > 0
                  ? `${filteredAbastecimentos.length} de ${abastecimentos?.length || 0} registros (${filtrosAtivos} filtro${filtrosAtivos > 1 ? 's' : ''} ativo${filtrosAtivos > 1 ? 's' : ''})`
                  : `${filteredAbastecimentos.length} registro(s) encontrado(s)`
                }
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant={showFilters ? "default" : "outline"}
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="h-4 w-4 mr-1" />
                Filtros
                {filtrosAtivos > 0 && (
                  <span className="ml-1 bg-white text-primary rounded-full h-5 w-5 flex items-center justify-center text-xs font-bold">
                    {filtrosAtivos}
                  </span>
                )}
              </Button>
              <ExportButtons
              options={{
                title: "Relatório de Abastecimentos",
                subtitle: `Total: ${filteredAbastecimentos?.length || 0} registros`,
                filename: `abastecimentos-${new Date().toISOString().split("T")[0]}`,
                columns: [
                  { header: "Data", key: "data", width: 12, format: formatters.date },
                  { header: "Equipamento", key: "equipamentoNome", width: 25 },
                  { header: "Combustível", key: "combustivelNome", width: 18 },
                  { header: "Quantidade (L)", key: "quantidade", width: 14, format: formatters.decimal },
                  { header: "Hora/Km", key: "horaKm", width: 12 },
                  { header: "Valor Unit.", key: "valorUnitario", width: 12, format: formatters.currency },
                  { header: "Valor Total", key: "valorTotal", width: 14, format: formatters.currency },
                  { header: "Observações", key: "observacoes", width: 25 },
                ],
                data: (filteredAbastecimentos || []).map((a) => {
                  const equip = equipamentos?.find((e) => e.id === a.equipamentoId);
                  const comb = combustiveis?.find((c) => c.id === a.combustivelId);
                  return {
                    ...a,
                    equipamentoNome: equip?.codigoTag || equip?.nomeDoEquipamento || "",
                    combustivelNome: comb?.nome || "",
                  };
                }),
              }}
            />
            </div>
          </div>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por equipamento ou combustível..."
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
              {filtrosAtivos > 0 && (
                <Button variant="ghost" size="sm" onClick={limparFiltros}>
                  <X className="h-4 w-4 mr-1" /> Limpar filtros
                </Button>
              )}
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
                <SearchableSelect
                  options={grupoOptions}
                  value={filtroGrupoId}
                  onValueChange={(val) => { setFiltroGrupoId(val); setFiltroEquipamentoId(""); }}
                  placeholder="Todos os grupos"
                  searchPlaceholder="Buscar grupo..."
                  emptyMessage="Nenhum grupo encontrado."
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Equipamento</Label>
                <SearchableSelect
                  options={filtroGrupoId
                    ? equipamentoOptions.filter(opt => {
                        const equip = equipamentos?.find(e => String(e.id) === opt.value);
                        return equip?.grupoId === Number(filtroGrupoId);
                      })
                    : equipamentoOptions
                  }
                  value={filtroEquipamentoId}
                  onValueChange={setFiltroEquipamentoId}
                  placeholder="Todos os equipamentos"
                  searchPlaceholder="Buscar equipamento..."
                  emptyMessage="Nenhum equipamento encontrado."
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Combustível</Label>
                <SearchableSelect
                  options={combustivelOptions}
                  value={filtroCombustivelId}
                  onValueChange={setFiltroCombustivelId}
                  placeholder="Todos os combustíveis"
                  searchPlaceholder="Buscar combustível..."
                  emptyMessage="Nenhum combustível encontrado."
                />
              </div>
            </div>
          </div>
        )}
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : filteredAbastecimentos && filteredAbastecimentos.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Equipamento</TableHead>
                    <TableHead>Combustível</TableHead>
                    <TableHead>Quantidade (L)</TableHead>
                    <TableHead>Hodômetro/Horímetro</TableHead>
                    <TableHead>Valor Total</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAbastecimentos.map((ab) => (
                    <TableRow key={ab.id}>
                      <TableCell className="font-medium">
                        {new Date(ab.data).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                      </TableCell>
                      <TableCell>{getEquipamentoNome(ab.equipamentoId)}</TableCell>
                      <TableCell>{getCombustivelNome(ab.combustivelId)}</TableCell>
                      <TableCell>{ab.quantidade}</TableCell>
                      <TableCell>{ab.horaKm || "-"}</TableCell>
                      <TableCell>
                        {ab.valorTotal ? `R$ ${parseFloat(ab.valorTotal).toFixed(2)}` : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {canEdit("abastecimento") && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(ab)}
                              title="Editar"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {canDelete("abastecimento") && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(ab)}
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
              {searchTerm ? "Nenhum registro encontrado com esse termo de busca." : "Nenhum registro de abastecimento encontrado. Clique em 'Novo Abastecimento' para começar."}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
