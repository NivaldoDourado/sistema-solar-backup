import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";

export default function ContasCusto() {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [formData, setFormData] = useState({ nome: "", observacao: "" });
  
  const { canCreate, canEdit, canDelete } = usePermissions();
  const canCreateItem = canCreate("contaCusto");
  const canEditItem = canEdit("contaCusto");
  const canDeleteItem = canDelete("contaCusto");

  const { data: items, refetch } = trpc.contasCusto.list.useQuery();
  const createMutation = trpc.contasCusto.create.useMutation({
    onSuccess: () => {
      toast.success("Conta Custo criada com sucesso!");
      refetch();
      setOpen(false);
      resetForm();
    },
    onError: (error) => { toast.error(error.message || "Erro ao criar"); },
  });

  const updateMutation = trpc.contasCusto.update.useMutation({
    onSuccess: () => {
      toast.success("Conta Custo atualizada com sucesso!");
      refetch();
      setOpen(false);
      resetForm();
    },
    onError: (error) => { toast.error(error.message || "Erro ao atualizar"); },
  });

  const deleteMutation = trpc.contasCusto.delete.useMutation({
    onSuccess: () => { toast.success("Excluída com sucesso!"); refetch(); },
    onError: (error) => { toast.error(error.message || "Erro ao excluir"); },
  });

  const resetForm = () => {
    setFormData({ nome: "", observacao: "" });
    setEditingId(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      nome: formData.nome,
      observacao: formData.observacao || null,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleEdit = (item: any) => {
    if (!canEditItem) { toast.error("Sem permissão"); return; }
    setFormData({ nome: item.nome, observacao: item.observacao || "" });
    setEditingId(item.id);
    setOpen(true);
  };

  const handleDelete = (id: number) => {
    if (!canDeleteItem) { toast.error("Sem permissão"); return; }
    if (confirm("Confirma exclusão?")) { deleteMutation.mutate({ id }); }
  };

  const filteredItems = items?.filter((item) =>
    Object.values(item).some((value) => String(value).toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Conta Custo</h1>
          <p className="text-muted-foreground mt-1">Gerenciar contas de custo</p>
        </div>
        {canCreateItem && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}><Plus className="mr-2 h-4 w-4" />Nova Conta Custo</Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>{editingId ? "Editar" : "Nova"} Conta Custo</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label>Nome *</Label>
                    <Input value={formData.nome} onChange={(e) => setFormData({...formData, nome: e.target.value})} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Observação</Label>
                    <Textarea value={formData.observacao || ""} onChange={(e) => setFormData({...formData, observacao: e.target.value})} rows={3} />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button type="submit">{editingId ? "Atualizar" : "Criar"}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista</CardTitle>
          <CardDescription>{items?.length || 0} registro(s)</CardDescription>
          <div className="relative mt-4">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-8" />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Observação</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems?.length === 0 ? (
                <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">Nenhum registro</TableCell></TableRow>
              ) : (
                filteredItems?.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.nome}</TableCell>
                    <TableCell className="text-muted-foreground">{item.observacao || "-"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {canEditItem && <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}><Pencil className="h-4 w-4" /></Button>}
                        {canDeleteItem && <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
