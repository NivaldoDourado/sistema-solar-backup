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
import { Plus, Truck, Search, Pencil, Trash2, Scale, History, X } from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";
import { SearchableSelect } from "@/components/ui/searchable-select";

type Equipamento = {
  id: number;
  codigoTag: string | null;
  nomeDoEquipamento: string;
  modelo: string | null;
  ano: string | null;
  serie: string | null;
  capacidade: string | null;
  ativo: "sim" | "nao";
  grupoId: number | null;
  grupoNome: string | null;
};

const emptyFormData = {
  codigoTag: "",
  nomeDoEquipamento: "",
  modelo: "",
  ano: "",
  serie: "",
  capacidade: "",
  ativo: "sim" as "sim" | "nao",
  grupoId: null as number | null,
};

function formatDateBR(d: unknown): string {
  if (!d) return '-';
  const s = String(d);
  let dateStr = s;
  if (s.includes('T')) dateStr = s.split('T')[0];
  if (d instanceof Date) dateStr = d.toISOString().split('T')[0];
  const [y, m, day] = dateStr.split('-');
  return `${day}/${m}/${y}`;
}

export default function Equipamentos() {
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterGrupoId, setFilterGrupoId] = useState<string>("all");
  const [formData, setFormData] = useState(emptyFormData);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingEquipamento, setDeletingEquipamento] = useState<Equipamento | null>(null);
  const [novoGrupoOpen, setNovoGrupoOpen] = useState(false);
  const [novoGrupoNome, setNovoGrupoNome] = useState("");

  // Pesagens state
  const [pesagemEquipamento, setPesagemEquipamento] = useState<Equipamento | null>(null);
  const [pesagemOpen, setPesagemOpen] = useState(false);
  const [novaPesagemOpen, setNovaPesagemOpen] = useState(false);
  const [pesagemForm, setPesagemForm] = useState({ capacidade: "", dataVigencia: "", observacao: "" });
  const [deletePesagemId, setDeletePesagemId] = useState<number | null>(null);

  const { canEdit, canDelete, canCreate } = usePermissions();

  const utils = trpc.useUtils();
  const { data: equipamentos, isLoading } = trpc.equipamentos.list.useQuery();
  const { data: grupos } = trpc.gruposDeEquipamentos.list.useQuery();

  // Pesagens queries
  const { data: pesagens, isLoading: pesagensLoading } = trpc.pesagens.list.useQuery(
    { equipamentoId: pesagemEquipamento?.id || 0 },
    { enabled: !!pesagemEquipamento }
  );

  const grupoOptions = useMemo(() => [
    { value: "none", label: "Sem grupo" },
    ...(grupos?.map(g => ({ value: g.id.toString(), label: g.nome })) || [])
  ], [grupos]);

  const createGrupoMutation = trpc.gruposDeEquipamentos.create.useMutation({
    onSuccess: () => {
      toast.success("Grupo cadastrado com sucesso!");
      utils.gruposDeEquipamentos.list.invalidate();
      setNovoGrupoOpen(false);
      setNovoGrupoNome("");
    },
    onError: (error) => {
      toast.error(`Erro ao cadastrar grupo: ${error.message}`);
    },
  });

  const handleCreateGrupo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoGrupoNome.trim()) {
      toast.error("Nome do grupo é obrigatório");
      return;
    }
    createGrupoMutation.mutate({ nome: novoGrupoNome.trim() });
  };
  
  const createMutation = trpc.equipamentos.create.useMutation({
    onSuccess: () => {
      toast.success("Equipamento cadastrado com sucesso!");
      utils.equipamentos.list.invalidate();
      setOpen(false);
      setFormData(emptyFormData);
    },
    onError: (error) => {
      toast.error(`Erro ao cadastrar: ${error.message}`);
    },
  });

  const updateMutation = trpc.equipamentos.update.useMutation({
    onSuccess: () => {
      toast.success("Equipamento atualizado com sucesso!");
      utils.equipamentos.list.invalidate();
      setEditOpen(false);
      setFormData(emptyFormData);
      setEditingId(null);
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar: ${error.message}`);
    },
  });

  const deleteMutation = trpc.equipamentos.delete.useMutation({
    onSuccess: () => {
      toast.success("Equipamento excluído com sucesso!");
      utils.equipamentos.list.invalidate();
      setDeleteOpen(false);
      setDeletingEquipamento(null);
    },
    onError: (error) => {
      toast.error(`Erro ao excluir: ${error.message}`);
    },
  });

  // Pesagens mutations
  const createPesagemMutation = trpc.pesagens.create.useMutation({
    onSuccess: () => {
      toast.success("Pesagem registrada com sucesso!");
      utils.pesagens.list.invalidate();
      utils.equipamentos.list.invalidate();
      setNovaPesagemOpen(false);
      setPesagemForm({ capacidade: "", dataVigencia: "", observacao: "" });
    },
    onError: (error) => {
      toast.error(`Erro ao registrar pesagem: ${error.message}`);
    },
  });

  const deletePesagemMutation = trpc.pesagens.delete.useMutation({
    onSuccess: () => {
      toast.success("Pesagem excluída com sucesso!");
      utils.pesagens.list.invalidate();
      utils.equipamentos.list.invalidate();
      setDeletePesagemId(null);
    },
    onError: (error) => {
      toast.error(`Erro ao excluir pesagem: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nomeDoEquipamento) {
      toast.error("Nome do equipamento é obrigatório");
      return;
    }
    createMutation.mutate({
      ...formData,
      grupoId: formData.grupoId || undefined,
    });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nomeDoEquipamento || !editingId) {
      toast.error("Nome do equipamento é obrigatório");
      return;
    }
    updateMutation.mutate({ 
      id: editingId, 
      ...formData,
      grupoId: formData.grupoId || undefined,
    });
  };

  const handleEdit = (eq: Equipamento) => {
    setEditingId(eq.id);
    setFormData({
      codigoTag: eq.codigoTag || "",
      nomeDoEquipamento: eq.nomeDoEquipamento,
      modelo: eq.modelo || "",
      ano: eq.ano || "",
      serie: eq.serie || "",
      capacidade: eq.capacidade || "",
      ativo: eq.ativo,
      grupoId: eq.grupoId,
    });
    setEditOpen(true);
  };

  const handleDelete = (eq: Equipamento) => {
    setDeletingEquipamento(eq);
    setDeleteOpen(true);
  };

  const confirmDelete = () => {
    if (deletingEquipamento) {
      deleteMutation.mutate({ id: deletingEquipamento.id });
    }
  };

  const handleOpenPesagens = (eq: Equipamento) => {
    setPesagemEquipamento(eq);
    setPesagemOpen(true);
  };

  const handleCreatePesagem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pesagemEquipamento) return;
    if (!pesagemForm.capacidade || !pesagemForm.dataVigencia) {
      toast.error("Capacidade e Data de Vigência são obrigatórios");
      return;
    }
    createPesagemMutation.mutate({
      equipamentoId: pesagemEquipamento.id,
      capacidade: pesagemForm.capacidade,
      dataVigencia: pesagemForm.dataVigencia,
      observacao: pesagemForm.observacao || undefined,
    });
  };

  const filteredEquipamentos = equipamentos?.filter((eq) => {
    // Filtro por grupo
    if (filterGrupoId !== "all") {
      if (filterGrupoId === "none" && eq.grupoId !== null) return false;
      if (filterGrupoId !== "none" && eq.grupoId !== parseInt(filterGrupoId)) return false;
    }
    // Filtro por texto
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        eq.nomeDoEquipamento.toLowerCase().includes(search) ||
        eq.codigoTag?.toLowerCase().includes(search) ||
        eq.modelo?.toLowerCase().includes(search) ||
        eq.grupoNome?.toLowerCase().includes(search)
      );
    }
    return true;
  });

  const formFieldsJSX = (
    <div className="grid gap-4 py-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="codigoTag">Código/Tag</Label>
          <Input
            id="codigoTag"
            value={formData.codigoTag}
            onChange={(e) => setFormData({ ...formData, codigoTag: e.target.value })}
            placeholder="Ex: EQ-001"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="nomeDoEquipamento">Nome do Equipamento *</Label>
          <Input
            id="nomeDoEquipamento"
            value={formData.nomeDoEquipamento}
            onChange={(e) => setFormData({ ...formData, nomeDoEquipamento: e.target.value })}
            placeholder="Ex: Escavadeira Hidráulica"
            required
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="grupoId">Grupo de Equipamento</Label>
        <SearchableSelect
          options={grupoOptions}
          value={formData.grupoId?.toString() || "none"}
          onValueChange={(value) => setFormData({ ...formData, grupoId: value === "none" ? null : parseInt(value) })}
          placeholder="Selecione um grupo"
          searchPlaceholder="Buscar grupo..."
          emptyMessage="Nenhum grupo encontrado."
        />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="modelo">Modelo</Label>
          <Input
            id="modelo"
            value={formData.modelo}
            onChange={(e) => setFormData({ ...formData, modelo: e.target.value })}
            placeholder="Ex: CAT 320"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ano">Ano</Label>
          <Input
            id="ano"
            value={formData.ano}
            onChange={(e) => setFormData({ ...formData, ano: e.target.value })}
            placeholder="Ex: 2020"
            maxLength={4}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="serie">Série</Label>
          <Input
            id="serie"
            value={formData.serie}
            onChange={(e) => setFormData({ ...formData, serie: e.target.value })}
            placeholder="Ex: ABC123"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="capacidade">Capacidade (atual)</Label>
          <Input
            id="capacidade"
            value={formData.capacidade}
            onChange={(e) => setFormData({ ...formData, capacidade: e.target.value })}
            placeholder="Ex: 44.09"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ativo">Status</Label>
          <Select value={formData.ativo} onValueChange={(value: "sim" | "nao") => setFormData({ ...formData, ativo: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sim">Ativo</SelectItem>
              <SelectItem value="nao">Inativo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Truck className="h-8 w-8 text-primary" />
            Equipamentos
          </h1>
          <p className="text-muted-foreground mt-2">
            Gerenciamento de frota e equipamentos
          </p>
        </div>
        {canCreate("equipamentos") && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Novo Equipamento
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>Cadastrar Equipamento</DialogTitle>
                  <DialogDescription>
                    Preencha os dados do novo equipamento
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
        <DialogContent className="max-w-2xl">
          <form onSubmit={handleEditSubmit}>
            <DialogHeader>
              <DialogTitle>Editar Equipamento</DialogTitle>
              <DialogDescription>
                Atualize os dados do equipamento
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
              Tem certeza que deseja excluir o equipamento{" "}
              <strong>{deletingEquipamento?.nomeDoEquipamento}</strong>?
              <br />
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingEquipamento(null)}>
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

      {/* Dialog de Histórico de Pesagens */}
      <Dialog open={pesagemOpen} onOpenChange={(open) => {
        setPesagemOpen(open);
        if (!open) {
          setPesagemEquipamento(null);
          setNovaPesagemOpen(false);
          setPesagemForm({ capacidade: "", dataVigencia: "", observacao: "" });
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-amber-600" />
              Histórico de Pesagens
            </DialogTitle>
            <DialogDescription>
              <strong>{pesagemEquipamento?.codigoTag || pesagemEquipamento?.nomeDoEquipamento}</strong> — Capacidade atual: <strong>{pesagemEquipamento?.capacidade || '0'}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Botão Nova Pesagem */}
            {canCreate("equipamentos") && !novaPesagemOpen && (
              <Button
                onClick={() => setNovaPesagemOpen(true)}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                Nova Pesagem
              </Button>
            )}

            {/* Formulário Nova Pesagem */}
            {novaPesagemOpen && (
              <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20">
                <CardContent className="pt-4">
                  <form onSubmit={handleCreatePesagem} className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Capacidade (ton) *</Label>
                        <Input
                          type="number"
                          step="0.0001"
                          value={pesagemForm.capacidade}
                          onChange={(e) => setPesagemForm({ ...pesagemForm, capacidade: e.target.value })}
                          placeholder="Ex: 44.09"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Data de Vigência *</Label>
                        <Input
                          type="date"
                          value={pesagemForm.dataVigencia}
                          onChange={(e) => setPesagemForm({ ...pesagemForm, dataVigencia: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Observação</Label>
                        <Input
                          value={pesagemForm.observacao}
                          onChange={(e) => setPesagemForm({ ...pesagemForm, observacao: e.target.value })}
                          placeholder="Ex: Pesagem na balança X"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button type="submit" disabled={createPesagemMutation.isPending} className="bg-amber-600 hover:bg-amber-700 text-white">
                        {createPesagemMutation.isPending ? "Salvando..." : "Registrar Pesagem"}
                      </Button>
                      <Button type="button" variant="outline" onClick={() => {
                        setNovaPesagemOpen(false);
                        setPesagemForm({ capacidade: "", dataVigencia: "", observacao: "" });
                      }}>
                        Cancelar
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            {/* Tabela de Pesagens */}
            {pesagensLoading ? (
              <div className="text-center py-4 text-muted-foreground">Carregando pesagens...</div>
            ) : pesagens && pesagens.length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data de Vigência</TableHead>
                      <TableHead>Capacidade (ton)</TableHead>
                      <TableHead>Observação</TableHead>
                      <TableHead>Registrado em</TableHead>
                      {canDelete("equipamentos") && <TableHead className="text-right">Ações</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pesagens.map((p, idx) => (
                      <TableRow key={p.id} className={idx === 0 ? "bg-amber-50/50 dark:bg-amber-950/20" : ""}>
                        <TableCell className="font-medium">
                          {formatDateBR(p.dataVigencia)}
                          {idx === 0 && (
                            <span className="ml-2 text-xs bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 px-2 py-0.5 rounded-full">
                              Vigente
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="font-bold text-amber-700 dark:text-amber-400">
                          {parseFloat(p.capacidade).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{p.observacao || '-'}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {p.createdAt ? new Date(p.createdAt).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '-'}
                        </TableCell>
                        {canDelete("equipamentos") && (
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setDeletePesagemId(p.id)}
                              className="text-destructive hover:text-destructive"
                              title="Excluir pesagem"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground border rounded-md">
                <Scale className="h-12 w-12 mx-auto mb-2 opacity-30" />
                <p>Nenhuma pesagem registrada para este equipamento.</p>
                <p className="text-sm mt-1">O sistema usará o campo "Capacidade" do cadastro como valor padrão.</p>
              </div>
            )}

            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-sm">
              <p className="font-semibold text-blue-800 dark:text-blue-300 flex items-center gap-1">
                <History className="h-4 w-4" />
                Como funciona o histórico de pesagens
              </p>
              <p className="text-blue-700 dark:text-blue-400 mt-1">
                Cada pesagem tem uma <strong>Data de Vigência</strong> que indica a partir de quando aquela capacidade passou a valer.
                Ao calcular a produção de qualquer período, o sistema usa automaticamente a capacidade que estava vigente na data de cada registro,
                garantindo que relatórios de períodos anteriores mantenham os valores corretos.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão de pesagem */}
      <AlertDialog open={!!deletePesagemId} onOpenChange={(open) => !open && setDeletePesagemId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Pesagem</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta pesagem? Isso pode afetar os cálculos de produção dos períodos associados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletePesagemId && deletePesagemMutation.mutate({ id: deletePesagemId })}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletePesagemMutation.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Equipamentos</CardTitle>
          <CardDescription>
            {filteredEquipamentos?.length || 0} equipamento(s) encontrado(s)
          </CardDescription>
          <div className="flex flex-col sm:flex-row gap-4 mt-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, código, modelo ou grupo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="w-full sm:w-64 flex gap-2">
              <Select value={filterGrupoId} onValueChange={setFilterGrupoId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Filtrar por grupo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os grupos</SelectItem>
                  <SelectItem value="none">Sem grupo</SelectItem>
                  {grupos?.map((grupo) => (
                    <SelectItem key={grupo.id} value={grupo.id.toString()}>
                      {grupo.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {canCreate("equipamentos") && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setNovoGrupoOpen(true)}
                  title="Novo Grupo"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : filteredEquipamentos && filteredEquipamentos.length > 0 ? (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código/Tag</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Grupo</TableHead>
                    <TableHead>Modelo</TableHead>
                    <TableHead>Ano</TableHead>
                    <TableHead>Capacidade</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEquipamentos.map((eq) => (
                    <TableRow key={eq.id}>
                      <TableCell className="font-medium">{eq.codigoTag || "-"}</TableCell>
                      <TableCell>{eq.nomeDoEquipamento}</TableCell>
                      <TableCell>
                        {eq.grupoNome ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                            {eq.grupoNome}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>{eq.modelo || "-"}</TableCell>
                      <TableCell>{eq.ano || "-"}</TableCell>
                      <TableCell>{eq.capacidade || "-"}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          eq.ativo === "sim" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                        }`}>
                          {eq.ativo === "sim" ? "Ativo" : "Inativo"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenPesagens(eq)}
                            className="text-amber-600 hover:text-amber-700 border-amber-300 hover:border-amber-400"
                            title="Histórico de Pesagens"
                          >
                            <Scale className="h-4 w-4" />
                          </Button>
                          {canEdit("equipamentos") && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(eq)}
                              title="Editar"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {canDelete("equipamentos") && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(eq)}
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
              {searchTerm ? "Nenhum equipamento encontrado com esse termo de busca." : "Nenhum equipamento cadastrado. Clique em 'Novo Equipamento' para começar."}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Cadastro de Novo Grupo */}
      <Dialog open={novoGrupoOpen} onOpenChange={setNovoGrupoOpen}>
        <DialogContent className="max-w-md">
          <form onSubmit={handleCreateGrupo}>
            <DialogHeader>
              <DialogTitle>Novo Grupo de Equipamento</DialogTitle>
              <DialogDescription>
                Cadastre um novo grupo para organizar os equipamentos
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <div className="space-y-2">
                <Label htmlFor="novoGrupoNome">Nome do Grupo *</Label>
                <Input
                  id="novoGrupoNome"
                  value={novoGrupoNome}
                  onChange={(e) => setNovoGrupoNome(e.target.value)}
                  placeholder="Ex: Escavadeiras Hidráulicas"
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => {
                setNovoGrupoOpen(false);
                setNovoGrupoNome("");
              }}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createGrupoMutation.isPending}>
                {createGrupoMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
