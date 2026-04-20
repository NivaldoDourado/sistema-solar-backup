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
import { Plus, Wrench, Search, Pencil, Trash2, Filter, X, Clock, CalendarRange } from "lucide-react";
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

// Calcula horas paradas entre dois timestamps (data + hora), suportando múltiplos dias
const calcularHorasParadas = (
  dataInicio: string, horaInicio: string,
  dataFim: string, horaFim: string
): string => {
  if (!dataInicio || !dataFim) return "";
  const inicio = new Date(`${dataInicio}T${horaInicio || "00:00"}`);
  const fim = new Date(`${dataFim}T${horaFim || "00:00"}`);
  const diffMs = fim.getTime() - inicio.getTime();
  if (diffMs <= 0) return "";
  return (diffMs / (1000 * 60 * 60)).toFixed(2);
};

const emptyFormData = {
  dataInicio: new Date().toISOString().split('T')[0],
  horaInicio: "",
  dataFim: "",
  horaFim: "",
  equipamentoId: "",
  tipo: "corretiva",
  descricao: "",
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
  const [filtroDataInicio, setFiltroDataInicio] = useState("");
  const [filtroDataFim, setFiltroDataFim] = useState("");
  const [filtroEquipamentoId, setFiltroEquipamentoId] = useState("");
  const [filtroGrupoId, setFiltroGrupoId] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(30);
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
      dataInicio: formData.dataInicio,
      horaInicio: formData.horaInicio || undefined,
      dataFim: formData.dataFim || undefined,
      horaFim: formData.horaFim || undefined,
      equipamentoId: Number(formData.equipamentoId),
      tipo: formData.tipo as "preventiva" | "corretiva" | "preditiva",
      descricao: formData.descricao,
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
      dataInicio: formData.dataInicio,
      horaInicio: formData.horaInicio || undefined,
      dataFim: formData.dataFim || undefined,
      horaFim: formData.horaFim || undefined,
      equipamentoId: Number(formData.equipamentoId),
      tipo: formData.tipo as "preventiva" | "corretiva" | "preditiva",
      descricao: formData.descricao,
      horasParadas: formData.horasParadas || undefined,
      custo: formData.custo || undefined,
      observacoes: formData.observacoes || undefined,
      horKmRevisao: formData.tipo === "preventiva" ? (formData.horKmRevisao || undefined) : undefined,
      intervaloRevisao: formData.tipo === "preventiva" ? (formData.intervaloRevisao || undefined) : undefined,
    });
  };

  const handleEdit = (item: Manutencao) => {
    setEditingId(item.id);
    const dtInicio = new Date(item.dataInicio);
    const dtFim = item.dataFim ? new Date(item.dataFim) : null;

    const toLocalDate = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };
    const toLocalTime = (d: Date) => {
      const h = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      return `${h}:${min}`;
    };

    const dataInicioStr = toLocalDate(dtInicio);
    const horaInicioStr = toLocalTime(dtInicio);
    const dataFimStr = dtFim ? toLocalDate(dtFim) : "";
    const horaFimStr = dtFim ? toLocalTime(dtFim) : "";

    const horasParadasCalc = calcularHorasParadas(dataInicioStr, horaInicioStr, dataFimStr, horaFimStr) || item.tempoParada || "";

    setFormData({
      dataInicio: dataInicioStr,
      horaInicio: horaInicioStr,
      dataFim: dataFimStr,
      horaFim: horaFimStr,
      equipamentoId: String(item.equipamentoId),
      tipo: item.motivoParada,
      descricao: item.descricao || "",
      horasParadas: horasParadasCalc,
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
    if (deletingItem) deleteMutation.mutate({ id: deletingItem.id });
  };

  const getEquipamentoNome = (id: number) => {
    const eq = equipamentos?.find(e => e.id === id);
    return eq ? `${eq.nomeDoEquipamento}${eq.codigoTag ? ` (${eq.codigoTag})` : ''}` : `ID: ${id}`;
  };

  const getTipoBadgeVariant = (tipo: string) => {
    switch (tipo) {
      case "preventiva": return "default";
      case "corretiva": return "destructive";
      case "preditiva": return "secondary";
      default: return "outline";
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

  // Recalcula horas paradas ao mudar qualquer campo de data/hora
  const updateHorasParadas = (data: typeof formData) => {
    const hp = calcularHorasParadas(data.dataInicio, data.horaInicio, data.dataFim, data.horaFim);
    return { ...data, horasParadas: hp };
  };

  // Formata data/hora para exibição na tabela
  const formatDateTime = (dt: Date | null, onlyTime = false) => {
    if (!dt) return "-";
    const d = new Date(dt);
    if (onlyTime) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('pt-BR');
  };

  const formFieldsJSX = (
    <div className="space-y-5 py-2">
      {/* Linha 1: Equipamento (full width) */}
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

      {/* Linha 2: Tipo + Descrição */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="tipo">Tipo *</Label>
          <Select value={formData.tipo} onValueChange={(value) => setFormData({ ...formData, tipo: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="corretiva">Corretiva</SelectItem>
              <SelectItem value="preventiva">Preventiva</SelectItem>
              <SelectItem value="preditiva">Preditiva</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="descricao">Descrição *</Label>
          <Input
            id="descricao"
            value={formData.descricao}
            onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
            placeholder="Descrição da manutenção"
            required
          />
        </div>
      </div>

      {/* Separador visual */}
      <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <CalendarRange className="h-4 w-4" />
          Período da Manutenção
        </div>

        {/* Linha 3: Data Início + Hora Início */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="dataInicio">Data Início *</Label>
            <Input
              id="dataInicio"
              type="date"
              value={formData.dataInicio}
              onChange={(e) => {
                const updated = updateHorasParadas({ ...formData, dataInicio: e.target.value });
                setFormData(updated);
              }}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="horaInicio">Hora Início</Label>
            <Input
              id="horaInicio"
              type="time"
              value={formData.horaInicio}
              onChange={(e) => {
                const updated = updateHorasParadas({ ...formData, horaInicio: e.target.value });
                setFormData(updated);
              }}
            />
          </div>
        </div>

        {/* Linha 4: Data Fim + Hora Fim */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="dataFim">Data Fim</Label>
            <Input
              id="dataFim"
              type="date"
              value={formData.dataFim}
              min={formData.dataInicio}
              onChange={(e) => {
                const updated = updateHorasParadas({ ...formData, dataFim: e.target.value });
                setFormData(updated);
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="horaFim">Hora Fim</Label>
            <Input
              id="horaFim"
              type="time"
              value={formData.horaFim}
              onChange={(e) => {
                const updated = updateHorasParadas({ ...formData, horaFim: e.target.value });
                setFormData(updated);
              }}
            />
          </div>
        </div>

        {/* Horas Paradas calculadas */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            Horas Paradas (calculado automaticamente)
          </Label>
          <Input
            value={formData.horasParadas ? `${formData.horasParadas} h` : ""}
            readOnly
            className="bg-background font-mono text-sm"
            placeholder="Preencha Data Início e Data Fim para calcular"
          />
        </div>
      </div>

      {/* Linha 5: Custo */}
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

      {/* Campos exclusivos de Preventiva */}
      {formData.tipo === "preventiva" && (
        <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
          <p className="text-sm font-semibold text-muted-foreground">Dados da Revisão Preventiva</p>
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
                className="bg-background font-mono text-sm"
                placeholder="Calculado automaticamente"
              />
            </div>
          </div>
        </div>
      )}

      {/* Observações */}
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
                <DialogFooter className="mt-4">
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
            <DialogFooter className="mt-4">
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
                    { header: "Hora Início", key: "horaInicio", width: 10 },
                    { header: "Data Fim", key: "dataFim", width: 12, format: (v) => v ? formatters.date(v) : "Em andamento" },
                    { header: "Hora Fim", key: "horaFim", width: 10 },
                    { header: "Tipo", key: "motivoParada", width: 12 },
                    { header: "Descrição", key: "descricao", width: 30 },
                    { header: "Horas Paradas", key: "tempoParada", width: 13 },
                    { header: "Custo (R$)", key: "custoEstimado", width: 12, format: formatters.currency },
                    { header: "Status", key: "status", width: 12 },
                  ],
                  data: (filteredManutencoes || []).map((m: typeof manutencoes[0]) => {
                    const equip = equipamentos?.find((e) => e.id === m.equipamentoId);
                    const dtInicio = new Date(m.dataInicio);
                    const dtFim = m.dataFim ? new Date(m.dataFim) : null;
                    return {
                      ...m,
                      equipamentoNome: equip?.codigoTag || equip?.nomeDoEquipamento || "",
                      horaInicio: dtInicio.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                      horaFim: dtFim ? dtFim.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : "",
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
                <SearchableSelect
                  options={filtroGrupoId ? equipamentoOptions.filter(opt => { const equip = equipamentos?.find(e => String(e.id) === opt.value); return equip?.grupoId === Number(filtroGrupoId); }) : equipamentoOptions}
                  value={filtroEquipamentoId}
                  onValueChange={setFiltroEquipamentoId}
                  placeholder="Todos os equipamentos"
                  searchPlaceholder="Buscar equipamento..."
                  emptyMessage="Nenhum equipamento encontrado."
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tipo</Label>
                <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                  <SelectTrigger><SelectValue placeholder="Todos os tipos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="corretiva">Corretiva</SelectItem>
                    <SelectItem value="preventiva">Preventiva</SelectItem>
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
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Equipamento</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Data Início</TableHead>
                    <TableHead>Hora Início</TableHead>
                    <TableHead>Data Fim</TableHead>
                    <TableHead>Hora Fim</TableHead>
                    <TableHead>Horas Paradas</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Custo</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredManutencoes.map((man) => {
                    const dtInicio = new Date(man.dataInicio);
                    const dtFim = man.dataFim ? new Date(man.dataFim) : null;
                    const isMultiDia = dtFim && dtFim.toDateString() !== dtInicio.toDateString();
                    return (
                      <TableRow key={man.id}>
                        <TableCell className="font-medium">{getEquipamentoNome(man.equipamentoId)}</TableCell>
                        <TableCell>
                          <Badge variant={getTipoBadgeVariant(man.motivoParada)}>
                            {man.motivoParada.charAt(0).toUpperCase() + man.motivoParada.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate" title={man.descricao || ""}>{man.descricao || "-"}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatDateTime(dtInicio)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-mono text-sm">
                          {formatDateTime(dtInicio, true)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {dtFim ? (
                            <span className={isMultiDia ? "text-amber-600 font-medium" : ""}>
                              {formatDateTime(dtFim)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">Em andamento</span>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-mono text-sm">
                          {dtFim ? formatDateTime(dtFim, true) : "-"}
                        </TableCell>
                        <TableCell>
                          {man.tempoParada ? (
                            <span className="font-mono text-sm">{parseFloat(man.tempoParada).toFixed(2)} h</span>
                          ) : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={man.status === "em_andamento" ? "secondary" : "outline"}>
                            {man.status === "em_andamento" ? "Em andamento" : "Concluída"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {man.custoEstimado ? `R$ ${parseFloat(man.custoEstimado).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {canEdit("manutencao") && (
                              <Button variant="outline" size="sm" onClick={() => handleEdit(man)} title="Editar">
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
                    );
                  })}
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
