import { useState, useMemo, useCallback } from "react";
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
import { Plus, Wrench, Search, AlertTriangle, Pencil, Trash2, Filter, X } from "lucide-react";
import { ExportButtons } from "@/components/ExportButtons";
import { formatters } from "@/lib/export-utils";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { usePermissions } from "@/hooks/usePermissions";
import { Pagination } from "@/components/Pagination";

type Manutencao = {
  id: number;
  equipamentoId: number;
  dataInicio: Date;
  dataFim: Date | null;
  motivoParada: string;
  descricao: string | null;
  tempoParada: string | null;
  custoEstimado: string | null;
  horKmRevisao: string | null;
  intervaloRevisao: string | null;
  horKmProximaRevisao: string | null;
  status: string;
};

const emptyFormData = {
  data: new Date().toISOString().split('T')[0],
  equipamentoId: "",
  tipo: "preventiva",
  descricao: "",
  horaInicio: "",
  horaFim: "",
  horasParadas: "",
  custo: "",
  observacoes: "",
  horKmRevisao: "",
  intervaloRevisao: "",
};

export default function Manutencao() {
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filtroDataInicio, setFiltroDataInicio] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().split('T')[0]; });
  const [filtroDataFim, setFiltroDataFim] = useState(() => new Date().toISOString().split('T')[0]);
  const [filtroEquipamentoId, setFiltroEquipamentoId] = useState("");
  const [filtroGrupoId, setFiltroGrupoId] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [formData, setFormData] = useState(emptyFormData);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingItem, setDeletingItem] = useState<Manutencao | null>(null);

  const { canCreate, canEdit, canDelete } = usePermissions();

  const utils = trpc.useUtils();
  const queryInput = useMemo(() => ({
    page, pageSize,
    dataInicio: filtroDataInicio || undefined,
    dataFim: filtroDataFim || undefined,
    equipamentoId: filtroEquipamentoId ? Number(filtroEquipamentoId) : undefined,
  }), [page, pageSize, filtroDataInicio, filtroDataFim, filtroEquipamentoId]);
  const { data: manutencoesResult, isLoading } = trpc.manutencao.list.useQuery(queryInput);
  const manutencoes = manutencoesResult?.data ?? [];
  const paginacao = { total: manutencoesResult?.total ?? 0, totalPages: manutencoesResult?.totalPages ?? 0 };
  const { data: equipamentos } = trpc.equipamentos.list.useQuery();
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

  const createMutation = trpc.manutencao.create.useMutation({
    onSuccess: () => {
      toast.success("Manutenção registrada com sucesso!");
      utils.manutencao.list.invalidate();
      setOpen(false);
      setFormData(emptyFormData);
    },
    onError: (error) => {
      toast.error(`Erro ao registrar: ${error.message}`);
    },
  });

  const updateMutation = trpc.manutencao.update.useMutation({
    onSuccess: () => {
      toast.success("Manutenção atualizada com sucesso!");
      utils.manutencao.list.invalidate();
      setEditOpen(false);
      setFormData(emptyFormData);
      setEditingId(null);
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar: ${error.message}`);
    },
  });

  const deleteMutation = trpc.manutencao.delete.useMutation({
    onSuccess: () => {
      toast.success("Manutenção excluída com sucesso!");
      utils.manutencao.list.invalidate();
      setDeleteOpen(false);
      setDeletingItem(null);
    },
    onError: (error) => {
      toast.error(`Erro ao excluir: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.equipamentoId || !formData.descricao) {
      toast.error("Equipamento e descrição são obrigatórios");
      return;
    }
    
    createMutation.mutate({
      data: formData.data,
      equipamentoId: Number(formData.equipamentoId),
      tipo: formData.tipo as "preventiva" | "corretiva" | "preditiva",
      descricao: formData.descricao,
      horaInicio: formData.horaInicio || undefined,
      horaFim: formData.horaFim || undefined,
      horasParadas: formData.horasParadas || undefined,
      custo: formData.custo || undefined,
      observacoes: formData.observacoes || undefined,
      horKmRevisao: formData.tipo === "preventiva" ? (formData.horKmRevisao || undefined) : undefined,
      intervaloRevisao: formData.tipo === "preventiva" ? (formData.intervaloRevisao || undefined) : undefined,
    });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.equipamentoId || !formData.descricao || !editingId) {
      toast.error("Equipamento e descrição são obrigatórios");
      return;
    }
    
    updateMutation.mutate({
      id: editingId,
      data: formData.data,
      equipamentoId: Number(formData.equipamentoId),
      tipo: formData.tipo as "preventiva" | "corretiva" | "preditiva",
      descricao: formData.descricao,
      horaInicio: formData.horaInicio || undefined,
      horaFim: formData.horaFim || undefined,
      horasParadas: formData.horasParadas || undefined,
      custo: formData.custo || undefined,
      observacoes: formData.observacoes || undefined,
      horKmRevisao: formData.tipo === "preventiva" ? (formData.horKmRevisao || undefined) : undefined,
      intervaloRevisao: formData.tipo === "preventiva" ? (formData.intervaloRevisao || undefined) : undefined,
    });
  };

  const handleEdit = (item: Manutencao) => {
    setEditingId(item.id);
    const dataInicio = new Date(item.dataInicio);
    const dataFim = item.dataFim ? new Date(item.dataFim) : null;
    
    setFormData({
      data: dataInicio.toISOString().split('T')[0],
      equipamentoId: String(item.equipamentoId),
      tipo: item.motivoParada,
      descricao: item.descricao || "",
      horaInicio: dataInicio.toTimeString().slice(0, 5),
      horaFim: dataFim ? dataFim.toTimeString().slice(0, 5) : "",
      horasParadas: item.tempoParada || "",
      custo: item.custoEstimado || "",
      observacoes: "",
      horKmRevisao: item.horKmRevisao || "",
      intervaloRevisao: item.intervaloRevisao || "",
    });
    setEditOpen(true);
  };

  const handleDelete = (item: Manutencao) => {
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

  const getTipoBadgeVariant = (tipo: string) => {
    switch (tipo) {
      case "preventiva":
        return "default";
      case "corretiva":
        return "destructive";
      case "preditiva":
        return "secondary";
      default:
        return "outline";
    }
  };

  const filteredManutencoes = useMemo(() => {
    if (!manutencoes) return [];
    return manutencoes.filter((man) => {
      if (searchTerm) {
        const equipNome = getEquipamentoNome(man.equipamentoId).toLowerCase();
        const desc = (man.descricao || "").toLowerCase();
        const tipo = man.motivoParada.toLowerCase();
        const search = searchTerm.toLowerCase();
        if (!equipNome.includes(search) && !desc.includes(search) && !tipo.includes(search)) return false;
      }
      if (filtroGrupoId) {
        const equip = equipamentos?.find(e => e.id === man.equipamentoId);
        if (!equip || equip.grupoId !== Number(filtroGrupoId)) return false;
      }
      if (filtroTipo && man.motivoParada !== filtroTipo) return false;
      if (filtroStatus && man.status !== filtroStatus) return false;
      return true;
    });
  }, [manutencoes, searchTerm, filtroGrupoId, filtroTipo, filtroStatus, equipamentos]);

  const limparFiltros = useCallback(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1);
    setFiltroDataInicio(d.toISOString().split('T')[0]);
    setFiltroDataFim(new Date().toISOString().split('T')[0]);
    setFiltroEquipamentoId(""); setFiltroGrupoId(""); setFiltroTipo(""); setFiltroStatus(""); setSearchTerm(""); setPage(1);
  }, []);

  const filtrosAtivos = [filtroDataInicio, filtroDataFim, filtroEquipamentoId, filtroGrupoId, filtroTipo, filtroStatus].filter(Boolean).length;

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
          <Label htmlFor="tipo">Tipo *</Label>
          <Select value={formData.tipo} onValueChange={(value) => setFormData({ ...formData, tipo: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="preventiva">Preventiva</SelectItem>
              <SelectItem value="corretiva">Corretiva</SelectItem>
              <SelectItem value="preditiva">Preditiva</SelectItem>
            </SelectContent>
          </Select>
        </div>
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

      <div className="space-y-2">
        <Label htmlFor="descricao">Descrição *</Label>
        <Input
          id="descricao"
          value={formData.descricao}
          onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
          placeholder="Descrição da manutenção"
          required
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="horaInicio">Hora Início</Label>
          <Input
            id="horaInicio"
            type="time"
            value={formData.horaInicio}
            onChange={(e) => setFormData({ ...formData, horaInicio: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="horaFim">Hora Fim</Label>
          <Input
            id="horaFim"
            type="time"
            value={formData.horaFim}
            onChange={(e) => setFormData({ ...formData, horaFim: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="horasParadas">Horas Paradas</Label>
          <Input
            id="horasParadas"
            type="number"
            step="0.01"
            value={formData.horasParadas}
            onChange={(e) => setFormData({ ...formData, horasParadas: e.target.value })}
            placeholder="0.00"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="custo">Custo (R$)</Label>
        <Input
          id="custo"
          type="number"
          step="0.01"
          value={formData.custo}
          onChange={(e) => setFormData({ ...formData, custo: e.target.value })}
          placeholder="0.00"
        />
      </div>

      {formData.tipo === "preventiva" && (
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="horKmRevisao">Hor/Km desta Revisão</Label>
            <Input
              id="horKmRevisao"
              type="number"
              step="0.01"
              value={formData.horKmRevisao}
              onChange={(e) => setFormData({ ...formData, horKmRevisao: e.target.value })}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="intervaloRevisao">Intervalo</Label>
            <Input
              id="intervaloRevisao"
              type="number"
              step="0.01"
              value={formData.intervaloRevisao}
              onChange={(e) => setFormData({ ...formData, intervaloRevisao: e.target.value })}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="horKmProximaRevisao">Hor/Km Próxima Revisão</Label>
            <Input
              id="horKmProximaRevisao"
              type="number"
              step="0.01"
              value={(() => {
                const rev = parseFloat(formData.horKmRevisao) || 0;
                const inter = parseFloat(formData.intervaloRevisao) || 0;
                return rev || inter ? (rev + inter).toFixed(2) : "";
              })()}
              readOnly
              className="bg-muted cursor-not-allowed"
              placeholder="Calculado automaticamente"
            />
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="observacoes">Observações</Label>
        <Textarea
          id="observacoes"
          value={formData.observacoes}
          onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
          placeholder="Observações sobre a manutenção..."
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
            <Wrench className="h-8 w-8 text-primary" />
            Manutenção
          </h1>
          <p className="text-muted-foreground mt-2">
            Controle de manutenções preventivas, corretivas e preditivas
          </p>
        </div>
        {canCreate("manutencao") && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nova Manutenção
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>Registrar Manutenção</DialogTitle>
                  <DialogDescription>
                    Preencha os dados da manutenção do equipamento
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
              <DialogTitle>Editar Manutenção</DialogTitle>
              <DialogDescription>
                Atualize os dados da manutenção
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
              Tem certeza que deseja excluir este registro de manutenção?
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
              <CardTitle>Registros de Manutenção</CardTitle>
              <CardDescription>
                {filtrosAtivos > 0
                  ? `${filteredManutencoes.length} de ${paginacao.total} registros (${filtrosAtivos} filtro${filtrosAtivos > 1 ? 's' : ''} ativo${filtrosAtivos > 1 ? 's' : ''})`
                  : `${paginacao.total} registro(s) no período`
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
                title: "Relatório de Manutenções",
                subtitle: `Total: ${paginacao.total} registros (página ${page} de ${paginacao.totalPages})`,
                filename: `manutencoes-${new Date().toISOString().split("T")[0]}`,
                columns: [
                  { header: "Equipamento", key: "equipamentoNome", width: 25 },
                  { header: "Data Início", key: "dataInicio", width: 12, format: formatters.date },
                  { header: "Data Fim", key: "dataFim", width: 12, format: (v) => v ? formatters.date(v) : "Em andamento" },
                  { header: "Motivo da Parada", key: "motivoParada", width: 25 },
                  { header: "Descrição", key: "descricao", width: 30 },
                  { header: "Tempo Parada (h)", key: "tempoParada", width: 14 },
                  { header: "Custo Estimado", key: "custoEstimado", width: 14, format: formatters.currency },
                  { header: "Status", key: "status", width: 12 },
                ],
                data: (filteredManutencoes || []).map((m: typeof manutencoes[0]) => {
                  const equip = equipamentos?.find((e) => e.id === m.equipamentoId);
                  return {
                    ...m,
                    equipamentoNome: equip?.codigoTag || equip?.nomeDoEquipamento || "",
                  };
                }),
              }}
            />
            </div>
          </div>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por equipamento, descrição ou tipo..."
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
                <Label className="text-xs">Tipo</Label>
                <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                  <SelectTrigger><SelectValue placeholder="Todos os tipos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="preventiva">Preventiva</SelectItem>
                    <SelectItem value="corretiva">Corretiva</SelectItem>
                    <SelectItem value="preditiva">Preditiva</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Status</Label>
                <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                  <SelectTrigger><SelectValue placeholder="Todos os status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="em_andamento">Em Andamento</SelectItem>
                    <SelectItem value="concluida">Concluída</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : filteredManutencoes.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Equipamento</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Horas Paradas</TableHead>
                    <TableHead>Custo</TableHead>
                    <TableHead>Hor/Km Revisão</TableHead>
                    <TableHead>Intervalo</TableHead>
                    <TableHead>Hor/Km Próx. Rev.</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredManutencoes.map((man) => (
                    <TableRow key={man.id}>
                      <TableCell className="font-medium">
                        {new Date(man.dataInicio).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                      </TableCell>
                      <TableCell>{getEquipamentoNome(man.equipamentoId)}</TableCell>
                      <TableCell>
                        <Badge variant={getTipoBadgeVariant(man.motivoParada)}>
                          {man.motivoParada.charAt(0).toUpperCase() + man.motivoParada.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>{man.descricao || "-"}</TableCell>
                      <TableCell>{man.tempoParada || "-"}</TableCell>
                      <TableCell>
                        {man.custoEstimado ? `R$ ${parseFloat(man.custoEstimado).toFixed(2)}` : "-"}
                      </TableCell>
                      <TableCell>
                        {man.motivoParada === "preventiva" && man.horKmRevisao ? parseFloat(man.horKmRevisao).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : "-"}
                      </TableCell>
                      <TableCell>
                        {man.motivoParada === "preventiva" && man.intervaloRevisao ? parseFloat(man.intervaloRevisao).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : "-"}
                      </TableCell>
                      <TableCell>
                        {man.motivoParada === "preventiva" && man.horKmProximaRevisao ? parseFloat(man.horKmProximaRevisao).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {canEdit("manutencao") && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(man)}
                              title="Editar"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {canDelete("manutencao") && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(man)}
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
              {searchTerm ? "Nenhum registro encontrado com esse termo de busca." : "Nenhum registro de manutenção encontrado. Clique em 'Nova Manutenção' para começar."}
            </div>
          )}
          {paginacao.totalPages > 1 && (
            <Pagination
              page={page}
              totalPages={paginacao.totalPages}
              total={paginacao.total}
              pageSize={pageSize}
              onPageChange={(p) => { setPage(p); window.scrollTo(0, 0); }}
              onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
