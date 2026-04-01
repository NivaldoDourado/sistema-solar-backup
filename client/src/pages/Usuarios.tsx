import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Trash2, User, Edit, UserPlus, KeyRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/_core/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";

const roleLabels: Record<string, string> = {
  diretor: "Diretor",
  gerente: "Gerente",
  consultoria: "Consultoria",
  coordenador: "Coordenador",
  usuario: "Usuário",
  controle: "Controle",
  operador: "Operador",
};

const roleColors: Record<string, string> = {
  admin: "bg-red-500",
  diretor: "bg-purple-500",
  gerente: "bg-blue-500",
  consultoria: "bg-green-500",
  coordenador: "bg-yellow-500",
  usuario: "bg-gray-500",
  controle: "bg-orange-500",
  operador: "bg-cyan-500",
};

export default function Usuarios() {
  const { user } = useAuth();
  const isConsultoria = user?.role === "consultoria" || user?.role === "admin";
  const { canCreate: canCreatePerm, canEdit: canEditPerm, canDelete: canDeletePerm } = usePermissions();
  
  const { data: usuarios, refetch } = trpc.usuarios.list.useQuery();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    whatsapp: "",
    cargo: "",
    role: "",
  });
  const [createFormData, setCreateFormData] = useState({
    name: "",
    email: "",
    password: "",
    whatsapp: "",
    cargo: "",
    role: "usuario",
  });
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);
  const [resetPasswordUser, setResetPasswordUser] = useState<any>(null);
  const [newPassword, setNewPassword] = useState("");

  const updateMutation = trpc.usuarios.update.useMutation({
    onSuccess: () => {
      toast.success("Usuário atualizado com sucesso!");
      refetch();
      setEditDialogOpen(false);
      setEditingUser(null);
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar: ${error.message}`);
    },
  });

  const createMutation = trpc.permissoes.createUser.useMutation({
    onSuccess: () => {
      toast.success("Usuário cadastrado com sucesso! A senha temporária foi definida.");
      refetch();
      setCreateDialogOpen(false);
      setCreateFormData({ name: "", email: "", password: "", whatsapp: "", cargo: "", role: "usuario" });
    },
    onError: (error) => {
      toast.error(`Erro ao cadastrar: ${error.message}`);
    },
  });

  const deleteMutation = trpc.usuarios.delete.useMutation({
    onSuccess: () => {
      toast.success("Usuário excluído com sucesso!");
      refetch();
    },
    onError: (error) => {
      toast.error(`Erro ao excluir: ${error.message}`);
    },
  });

  const handleEdit = (usuario: any) => {
    setEditingUser(usuario);
    setFormData({
      name: usuario.name || "",
      email: usuario.email || "",
      whatsapp: usuario.whatsapp || "",
      cargo: usuario.cargo || "",
      role: usuario.role,
    });
    setEditDialogOpen(true);
  };

  const handleSave = () => {
    if (!formData.role) {
      toast.error("Selecione um perfil");
      return;
    }
    updateMutation.mutate({
      id: editingUser.id,
      name: formData.name,
      email: formData.email,
      whatsapp: formData.whatsapp,
      cargo: formData.cargo,
      role: formData.role as any,
    });
  };

  const resetPasswordMutation = trpc.permissoes.resetPassword.useMutation({
    onSuccess: () => {
      toast.success("Senha resetada com sucesso! O usuário deverá trocar a senha no próximo login.");
      setResetPasswordDialogOpen(false);
      setNewPassword("");
    },
    onError: (error) => {
      toast.error(`Erro ao resetar senha: ${error.message}`);
    },
  });

  const handleCreate = () => {
    if (!createFormData.name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    if (!createFormData.email.trim()) {
      toast.error("E-mail é obrigatório");
      return;
    }
    if (!createFormData.password || createFormData.password.length < 6) {
      toast.error("Senha deve ter pelo menos 6 caracteres");
      return;
    }
    if (!createFormData.role) {
      toast.error("Selecione um perfil");
      return;
    }
    createMutation.mutate({
      name: createFormData.name,
      email: createFormData.email,
      password: createFormData.password,
      whatsapp: createFormData.whatsapp || undefined,
      cargo: createFormData.cargo || undefined,
      role: createFormData.role as any,
    });
  };

  const handleResetPassword = () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error("A nova senha deve ter pelo menos 6 caracteres");
      return;
    }
    resetPasswordMutation.mutate({
      userId: resetPasswordUser.id,
      newPassword,
    });
  };

  const handleDelete = (userId: number, userName: string) => {
    if (confirm(`Tem certeza que deseja excluir o usuário "${userName}"?`)) {
      deleteMutation.mutate({ id: userId });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gerenciamento de Usuários</h1>
          <p className="text-muted-foreground">
            Gerencie perfis e informações dos usuários do sistema
          </p>
        </div>
        {isConsultoria && (
          <Button onClick={() => setCreateDialogOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Cadastrar Usuário
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Usuários do Sistema</CardTitle>
          <CardDescription>
            Lista de todos os usuários cadastrados com suas informações e perfis
            {usuarios && <span className="ml-2 font-medium">({usuarios.length} usuários)</span>}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {usuarios?.map((usuario) => (
              <div
                key={usuario.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50"
              >
                <div className="flex items-center gap-4 flex-1">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{usuario.name || "Sem nome"}</p>
                      <Badge className={`${roleColors[usuario.role]} text-white`}>
                        {roleLabels[usuario.role] || usuario.role}
                      </Badge>
                      {(usuario as any).loginMethod === "manual" && (
                        <Badge variant="outline" className="text-xs">Cadastro manual</Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1 mt-1">
                      {usuario.email && <p>📧 {usuario.email}</p>}
                      {usuario.whatsapp && <p>📱 {usuario.whatsapp}</p>}
                      {usuario.cargo && <p>💼 {usuario.cargo}</p>}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  {canEditPerm("usuarios") && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(usuario)}
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Editar
                  </Button>
                  )}
                  {canEditPerm("usuarios") && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setResetPasswordUser(usuario);
                      setNewPassword("");
                      setResetPasswordDialogOpen(true);
                    }}
                    title="Resetar Senha"
                  >
                    <KeyRound className="h-4 w-4" />
                  </Button>
                  )}
                  {canDeletePerm("usuarios") && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(usuario.id, usuario.name || "usuário")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  )}
                </div>
              </div>
            ))}
            {(!usuarios || usuarios.length === 0) && (
              <p className="text-center text-muted-foreground py-8">
                Nenhum usuário cadastrado
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Dialog de Edição */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>
              Atualize as informações e o perfil do usuário
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nome</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nome completo"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">E-mail</Label>
              <Input
                id="edit-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="email@exemplo.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-whatsapp">WhatsApp</Label>
              <Input
                id="edit-whatsapp"
                value={formData.whatsapp}
                onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                placeholder="(00) 00000-0000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-cargo">Cargo</Label>
              <Input
                id="edit-cargo"
                value={formData.cargo}
                onChange={(e) => setFormData({ ...formData, cargo: e.target.value })}
                placeholder="Ex: Gerente de Operações"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role">Perfil de Acesso</Label>
              <Select
                value={formData.role}
                onValueChange={(value) => setFormData({ ...formData, role: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o perfil" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(roleLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Cadastro (Consultoria) */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Cadastrar Novo Usuário</DialogTitle>
            <DialogDescription>
              Preencha as informações do novo usuário. Ele receberá uma senha temporária e deverá trocá-la no primeiro login.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="create-name">Nome *</Label>
              <Input
                id="create-name"
                value={createFormData.name}
                onChange={(e) => setCreateFormData({ ...createFormData, name: e.target.value })}
                placeholder="Nome completo"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-email">E-mail *</Label>
              <Input
                id="create-email"
                type="email"
                value={createFormData.email}
                onChange={(e) => setCreateFormData({ ...createFormData, email: e.target.value })}
                placeholder="email@exemplo.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-password">Senha Temporária *</Label>
              <Input
                id="create-password"
                type="password"
                value={createFormData.password}
                onChange={(e) => setCreateFormData({ ...createFormData, password: e.target.value })}
                placeholder="Mínimo 6 caracteres"
              />
              <p className="text-xs text-muted-foreground">
                O usuário será obrigado a trocar esta senha no primeiro login.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-whatsapp">WhatsApp</Label>
              <Input
                id="create-whatsapp"
                value={createFormData.whatsapp}
                onChange={(e) => setCreateFormData({ ...createFormData, whatsapp: e.target.value })}
                placeholder="(00) 00000-0000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-cargo">Cargo</Label>
              <Input
                id="create-cargo"
                value={createFormData.cargo}
                onChange={(e) => setCreateFormData({ ...createFormData, cargo: e.target.value })}
                placeholder="Ex: Operador de Britador"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-role">Perfil de Acesso *</Label>
              <Select
                value={createFormData.role}
                onValueChange={(value) => setCreateFormData({ ...createFormData, role: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o perfil" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(roleLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              <UserPlus className="h-4 w-4 mr-1" />
              {createMutation.isPending ? "Cadastrando..." : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Dialog de Reset de Senha (Consultoria) */}
      <Dialog open={resetPasswordDialogOpen} onOpenChange={setResetPasswordDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Resetar Senha</DialogTitle>
            <DialogDescription>
              Defina uma nova senha temporária para <strong>{resetPasswordUser?.name}</strong>. O usuário será obrigado a trocá-la no próximo login.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reset-password">Nova Senha Temporária</Label>
              <Input
                id="reset-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetPasswordDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleResetPassword} disabled={resetPasswordMutation.isPending}>
              <KeyRound className="h-4 w-4 mr-1" />
              {resetPasswordMutation.isPending ? "Resetando..." : "Resetar Senha"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
