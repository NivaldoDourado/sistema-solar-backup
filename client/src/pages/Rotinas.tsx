import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2, GripVertical, ClipboardList, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";

type Rotina = {
  id: number;
  nome: string;
  descricao: string | null;
  ordem: number;
  ativo: "sim" | "nao";
  createdAt: Date;
  updatedAt: Date;
};

export default function Rotinas() {
  const { user } = useAuth();
  const utils = trpc.useUtils();

  const [modalAberto, setModalAberto] = useState(false);
  const [excluirId, setExcluirId] = useState<number | null>(null);
  const [editando, setEditando] = useState<Rotina | null>(null);
  const [form, setForm] = useState({ nome: "", descricao: "", ordem: 0, ativo: "sim" as "sim" | "nao" });

  const { data: rotinas, isLoading } = trpc.rotinas.listarTodas.useQuery();

  const criar = trpc.rotinas.criar.useMutation({
    onSuccess: () => {
      utils.rotinas.listarTodas.invalidate();
      utils.rotinas.listar.invalidate();
      utils.rotinas.statusHoje.invalidate();
      toast.success("Rotina criada com sucesso!");
      fecharModal();
    },
    onError: (e) => toast.error(e.message),
  });

  const editar = trpc.rotinas.editar.useMutation({
    onSuccess: () => {
      utils.rotinas.listarTodas.invalidate();
      utils.rotinas.listar.invalidate();
      utils.rotinas.statusHoje.invalidate();
      toast.success("Rotina atualizada com sucesso!");
      fecharModal();
    },
    onError: (e) => toast.error(e.message),
  });

  const excluir = trpc.rotinas.excluir.useMutation({
    onSuccess: () => {
      utils.rotinas.listarTodas.invalidate();
      utils.rotinas.listar.invalidate();
      utils.rotinas.statusHoje.invalidate();
      toast.success("Rotina excluída com sucesso!");
      setExcluirId(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const abrirCriar = () => {
    setEditando(null);
    const proximaOrdem = rotinas ? Math.max(0, ...rotinas.map(r => r.ordem)) + 1 : 1;
    setForm({ nome: "", descricao: "", ordem: proximaOrdem, ativo: "sim" });
    setModalAberto(true);
  };

  const abrirEditar = (r: Rotina) => {
    setEditando(r);
    setForm({ nome: r.nome, descricao: r.descricao || "", ordem: r.ordem, ativo: r.ativo });
    setModalAberto(true);
  };

  const fecharModal = () => {
    setModalAberto(false);
    setEditando(null);
    setForm({ nome: "", descricao: "", ordem: 0, ativo: "sim" });
  };

  const salvar = () => {
    if (!form.nome.trim()) {
      toast.error("O nome da rotina é obrigatório.");
      return;
    }
    if (editando) {
      editar.mutate({ id: editando.id, nome: form.nome.trim(), descricao: form.descricao || undefined, ordem: form.ordem, ativo: form.ativo });
    } else {
      criar.mutate({ nome: form.nome.trim(), descricao: form.descricao || undefined, ordem: form.ordem });
    }
  };

  const moverOrdem = (rotina: Rotina, direcao: "up" | "down") => {
    if (!rotinas) return;
    const sorted = [...rotinas].sort((a, b) => a.ordem - b.ordem);
    const idx = sorted.findIndex(r => r.id === rotina.id);
    const alvo = direcao === "up" ? sorted[idx - 1] : sorted[idx + 1];
    if (!alvo) return;
    // Troca as ordens
    editar.mutate({ id: rotina.id, nome: rotina.nome, descricao: rotina.descricao || undefined, ordem: alvo.ordem, ativo: rotina.ativo });
    editar.mutate({ id: alvo.id, nome: alvo.nome, descricao: alvo.descricao || undefined, ordem: rotina.ordem, ativo: alvo.ativo });
  };

  const isAdmin = user?.role === "consultoria" || user?.role === "admin";

  if (!isAdmin) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <ClipboardList className="mx-auto mb-3 h-12 w-12 opacity-30" />
        <p className="text-lg font-medium">Acesso restrito</p>
        <p className="text-sm">Somente perfis Consultoria e Admin podem gerenciar rotinas.</p>
      </div>
    );
  }

  const sortedRotinas = rotinas ? [...rotinas].sort((a, b) => a.ordem - b.ordem) : [];

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-primary" />
            Rotinas Diárias
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie as rotinas que os usuários devem marcar diariamente no dashboard.
          </p>
        </div>
        <Button onClick={abrirCriar} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Rotina
        </Button>
      </div>

      {/* Lista de rotinas */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {sortedRotinas.length} rotina{sortedRotinas.length !== 1 ? "s" : ""} cadastrada{sortedRotinas.length !== 1 ? "s" : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-center text-muted-foreground text-sm">Carregando...</div>
          ) : sortedRotinas.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <ClipboardList className="mx-auto mb-3 h-10 w-10 opacity-30" />
              <p className="font-medium">Nenhuma rotina cadastrada</p>
              <p className="text-sm mt-1">Clique em "Nova Rotina" para começar.</p>
            </div>
          ) : (
            <div className="divide-y">
              {sortedRotinas.map((rotina, idx) => (
                <div key={rotina.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                  {/* Ícone de drag (visual) */}
                  <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />

                  {/* Ordem */}
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <button
                      onClick={() => moverOrdem(rotina, "up")}
                      disabled={idx === 0}
                      className="p-0.5 rounded hover:bg-muted disabled:opacity-20 disabled:cursor-not-allowed"
                    >
                      <ArrowUp className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => moverOrdem(rotina, "down")}
                      disabled={idx === sortedRotinas.length - 1}
                      className="p-0.5 rounded hover:bg-muted disabled:opacity-20 disabled:cursor-not-allowed"
                    >
                      <ArrowDown className="h-3 w-3" />
                    </button>
                  </div>

                  {/* Conteúdo */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{rotina.nome}</span>
                      <Badge variant={rotina.ativo === "sim" ? "default" : "secondary"} className="text-xs shrink-0">
                        {rotina.ativo === "sim" ? "Ativa" : "Inativa"}
                      </Badge>
                    </div>
                    {rotina.descricao && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{rotina.descricao}</p>
                    )}
                  </div>

                  {/* Ações */}
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => abrirEditar(rotina)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setExcluirId(rotina.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Informação sobre permissões */}
      <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
        <CardContent className="pt-4 pb-4">
          <p className="text-sm text-amber-800 dark:text-amber-300">
            <strong>Permissões:</strong> Somente o perfil <strong>Usuário</strong> pode marcar o status das rotinas no dashboard. Todos os outros perfis podem visualizar o card "Status dos Lançamentos" mas não podem alterar os status.
          </p>
        </CardContent>
      </Card>

      {/* Modal criar/editar */}
      <Dialog open={modalAberto} onOpenChange={(open) => !open && fecharModal()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar Rotina" : "Nova Rotina"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="nome">Nome da Rotina *</Label>
              <Input
                id="nome"
                value={form.nome}
                onChange={(e) => setForm(f => ({ ...f, nome: e.target.value }))}
                placeholder="Ex: Parte Diária, Abastecimento, Produção..."
                onKeyDown={(e) => e.key === "Enter" && salvar()}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="descricao">Descrição (opcional)</Label>
              <Textarea
                id="descricao"
                value={form.descricao}
                onChange={(e) => setForm(f => ({ ...f, descricao: e.target.value }))}
                placeholder="Detalhes sobre esta rotina..."
                rows={2}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ordem">Ordem de exibição</Label>
              <Input
                id="ordem"
                type="number"
                min={0}
                value={form.ordem}
                onChange={(e) => setForm(f => ({ ...f, ordem: parseInt(e.target.value) || 0 }))}
              />
            </div>
            {editando && (
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Rotina ativa</p>
                  <p className="text-xs text-muted-foreground">Rotinas inativas não aparecem no dashboard</p>
                </div>
                <Switch
                  checked={form.ativo === "sim"}
                  onCheckedChange={(v) => setForm(f => ({ ...f, ativo: v ? "sim" : "nao" }))}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={fecharModal}>Cancelar</Button>
            <Button onClick={salvar} disabled={criar.isPending || editar.isPending}>
              {criar.isPending || editar.isPending ? "Salvando..." : editando ? "Salvar" : "Criar Rotina"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar exclusão */}
      <AlertDialog open={excluirId !== null} onOpenChange={(open) => !open && setExcluirId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir rotina?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá a rotina e todo o histórico de status diários associados. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => excluirId && excluir.mutate({ id: excluirId })}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
