import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";

const funcaoLabels: Record<string, string> = {
  operador: "Operador",
  motorista: "Motorista",
  ambos: "Operador/Motorista",
};

const funcaoColors: Record<string, string> = {
  operador: "bg-blue-100 text-blue-800",
  motorista: "bg-green-100 text-green-800",
  ambos: "bg-purple-100 text-purple-800",
};

export default function OperadoresMotoristas() {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [formData, setFormData] = useState({
    nome: "",
    funcao: "ambos" as "operador" | "motorista" | "ambos",
    matricula: "",
    telefone: "",
    ativo: "sim" as "sim" | "nao",
  });

  const { canCreate, canEdit, canDelete } = usePermissions();
  const canCreateItem = canCreate("operadoresMotoristas");
  const canEditItem = canEdit("operadoresMotoristas");
  const canDeleteItem = canDelete("operadoresMotoristas");

  const { data: items, refetch } = trpc.operadoresMotoristas.list.useQuery();
  const createMutation = trpc.operadoresMotoristas.create.useMutation({
    onSuccess: () => {
      toast.success("Operador/Motorista criado com sucesso!");
      refetch();
      setOpen(false);
      resetForm();
    },
    onError: (error) => { toast.error(error.message || "Erro ao criar"); },
  });

  const updateMutation = trpc.operadoresMotoristas.update.useMutation({
    onSuccess: () => {
      toast.success("Operador/Motorista atualizado com sucesso!");
      refetch();
      setOpen(false);
      resetForm();
    },
    onError: (error) => { toast.error(error.message || "Erro ao atualizar"); },
  });

  const deleteMutation = trpc.operadoresMotoristas.delete.useMutation({
    onSuccess: () => { toast.success("Excluído com sucesso!"); refetch(); },
    onError: (error) => { toast.error(error.message || "Erro ao excluir"); },
  });

  const resetForm = () => {
    setFormData({ nome: "", funcao: "ambos", matricula: "", telefone: "", ativo: "sim" });
    setEditingId(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (item: any) => {
    if (!canEditItem) { toast.error("Sem permissão"); return; }
    setFormData({
      nome: item.nome,
      funcao: item.funcao || "ambos",
      matricula: item.matricula || "",
      telefone: item.telefone || "",
      ativo: item.ativo || "sim",
    });
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
          <h1 className="text-3xl font-bold">Operadores / Motoristas</h1>
          <p className="text-muted-foreground mt-1">Gerenciar operadores e motoristas de equipamentos</p>
        </div>
        {canCreateItem && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}><Plus className="mr-2 h-4 w-4" />Novo</Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>{editingId ? "Editar" : "Novo"} Operador/Motorista</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label>Nome *</Label>
                    <Input value={formData.nome} onChange={(e) => setFormData({...formData, nome: e.target.value})} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Função *</Label>
                    <Select value={formData.funcao} onValueChange={(v) => setFormData({...formData, funcao: v as any})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a função" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="operador">Operador</SelectItem>
                        <SelectItem value="motorista">Motorista</SelectItem>
                        <SelectItem value="ambos">Operador/Motorista</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Matrícula</Label>
                    <Input value={formData.matricula} onChange={(e) => setFormData({...formData, matricula: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Telefone</Label>
                    <Input value={formData.telefone} onChange={(e) => setFormData({...formData, telefone: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Ativo</Label>
                    <Select value={formData.ativo} onValueChange={(v) => setFormData({...formData, ativo: v as any})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sim">Sim</SelectItem>
                        <SelectItem value="nao">Não</SelectItem>
                      </SelectContent>
                    </Select>
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
                <TableHead>Função</TableHead>
                <TableHead>Matrícula</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems?.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nenhum registro</TableCell></TableRow>
              ) : (
                filteredItems?.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.nome}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={funcaoColors[item.funcao] || ""}>
                        {funcaoLabels[item.funcao] || item.funcao}
                      </Badge>
                    </TableCell>
                    <TableCell>{item.matricula || "-"}</TableCell>
                    <TableCell>{item.telefone || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={item.ativo === "sim" ? "default" : "secondary"}>
                        {item.ativo === "sim" ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
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
