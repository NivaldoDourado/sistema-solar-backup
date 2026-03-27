import { useState, useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Layers, Pencil, Trash2, Filter, X, Calculator } from "lucide-react";
import { ExportButtons } from "@/components/ExportButtons";
import { formatters } from "@/lib/export-utils";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Pagination } from "@/components/Pagination";

type MedicaoItem = {
  id: number;
  data: Date;
  equipamentoId: number;
  produtoId: number;
  medida1: string;
  medida2: string;
  medida3: string;
  mediaMedidas: string | null;
  volumeRecipiente: string;
  horaProdutiva: string;
  densidade: string;
  qtdProduzida: string | null;
  observacoes: string | null;
};

const emptyFormData = {
  data: new Date().toISOString().split('T')[0],
  equipamentoId: "",
  produtoId: "",
  medida1: "",
  medida2: "",
  medida3: "",
  volumeRecipiente: "",
  horaProdutiva: "",
  densidade: "",
  observacoes: "",
};

function calcMediaMedidas(m1: string, m2: string, m3: string): number {
  const valores = [parseFloat(m1) || 0, parseFloat(m2) || 0, parseFloat(m3) || 0].filter(v => v > 0);
  if (valores.length === 0) return 0;
  return valores.reduce((a, b) => a + b, 0) / valores.length;
}

function calcQtdProduzida(media: number, volumeRecipiente: string, horaProdutiva: string, densidade: string): number {
  const vol = parseFloat(volumeRecipiente) || 0;
  const hora = parseFloat(horaProdutiva) || 0;
  const dens = parseFloat(densidade) || 0;
  if (media <= 0) return 0;
  return ((vol / media) * 3600 * hora) * dens;
}

export default function MedicaoPilhas() {
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filtroDataInicio, setFiltroDataInicio] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().split('T')[0]; });
  const [filtroDataFim, setFiltroDataFim] = useState(() => new Date().toISOString().split('T')[0]);
  const [filtroEquipamentoId, setFiltroEquipamentoId] = useState("");
  const [filtroGrupoId, setFiltroGrupoId] = useState("");
  const [filtroProdutoId, setFiltroProdutoId] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [formData, setFormData] = useState(emptyFormData);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingItem, setDeletingItem] = useState<MedicaoItem | null>(null);

  const { canCreate, canEdit, canDelete } = usePermissions();

  const utils = trpc.useUtils();
  const queryInput = useMemo(() => ({
    page, pageSize,
    dataInicio: filtroDataInicio || undefined,
    dataFim: filtroDataFim || undefined,
    equipamentoId: filtroEquipamentoId ? Number(filtroEquipamentoId) : undefined,
    produtoId: filtroProdutoId ? Number(filtroProdutoId) : undefined,
  }), [page, pageSize, filtroDataInicio, filtroDataFim, filtroEquipamentoId, filtroProdutoId]);
  const { data: medicoesResult, isLoading } = trpc.medicaoPilhas.list.useQuery(queryInput);
  const medicoes = medicoesResult?.data ?? [];
  const paginacao = { total: medicoesResult?.total ?? 0, totalPages: medicoesResult?.totalPages ?? 0 };
  const { data: equipamentos } = trpc.equipamentos.list.useQuery();
  const { data: produtos } = trpc.produtos.list.useQuery();
  const { data: gruposEquipamentos } = trpc.gruposDeEquipamentos.list.useQuery();

  const grupoOptions = useMemo(() =>
    gruposEquipamentos?.map(g => ({ value: String(g.id), label: g.nome })) || []
  , [gruposEquipamentos]);

  const equipamentosFiltradosPorGrupo = useMemo(() => {
    if (!equipamentos) return [];
    const ativos = equipamentos.filter(eq => eq.ativo === "sim");
    if (!filtroGrupoId) return ativos;
    return ativos.filter(eq => eq.grupoId === Number(filtroGrupoId));
  }, [equipamentos, filtroGrupoId]);

  const equipamentoOptions = useMemo(() =>
    equipamentosFiltradosPorGrupo.map(eq => ({
      value: String(eq.id),
      label: `${eq.nomeDoEquipamento}${eq.codigoTag ? ` (${eq.codigoTag})` : ''}`
    }))
  , [equipamentosFiltradosPorGrupo]);

  const allEquipamentoOptions = useMemo(() =>
    equipamentos?.filter(eq => eq.ativo === "sim").map(eq => ({
      value: String(eq.id),
      label: `${eq.nomeDoEquipamento}${eq.codigoTag ? ` (${eq.codigoTag})` : ''}`
    })) || []
  , [equipamentos]);

  const produtoOptions = useMemo(() =>
    produtos?.map(p => ({ value: String(p.id), label: p.nome })) || []
  , [produtos]);

  // Campos calculados em tempo real
  const mediaMedidas = calcMediaMedidas(formData.medida1, formData.medida2, formData.medida3);
  const qtdProduzida = calcQtdProduzida(mediaMedidas, formData.volumeRecipiente, formData.horaProdutiva, formData.densidade);

  // Filtros
  const activeFilterCount = [filtroDataInicio, filtroDataFim, filtroEquipamentoId, filtroGrupoId, filtroProdutoId].filter(Boolean).length;

  const medicoesFiltradas = useMemo(() => {
    if (!medicoes) return [];
    return medicoes.filter((m: MedicaoItem) => {
      if (filtroGrupoId) {
        const equip = equipamentos?.find(e => e.id === m.equipamentoId);
        if (!equip || equip.grupoId !== Number(filtroGrupoId)) return false;
      }
      return true;
    });
  }, [medicoes, filtroGrupoId, equipamentos]);

  const limparFiltros = useCallback(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1);
    setFiltroDataInicio(d.toISOString().split('T')[0]);
    setFiltroDataFim(new Date().toISOString().split('T')[0]);
    setFiltroEquipamentoId(""); setFiltroGrupoId(""); setFiltroProdutoId(""); setPage(1);
  }, []);

  const createMutation = trpc.medicaoPilhas.create.useMutation({
    onSuccess: () => {
      toast.success("Medição registrada com sucesso!");
      utils.medicaoPilhas.list.invalidate();
      setOpen(false);
      setFormData(emptyFormData);
    },
    onError: (err: any) => toast.error(`Erro: ${err.message}`),
  });

  const updateMutation = trpc.medicaoPilhas.update.useMutation({
    onSuccess: () => {
      toast.success("Medição atualizada com sucesso!");
      utils.medicaoPilhas.list.invalidate();
      setEditOpen(false);
      setEditingId(null);
      setFormData(emptyFormData);
    },
    onError: (err: any) => toast.error(`Erro: ${err.message}`),
  });

  const deleteMutation = trpc.medicaoPilhas.delete.useMutation({
    onSuccess: () => {
      toast.success("Medição excluída com sucesso!");
      utils.medicaoPilhas.list.invalidate();
      setDeleteOpen(false);
      setDeletingItem(null);
    },
    onError: (err: any) => toast.error(`Erro: ${err.message}`),
  });

  const handleSubmit = () => {
    if (!formData.data || !formData.equipamentoId || !formData.produtoId || !formData.medida1 || !formData.volumeRecipiente || !formData.horaProdutiva || !formData.densidade) {
      toast.error("Preencha todos os campos obrigatórios (ao menos Medida 1)");
      return;
    }
    createMutation.mutate({
      data: formData.data, // YYYY-MM-DD string
      equipamentoId: Number(formData.equipamentoId),
      produtoId: Number(formData.produtoId),
      medida1: parseFloat(formData.medida1) || 0,
      medida2: parseFloat(formData.medida2) || 0,
      medida3: parseFloat(formData.medida3) || 0,
      volumeRecipiente: parseFloat(formData.volumeRecipiente) || 0,
      horaProdutiva: parseFloat(formData.horaProdutiva) || 0,
      densidade: parseFloat(formData.densidade) || 0,
      observacoes: formData.observacoes || null,
    });
  };

  const handleUpdate = () => {
    if (!editingId) return;
    if (!formData.data || !formData.equipamentoId || !formData.produtoId || !formData.medida1 || !formData.volumeRecipiente || !formData.horaProdutiva || !formData.densidade) {
      toast.error("Preencha todos os campos obrigatórios (ao menos Medida 1)");
      return;
    }
    updateMutation.mutate({
      id: editingId,
      data: formData.data, // YYYY-MM-DD string
      equipamentoId: Number(formData.equipamentoId),
      produtoId: Number(formData.produtoId),
      medida1: parseFloat(formData.medida1) || 0,
      medida2: parseFloat(formData.medida2) || 0,
      medida3: parseFloat(formData.medida3) || 0,
      volumeRecipiente: parseFloat(formData.volumeRecipiente) || 0,
      horaProdutiva: parseFloat(formData.horaProdutiva) || 0,
      densidade: parseFloat(formData.densidade) || 0,
      observacoes: formData.observacoes || null,
    });
  };

  const handleEdit = (item: MedicaoItem) => {
    const dateStr = item.data instanceof Date ? item.data.toISOString().split('T')[0] : String(item.data).split('T')[0];
    setFormData({
      data: dateStr,
      equipamentoId: String(item.equipamentoId),
      produtoId: String(item.produtoId),
      medida1: item.medida1,
      medida2: item.medida2,
      medida3: item.medida3,
      volumeRecipiente: item.volumeRecipiente,
      horaProdutiva: item.horaProdutiva,
      densidade: item.densidade,
      observacoes: item.observacoes || "",
    });
    setEditingId(item.id);
    setEditOpen(true);
  };

  const getEquipamentoNome = (id: number) => {
    const eq = equipamentos?.find(e => e.id === id);
    return eq ? `${eq.nomeDoEquipamento}${eq.codigoTag ? ` (${eq.codigoTag})` : ''}` : `#${id}`;
  };

  const getProdutoNome = (id: number) => {
    const p = produtos?.find(pr => pr.id === id);
    return p ? p.nome : `#${id}`;
  };

  const formatDate = (d: Date | string) => {
    if (d instanceof Date) {
      return d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
    }
    const parts = String(d).split('T')[0].split('-');
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  const formatNum = (val: string | null, decimals = 4) => {
    if (!val) return "0";
    return parseFloat(val).toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };

  // Dados para exportação - não precisa de useMemo, calculado inline no ExportButtons

  const renderForm = (isEdit: boolean) => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label htmlFor="data">Data *</Label>
          <Input id="data" type="date" value={formData.data} onChange={e => setFormData({ ...formData, data: e.target.value })} />
        </div>
        <div>
          <Label>Equipamento *</Label>
          <SearchableSelect
            options={allEquipamentoOptions}
            value={formData.equipamentoId}
            onValueChange={val => setFormData({ ...formData, equipamentoId: val })}
            placeholder="Selecione o equipamento"
          />
        </div>
        <div>
          <Label>Produto *</Label>
          <SearchableSelect
            options={produtoOptions}
            value={formData.produtoId}
            onValueChange={val => setFormData({ ...formData, produtoId: val })}
            placeholder="Selecione o produto"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <Label htmlFor="medida1">Medida 1 *</Label>
          <Input id="medida1" type="number" step="0.0001" placeholder="0,0000" value={formData.medida1} onChange={e => setFormData({ ...formData, medida1: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="medida2">Medida 2 *</Label>
          <Input id="medida2" type="number" step="0.0001" placeholder="0,0000" value={formData.medida2} onChange={e => setFormData({ ...formData, medida2: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="medida3">Medida 3 *</Label>
          <Input id="medida3" type="number" step="0.0001" placeholder="0,0000" value={formData.medida3} onChange={e => setFormData({ ...formData, medida3: e.target.value })} />
        </div>
        <div>
          <Label>Média Medidas</Label>
          <div className="flex items-center h-10 px-3 rounded-md border bg-muted text-muted-foreground">
            <Calculator className="h-4 w-4 mr-2 text-blue-500" />
            {mediaMedidas.toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <Label htmlFor="volumeRecipiente">Volume Recipiente *</Label>
          <Input id="volumeRecipiente" type="number" step="0.0001" placeholder="0,0000" value={formData.volumeRecipiente} onChange={e => setFormData({ ...formData, volumeRecipiente: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="horaProdutiva">Hora Produtiva *</Label>
          <Input id="horaProdutiva" type="number" step="0.0001" placeholder="0,0000" value={formData.horaProdutiva} onChange={e => setFormData({ ...formData, horaProdutiva: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="densidade">Densidade *</Label>
          <Input id="densidade" type="number" step="0.0001" placeholder="0,0000" value={formData.densidade} onChange={e => setFormData({ ...formData, densidade: e.target.value })} />
        </div>
        <div>
          <Label>Qtd. Produzida</Label>
          <div className="flex items-center h-10 px-3 rounded-md border bg-muted text-muted-foreground">
            <Calculator className="h-4 w-4 mr-2 text-green-500" />
            {qtdProduzida.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      <div>
        <Label htmlFor="observacoes">Observações</Label>
        <Textarea id="observacoes" placeholder="Observações opcionais..." value={formData.observacoes} onChange={e => setFormData({ ...formData, observacoes: e.target.value })} />
      </div>

      {/* Fórmula explicativa */}
      <div className="rounded-md bg-blue-50 dark:bg-blue-950 p-3 text-sm text-blue-700 dark:text-blue-300 space-y-1">
        <p><strong>Média Medidas</strong> = soma das medidas &gt; 0 / quantidade de medidas &gt; 0</p>
        <p><strong>Qtd. Produzida</strong> = ((Volume Recipiente / Média Medidas) × 3600 × Hora Produtiva) × Densidade</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Medição das Pilhas</h1>
          <p className="text-muted-foreground">Registrar e consultar medições de pilhas</p>
        </div>
        {canCreate("medicaoPilhas") && (
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setFormData(emptyFormData); }}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> Nova Medição</Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Nova Medição das Pilhas</DialogTitle>
                <DialogDescription>Registrar nova medição com cálculos automáticos</DialogDescription>
              </DialogHeader>
              {renderForm(false)}
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={handleSubmit} disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Listagem */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Registros</CardTitle>
              <CardDescription>
                {paginacao.total} registro(s) no período
                {activeFilterCount > 0 && ` (${activeFilterCount} filtro${activeFilterCount > 1 ? 's' : ''} ativo${activeFilterCount > 1 ? 's' : ''})`}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant={activeFilterCount > 0 ? "default" : "outline"} size="sm" onClick={() => setShowFilters(!showFilters)}>
                <Filter className="mr-2 h-4 w-4" />
                Filtros
                {activeFilterCount > 0 && (
                  <span className="ml-2 bg-white text-primary rounded-full px-2 py-0.5 text-xs font-bold">{activeFilterCount}</span>
                )}
              </Button>
              <ExportButtons
                options={{
                  title: "Relatório de Medição das Pilhas",
                  subtitle: `Total: ${paginacao.total} registros (página ${page} de ${paginacao.totalPages})`,
                  filename: `medicao-pilhas-${new Date().toISOString().split("T")[0]}`,
                  columns: [
                    { header: "Data", key: "data", width: 12, format: formatters.date },
                    { header: "Equipamento", key: "equipamento", width: 22 },
                    { header: "Produto", key: "produto", width: 18 },
                    { header: "Medida 1", key: "medida1", width: 12, format: formatters.decimal },
                    { header: "Medida 2", key: "medida2", width: 12, format: formatters.decimal },
                    { header: "Medida 3", key: "medida3", width: 12, format: formatters.decimal },
                    { header: "Média", key: "mediaMedidas", width: 12, format: formatters.decimal },
                    { header: "Vol. Recip.", key: "volumeRecipiente", width: 12, format: formatters.decimal },
                    { header: "Hr. Prod.", key: "horaProdutiva", width: 12, format: formatters.decimal },
                    { header: "Densidade", key: "densidade", width: 12, format: formatters.decimal },
                    { header: "Qtd. Produzida", key: "qtdProduzida", width: 14, format: formatters.decimal },
                  ],
                  data: medicoesFiltradas.map((m: MedicaoItem) => ({
                    data: m.data,
                    equipamento: getEquipamentoNome(m.equipamentoId),
                    produto: getProdutoNome(m.produtoId),
                    medida1: m.medida1,
                    medida2: m.medida2,
                    medida3: m.medida3,
                    mediaMedidas: m.mediaMedidas,
                    volumeRecipiente: m.volumeRecipiente,
                    horaProdutiva: m.horaProdutiva,
                    densidade: m.densidade,
                    qtdProduzida: m.qtdProduzida,
                  })),
                }}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filtros */}
          {showFilters && (
            <div className="mb-4 p-4 border rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm">Filtros Avançados</h4>
                <Button variant="ghost" size="sm" onClick={limparFiltros}>
                  <X className="mr-1 h-3 w-3" /> Limpar filtros
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
                <div>
                  <Label className="text-xs">Data Início</Label>
                  <Input type="date" value={filtroDataInicio} onChange={e => setFiltroDataInicio(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Data Fim</Label>
                  <Input type="date" value={filtroDataFim} onChange={e => setFiltroDataFim(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Grupo de Equipamentos</Label>
                  <SearchableSelect
                    options={[{ value: "__all__", label: "Todos os grupos" }, ...grupoOptions]}
                    value={filtroGrupoId || "__all__"}
                    onValueChange={val => { setFiltroGrupoId(val === "__all__" ? "" : val); setFiltroEquipamentoId(""); }}
                    placeholder="Todos os grupos"
                  />
                </div>
                <div>
                  <Label className="text-xs">Equipamento</Label>
                  <SearchableSelect
                    options={[{ value: "__all__", label: "Todos os equipamentos" }, ...equipamentoOptions]}
                    value={filtroEquipamentoId || "__all__"}
                    onValueChange={val => setFiltroEquipamentoId(val === "__all__" ? "" : val)}
                    placeholder="Todos os equipamentos"
                  />
                </div>
                <div>
                  <Label className="text-xs">Produto</Label>
                  <SearchableSelect
                    options={[{ value: "__all__", label: "Todos os produtos" }, ...produtoOptions]}
                    value={filtroProdutoId || "__all__"}
                    onValueChange={val => setFiltroProdutoId(val === "__all__" ? "" : val)}
                    placeholder="Todos os produtos"
                  />
                </div>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : medicoesFiltradas.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {activeFilterCount > 0 ? "Nenhum registro encontrado com os filtros selecionados." : "Nenhuma medição registrada."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Equipamento</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-right">Med. 1</TableHead>
                    <TableHead className="text-right">Med. 2</TableHead>
                    <TableHead className="text-right">Med. 3</TableHead>
                    <TableHead className="text-right">Média</TableHead>
                    <TableHead className="text-right">Vol. Recip.</TableHead>
                    <TableHead className="text-right">Hr. Prod.</TableHead>
                    <TableHead className="text-right">Densidade</TableHead>
                    <TableHead className="text-right">Qtd. Produzida</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {medicoesFiltradas.map((m: MedicaoItem) => (
                    <TableRow key={m.id}>
                      <TableCell>{formatDate(m.data)}</TableCell>
                      <TableCell className="max-w-[150px] truncate">{getEquipamentoNome(m.equipamentoId)}</TableCell>
                      <TableCell className="max-w-[120px] truncate">{getProdutoNome(m.produtoId)}</TableCell>
                      <TableCell className="text-right">{formatNum(m.medida1)}</TableCell>
                      <TableCell className="text-right">{formatNum(m.medida2)}</TableCell>
                      <TableCell className="text-right">{formatNum(m.medida3)}</TableCell>
                      <TableCell className="text-right font-medium text-blue-600">{formatNum(m.mediaMedidas)}</TableCell>
                      <TableCell className="text-right">{formatNum(m.volumeRecipiente)}</TableCell>
                      <TableCell className="text-right">{formatNum(m.horaProdutiva)}</TableCell>
                      <TableCell className="text-right">{formatNum(m.densidade)}</TableCell>
                      <TableCell className="text-right font-bold text-green-600">{formatNum(m.qtdProduzida, 2)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {canEdit("medicaoPilhas") && (
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(m)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {canDelete("medicaoPilhas") && (
                            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => { setDeletingItem(m); setDeleteOpen(true); }}>
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

      {/* Dialog de Edição */}
      <Dialog open={editOpen} onOpenChange={(o) => { setEditOpen(o); if (!o) { setEditingId(null); setFormData(emptyFormData); } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Medição</DialogTitle>
            <DialogDescription>Atualizar dados da medição</DialogDescription>
          </DialogHeader>
          {renderForm(true)}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Atualizando..." : "Atualizar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Exclusão */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta medição? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingItem && deleteMutation.mutate({ id: deletingItem.id })} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
