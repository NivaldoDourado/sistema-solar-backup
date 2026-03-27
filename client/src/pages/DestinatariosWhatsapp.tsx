import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, Phone, MessageSquare } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

const CARDS_DISPONIVEIS = [
  { id: "producao_caminhoes", label: "Produção Método Caminhões" },
  { id: "medicao_pilhas", label: "Medição das Pilhas" },
  { id: "producao_ultimo_dia", label: "Produção Último Dia Caminhões" },
  { id: "producao_perfuracao", label: "Produção de Perfuração" },
  { id: "revisoes_preventivas", label: "Revisões Preventivas" },
  { id: "producao_motoristas", label: "Produção dos Motoristas" },
  { id: "producao_setor", label: "Produção por Setor" },
  { id: "producao_servico", label: "Produção por Serviço" },
  { id: "producao_equipamento", label: "Produção por Equipamento" },
];

type FormData = {
  nome: string;
  telefone: string;
  cargo: string;
  ativo: "sim" | "nao";
  cardsSelecionados: string[];
};

const emptyFormData: FormData = {
  nome: "",
  telefone: "",
  cargo: "",
  ativo: "sim",
  cardsSelecionados: CARDS_DISPONIVEIS.map(c => c.id), // Todos selecionados por padrão
};

export default function DestinatariosWhatsapp() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<FormData>({ ...emptyFormData });

  const { data: destinatarios, isLoading } = trpc.destinatariosWhatsapp.list.useQuery();
  const utils = trpc.useUtils();

  const createMutation = trpc.destinatariosWhatsapp.create.useMutation({
    onSuccess: () => {
      utils.destinatariosWhatsapp.list.invalidate();
      toast.success("Destinatário cadastrado com sucesso!");
      setDialogOpen(false);
      resetForm();
    },
    onError: (err) => toast.error("Erro ao cadastrar: " + err.message),
  });

  const updateMutation = trpc.destinatariosWhatsapp.update.useMutation({
    onSuccess: () => {
      utils.destinatariosWhatsapp.list.invalidate();
      toast.success("Destinatário atualizado com sucesso!");
      setEditDialogOpen(false);
      resetForm();
    },
    onError: (err) => toast.error("Erro ao atualizar: " + err.message),
  });

  const deleteMutation = trpc.destinatariosWhatsapp.delete.useMutation({
    onSuccess: () => {
      utils.destinatariosWhatsapp.list.invalidate();
      toast.success("Destinatário removido com sucesso!");
    },
    onError: (err) => toast.error("Erro ao remover: " + err.message),
  });

  function resetForm() {
    setFormData({ ...emptyFormData });
    setEditingId(null);
  }

  function handleSubmit() {
    if (!formData.nome.trim() || !formData.telefone.trim()) {
      toast.error("Nome e telefone são obrigatórios!");
      return;
    }
    createMutation.mutate({
      nome: formData.nome,
      telefone: formData.telefone,
      cargo: formData.cargo || undefined,
      ativo: formData.ativo,
      cardsSelecionados: JSON.stringify(formData.cardsSelecionados),
    });
  }

  function handleEditSubmit() {
    if (!editingId || !formData.nome.trim() || !formData.telefone.trim()) {
      toast.error("Nome e telefone são obrigatórios!");
      return;
    }
    updateMutation.mutate({
      id: editingId,
      nome: formData.nome,
      telefone: formData.telefone,
      cargo: formData.cargo || undefined,
      ativo: formData.ativo,
      cardsSelecionados: JSON.stringify(formData.cardsSelecionados),
    });
  }

  function handleEdit(item: any) {
    let cards: string[] = [];
    try {
      cards = item.cardsSelecionados ? JSON.parse(item.cardsSelecionados) : CARDS_DISPONIVEIS.map(c => c.id);
    } catch {
      cards = CARDS_DISPONIVEIS.map(c => c.id);
    }
    setFormData({
      nome: item.nome,
      telefone: item.telefone,
      cargo: item.cargo || "",
      ativo: item.ativo,
      cardsSelecionados: cards,
    });
    setEditingId(item.id);
    setEditDialogOpen(true);
  }

  function handleDelete(id: number) {
    if (confirm("Tem certeza que deseja remover este destinatário?")) {
      deleteMutation.mutate({ id });
    }
  }

  function toggleCard(cardId: string) {
    setFormData(prev => ({
      ...prev,
      cardsSelecionados: prev.cardsSelecionados.includes(cardId)
        ? prev.cardsSelecionados.filter(c => c !== cardId)
        : [...prev.cardsSelecionados, cardId],
    }));
  }

  function formatPhone(phone: string) {
    // Remove tudo que não é número
    const nums = phone.replace(/\D/g, "");
    if (nums.length === 13) {
      // +55 11 99999-9999
      return `+${nums.slice(0,2)} (${nums.slice(2,4)}) ${nums.slice(4,9)}-${nums.slice(9)}`;
    }
    if (nums.length === 11) {
      return `(${nums.slice(0,2)}) ${nums.slice(2,7)}-${nums.slice(7)}`;
    }
    return phone;
  }

  function getCardsLabels(cardsSelecionadosJson: string | null) {
    try {
      const cards = cardsSelecionadosJson ? JSON.parse(cardsSelecionadosJson) : [];
      return cards.map((id: string) => CARDS_DISPONIVEIS.find(c => c.id === id)?.label || id).join(", ");
    } catch {
      return "Todos";
    }
  }

  const formFieldsJSX = (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Nome *</Label>
          <Input
            value={formData.nome}
            onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
            placeholder="Nome do destinatário"
          />
        </div>
        <div>
          <Label>Telefone (com DDI e DDD) *</Label>
          <Input
            value={formData.telefone}
            onChange={(e) => setFormData(prev => ({ ...prev, telefone: e.target.value }))}
            placeholder="5511999999999"
          />
          <p className="text-xs text-muted-foreground mt-1">Formato: 55 + DDD + número (ex: 5511999999999)</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Cargo</Label>
          <Input
            value={formData.cargo}
            onChange={(e) => setFormData(prev => ({ ...prev, cargo: e.target.value }))}
            placeholder="Ex: Diretor, Gerente"
          />
        </div>
        <div>
          <Label>Status</Label>
          <Select
            value={formData.ativo}
            onValueChange={(v) => setFormData(prev => ({ ...prev, ativo: v as "sim" | "nao" }))}
          >
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
      <div>
        <Label className="mb-2 block">Cards que este destinatário recebe:</Label>
        <div className="grid grid-cols-2 gap-2">
          {CARDS_DISPONIVEIS.map(card => (
            <div key={card.id} className="flex items-center space-x-2">
              <Checkbox
                id={`card-${card.id}`}
                checked={formData.cardsSelecionados.includes(card.id)}
                onCheckedChange={() => toggleCard(card.id)}
              />
              <label htmlFor={`card-${card.id}`} className="text-sm cursor-pointer">
                {card.label}
              </label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-green-600" />
            Destinatários WhatsApp
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Cadastre os números que receberão os relatórios do Dashboard via WhatsApp
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="bg-green-600 hover:bg-green-700">
              <Plus className="h-4 w-4 mr-2" /> Novo Destinatário
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Novo Destinatário</DialogTitle>
            </DialogHeader>
            {formFieldsJSX}
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancelar</Button>
              <Button onClick={handleSubmit} className="bg-green-600 hover:bg-green-700">Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Destinatários Cadastrados</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Carregando...</p>
          ) : !destinatarios || destinatarios.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum destinatário cadastrado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Cards</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {destinatarios.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.nome}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Phone className="h-3 w-3 text-green-600" />
                        {formatPhone(item.telefone)}
                      </div>
                    </TableCell>
                    <TableCell>{item.cargo || "-"}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${item.ativo === "sim" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {item.ativo === "sim" ? "Ativo" : "Inativo"}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      <span className="text-xs text-muted-foreground truncate block" title={getCardsLabels(item.cardsSelecionados)}>
                        {getCardsLabels(item.cardsSelecionados) || "Nenhum"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(item)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(item.id)} className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Edição */}
      <Dialog open={editDialogOpen} onOpenChange={(open) => { setEditDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Destinatário</DialogTitle>
          </DialogHeader>
          {formFieldsJSX}
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => { setEditDialogOpen(false); resetForm(); }}>Cancelar</Button>
            <Button onClick={handleEditSubmit} className="bg-green-600 hover:bg-green-700">Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
