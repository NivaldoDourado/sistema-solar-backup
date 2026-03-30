import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";

export default function OutrasParadas() {
  const perms = usePermissions();

  const { data: paradas = [], refetch, isLoading } = trpc.outrasParadas.list.useQuery();

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [descricao, setDescricao] = useState("");
  const [observacao, setObservacao] = useState("");
  const [ativo, setAtivo] = useState<"sim" | "nao">("sim");

  const createMutation = trpc.outrasParadas.create.useMutation({
    onSuccess: () => { toast.success("Parada criada com sucesso!"); refetch(); handleClose(); },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.outrasParadas.update.useMutation({
    onSuccess: () => { toast.success("Parada atualizada!"); refetch(); handleClose(); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.outrasParadas.delete.useMutation({
    onSuccess: () => { toast.success("Parada excluída!"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  function handleOpen(item?: typeof paradas[0]) {
    if (item) {
      setEditingId(item.id);
      setDescricao(item.descricao);
      setObservacao(item.observacao || "");
      setAtivo(item.ativo as "sim" | "nao");
    } else {
      setEditingId(null);
      setDescricao("");
      setObservacao("");
      setAtivo("sim");
    }
    setOpen(true);
  }

  function handleClose() {
    setOpen(false);
    setEditingId(null);
    setDescricao("");
    setObservacao("");
    setAtivo("sim");
  }

  function handleSubmit() {
    if (!descricao.trim()) { toast.error("Descrição é obrigatória"); return; }
    if (editingId) {
      updateMutation.mutate({ id: editingId, descricao, observacao, ativo });
    } else {
      createMutation.mutate({ descricao, observacao, ativo });
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Outras Paradas</h1>
          <p className="text-muted-foreground text-sm">Cadastro de motivos de parada para a Parte Diária</p>
        </div>
        {perms.canCreate("outrasParadas") && (
          <Button onClick={() => handleOpen()} className="gap-2">
            <Plus className="h-4 w-4" />
            Nova Parada
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Motivos Cadastrados ({paradas.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : paradas.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Nenhum motivo cadastrado.</p>
              <p className="text-sm mt-1">Clique em "Nova Parada" para adicionar.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Descrição</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Observação</th>
                    <th className="text-center py-2 px-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {paradas.map((p) => (
                    <tr key={p.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="py-2 px-3 font-medium">{p.descricao}</td>
                      <td className="py-2 px-3 text-muted-foreground">{p.observacao || "—"}</td>
                      <td className="py-2 px-3 text-center">
                        <Badge variant={p.ativo === "sim" ? "default" : "secondary"}>
                          {p.ativo === "sim" ? "Ativo" : "Inativo"}
                        </Badge>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <div className="flex justify-end gap-1">
                          {perms.canEdit("outrasParadas") && (
                            <Button variant="ghost" size="sm" onClick={() => handleOpen(p)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {perms.canDelete("outrasParadas") && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => {
                                if (confirm(`Excluir "${p.descricao}"?`)) deleteMutation.mutate({ id: p.id });
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Parada" : "Nova Parada"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição *</Label>
              <Input
                id="descricao"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex: Aguardando operador, Abastecimento..."
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="observacao">Observação</Label>
              <Textarea
                id="observacao"
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Detalhes adicionais (opcional)"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={ativo} onValueChange={(v) => setAtivo(v as "sim" | "nao")}>
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
          <DialogFooter>
            <Button variant="outline" onClick={handleClose} disabled={isSaving}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingId ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
