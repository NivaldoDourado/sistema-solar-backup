import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Search, Building2 } from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";

const ESTADOS_BR = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA",
  "PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"
];

const emptyForm = {
  nome: "", cpfCnpj: "", inscricaoEstadual: "", telefone: "",
  email: "", endereco: "", cidade: "", estado: "", cep: "", observacoes: "", ativo: "sim" as "sim" | "nao",
};

export default function Clientes() {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [formData, setFormData] = useState(emptyForm);

  const { canCreate, canEdit, canDelete } = usePermissions();
  const canCreateItem = canCreate("clientes");
  const canEditItem = canEdit("clientes");
  const canDeleteItem = canDelete("clientes");

  const { data: items, refetch } = trpc.vendas.clientesList.useQuery();

  const createMutation = trpc.vendas.clienteCreate.useMutation({
    onSuccess: () => { toast.success("Cliente criado com sucesso!"); refetch(); setOpen(false); resetForm(); },
    onError: (error) => { toast.error(error.message || "Erro ao criar cliente"); },
  });

  const updateMutation = trpc.vendas.clienteUpdate.useMutation({
    onSuccess: () => { toast.success("Cliente atualizado com sucesso!"); refetch(); setOpen(false); resetForm(); },
    onError: (error) => { toast.error(error.message || "Erro ao atualizar cliente"); },
  });

  const deleteMutation = trpc.vendas.clienteDelete.useMutation({
    onSuccess: () => { toast.success("Cliente excluído com sucesso!"); refetch(); },
    onError: (error) => { toast.error(error.message || "Erro ao excluir cliente"); },
  });

  const resetForm = () => { setFormData(emptyForm); setEditingId(null); };

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
      nome: item.nome || "",
      cpfCnpj: item.cpfCnpj || "",
      inscricaoEstadual: item.inscricaoEstadual || "",
      telefone: item.telefone || "",
      email: item.email || "",
      endereco: item.endereco || "",
      cidade: item.cidade || "",
      estado: item.estado || "",
      cep: item.cep || "",
      observacoes: item.observacoes || "",
      ativo: item.ativo || "sim",
    });
    setEditingId(item.id);
    setOpen(true);
  };

  const handleDelete = (id: number) => {
    if (!canDeleteItem) { toast.error("Sem permissão"); return; }
    if (confirm("Confirma exclusão deste cliente?")) { deleteMutation.mutate({ id }); }
  };

  const filteredItems = items?.filter((item) =>
    [item.nome, item.cpfCnpj, item.cidade, item.telefone, item.email]
      .some((value) => value && String(value).toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const set = (field: string, value: string) => setFormData(prev => ({ ...prev, [field]: value }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Building2 className="h-8 w-8 text-primary" />
            Clientes
          </h1>
          <p className="text-muted-foreground mt-1">Gerenciar clientes para vendas de material</p>
        </div>
        {canCreateItem && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}><Plus className="mr-2 h-4 w-4" />Novo Cliente</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>{editingId ? "Editar" : "Novo"} Cliente</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2 col-span-2">
                      <Label>Nome / Razão Social *</Label>
                      <Input value={formData.nome} onChange={(e) => set("nome", e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <Label>CPF/CNPJ</Label>
                      <Input value={formData.cpfCnpj} onChange={(e) => set("cpfCnpj", e.target.value)} placeholder="00.000.000/0000-00" />
                    </div>
                    <div className="space-y-2">
                      <Label>Inscrição Estadual</Label>
                      <Input value={formData.inscricaoEstadual} onChange={(e) => set("inscricaoEstadual", e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Telefone</Label>
                      <Input value={formData.telefone} onChange={(e) => set("telefone", e.target.value)} placeholder="(00) 00000-0000" />
                    </div>
                    <div className="space-y-2">
                      <Label>E-mail</Label>
                      <Input type="email" value={formData.email} onChange={(e) => set("email", e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Endereço</Label>
                    <Input value={formData.endereco} onChange={(e) => set("endereco", e.target.value)} />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Cidade</Label>
                      <Input value={formData.cidade} onChange={(e) => set("cidade", e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Estado</Label>
                      <Select value={formData.estado || "none"} onValueChange={(v) => set("estado", v === "none" ? "" : v)}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Selecione</SelectItem>
                          {ESTADOS_BR.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>CEP</Label>
                      <Input value={formData.cep} onChange={(e) => set("cep", e.target.value)} placeholder="00000-000" />
                    </div>
                  </div>
                  {editingId && (
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select value={formData.ativo} onValueChange={(v) => set("ativo", v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sim">Ativo</SelectItem>
                          <SelectItem value="nao">Inativo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Observações</Label>
                    <Textarea value={formData.observacoes} onChange={(e) => set("observacoes", e.target.value)} rows={3} />
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
          <CardTitle>Lista de Clientes</CardTitle>
          <CardDescription>{items?.length || 0} cliente(s) cadastrado(s)</CardDescription>
          <div className="relative mt-4">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome, CPF/CNPJ, cidade, telefone ou e-mail..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-8" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome / Razão Social</TableHead>
                  <TableHead>CPF/CNPJ</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Cidade/UF</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems?.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nenhum cliente encontrado</TableCell></TableRow>
                ) : (
                  filteredItems?.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.nome}</TableCell>
                      <TableCell>{item.cpfCnpj || "-"}</TableCell>
                      <TableCell>{item.telefone || "-"}</TableCell>
                      <TableCell>{item.cidade ? `${item.cidade}${item.estado ? `/${item.estado}` : ""}` : "-"}</TableCell>
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
