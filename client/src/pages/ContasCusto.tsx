import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Search, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";

const CLASSIFICACAO_LABELS: Record<string, string> = {
  custo_fixo: "Custo Fixo",
  custo_variavel: "Custo Variável",
  despesa_fixa: "Despesa Fixa",
  despesa_variavel: "Despesa Variável",
};

const CLASSIFICACAO_COLORS: Record<string, string> = {
  custo_fixo: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  custo_variavel: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  despesa_fixa: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  despesa_variavel: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
};

const emptyForm = {
  nome: "",
  divisor: "producao" as "producao" | "vendas",
  classificacao: "custo_variavel" as "custo_fixo" | "custo_variavel" | "despesa_fixa" | "despesa_variavel",
  observacao: "",
  ativo: "sim" as "sim" | "nao",
};

export default function ContasCusto() {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filtroClassificacao, setFiltroClassificacao] = useState("");
  const [filtroDivisor, setFiltroDivisor] = useState("");
  const [formData, setFormData] = useState(emptyForm);

  const { canCreate, canEdit, canDelete } = usePermissions();
  const canCreateItem = canCreate("contaCusto");
  const canEditItem = canEdit("contaCusto");
  const canDeleteItem = canDelete("contaCusto");

  const { data: items, refetch } = trpc.contasCusto.list.useQuery();

  const createMutation = trpc.contasCusto.create.useMutation({
    onSuccess: () => {
      toast.success("Conta de custo criada com sucesso!");
      refetch();
      setOpen(false);
      resetForm();
    },
    onError: (error) => toast.error(error.message || "Erro ao criar"),
  });

  const updateMutation = trpc.contasCusto.update.useMutation({
    onSuccess: () => {
      toast.success("Conta de custo atualizada com sucesso!");
      refetch();
      setOpen(false);
      resetForm();
    },
    onError: (error) => toast.error(error.message || "Erro ao atualizar"),
  });

  const deleteMutation = trpc.contasCusto.delete.useMutation({
    onSuccess: () => { toast.success("Conta excluída com sucesso!"); refetch(); },
    onError: (error) => toast.error(error.message || "Erro ao excluir"),
  });

  const resetForm = () => {
    setFormData(emptyForm);
    setEditingId(null);
  };

  const handleEdit = (item: any) => {
    if (!canEditItem) { toast.error("Sem permissão"); return; }
    setEditingId(item.id);
    setFormData({
      nome: item.nome,
      divisor: item.divisor ?? "producao",
      classificacao: item.classificacao ?? "custo_variavel",
      observacao: item.observacao ?? "",
      ativo: item.ativo ?? "sim",
    });
    setOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome.trim()) { toast.error("Nome é obrigatório"); return; }
    const payload = {
      nome: formData.nome.trim(),
      divisor: formData.divisor,
      classificacao: formData.classificacao,
      observacao: formData.observacao || null,
      ativo: formData.ativo,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const filteredItems = useMemo(() => {
    if (!items) return [];
    return items.filter((item) => {
      const matchSearch = !searchTerm || item.nome.toLowerCase().includes(searchTerm.toLowerCase());
      const matchClass = !filtroClassificacao || item.classificacao === filtroClassificacao;
      const matchDivisor = !filtroDivisor || item.divisor === filtroDivisor;
      return matchSearch && matchClass && matchDivisor;
    });
  }, [items, searchTerm, filtroClassificacao, filtroDivisor]);

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <BookOpen className="h-8 w-8 text-primary" />
            Plano de Contas
          </h1>
          <p className="text-muted-foreground mt-1">
            Cadastro de contas com classificação e divisor de rateio
          </p>
        </div>
        {canCreateItem && (
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Nova Conta</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingId ? "Editar Conta de Custo" : "Nova Conta de Custo"}</DialogTitle>
                <DialogDescription>
                  Defina o nome, classificação e divisor de rateio desta conta.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit}>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="nome">Nome *</Label>
                    <Input
                      id="nome"
                      value={formData.nome}
                      onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                      placeholder="Ex: Combustível, Mão de Obra, Manutenção..."
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="classificacao">Classificação *</Label>
                      <Select
                        value={formData.classificacao}
                        onValueChange={(v) => setFormData({ ...formData, classificacao: v as typeof formData.classificacao })}
                      >
                        <SelectTrigger id="classificacao">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="custo_fixo">Custo Fixo</SelectItem>
                          <SelectItem value="custo_variavel">Custo Variável</SelectItem>
                          <SelectItem value="despesa_fixa">Despesa Fixa</SelectItem>
                          <SelectItem value="despesa_variavel">Despesa Variável</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="divisor">Divisor de Rateio *</Label>
                      <Select
                        value={formData.divisor}
                        onValueChange={(v) => setFormData({ ...formData, divisor: v as typeof formData.divisor })}
                      >
                        <SelectTrigger id="divisor">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="producao">Produção</SelectItem>
                          <SelectItem value="vendas">Vendas</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ativo">Status</Label>
                    <Select
                      value={formData.ativo}
                      onValueChange={(v) => setFormData({ ...formData, ativo: v as "sim" | "nao" })}
                    >
                      <SelectTrigger id="ativo">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sim">Ativo</SelectItem>
                        <SelectItem value="nao">Inativo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="observacao">Observações</Label>
                    <Textarea
                      id="observacao"
                      value={formData.observacao}
                      onChange={(e) => setFormData({ ...formData, observacao: e.target.value })}
                      placeholder="Observações sobre esta conta..."
                      rows={3}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => { setOpen(false); resetForm(); }}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isPending}>
                    {isPending ? "Salvando..." : editingId ? "Salvar Alterações" : "Criar Conta"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Resumo por classificação */}
      {items && items.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(["custo_fixo", "custo_variavel", "despesa_fixa", "despesa_variavel"] as const).map((cls) => {
            const qtd = items.filter((i) => i.classificacao === cls).length;
            return (
              <Card
                key={cls}
                className={`cursor-pointer hover:border-primary/50 transition-colors ${filtroClassificacao === cls ? "border-primary" : ""}`}
                onClick={() => setFiltroClassificacao(filtroClassificacao === cls ? "" : cls)}
              >
                <CardContent className="pt-4 pb-3">
                  <div className="text-2xl font-bold">{qtd}</div>
                  <div className={`text-xs font-medium mt-1 px-2 py-0.5 rounded-full inline-block ${CLASSIFICACAO_COLORS[cls]}`}>
                    {CLASSIFICACAO_LABELS[cls]}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle>Contas Cadastradas</CardTitle>
              <CardDescription>{filteredItems.length} de {items?.length ?? 0} conta(s)</CardDescription>
            </div>
            <div className="flex gap-2">
              <Select value={filtroDivisor} onValueChange={setFiltroDivisor}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Divisor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos</SelectItem>
                  <SelectItem value="producao">Produção</SelectItem>
                  <SelectItem value="vendas">Vendas</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filtroClassificacao} onValueChange={setFiltroClassificacao}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Classificação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todas</SelectItem>
                  <SelectItem value="custo_fixo">Custo Fixo</SelectItem>
                  <SelectItem value="custo_variavel">Custo Variável</SelectItem>
                  <SelectItem value="despesa_fixa">Despesa Fixa</SelectItem>
                  <SelectItem value="despesa_variavel">Despesa Variável</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          {filteredItems.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Classificação</TableHead>
                    <TableHead>Divisor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Observações</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item) => (
                    <TableRow key={item.id} className={item.ativo === "nao" ? "opacity-50" : ""}>
                      <TableCell className="font-medium">{item.nome}</TableCell>
                      <TableCell>
                        {item.classificacao ? (
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${CLASSIFICACAO_COLORS[item.classificacao]}`}>
                            {CLASSIFICACAO_LABELS[item.classificacao]}
                          </span>
                        ) : "-"}
                      </TableCell>
                      <TableCell>
                        {item.divisor ? (
                          <Badge variant="outline">
                            {item.divisor === "producao" ? "Produção" : "Vendas"}
                          </Badge>
                        ) : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.ativo === "sim" ? "default" : "secondary"}>
                          {item.ativo === "sim" ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm max-w-xs truncate">
                        {item.observacao || "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {canEditItem && (
                            <Button variant="outline" size="sm" onClick={() => handleEdit(item)} title="Editar">
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {canDeleteItem && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => { if (confirm(`Excluir a conta "${item.nome}"?`)) deleteMutation.mutate({ id: item.id }); }}
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
              {searchTerm || filtroClassificacao || filtroDivisor
                ? "Nenhuma conta encontrada com os filtros aplicados."
                : "Nenhuma conta cadastrada. Clique em 'Nova Conta' para começar."}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
