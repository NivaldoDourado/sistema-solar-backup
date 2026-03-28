/**
 * MetasAlertas.tsx
 * Configuração de metas e alertas push para o Dashboard Mobile - PEDREIRA SOLAR
 * Acessível pelo menu de Configurações do sistema (perfil admin/consultoria)
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Bell, Plus, Pencil, Trash2, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";

// Indicadores disponíveis para configurar metas
const INDICADORES = [
  { value: "combustivel_litros", label: "Combustível (Litros)" },
  { value: "custo_total", label: "Custos Totais (R$)" },
  { value: "producao_m3", label: "Produção (m³)" },
  { value: "manutencoes_abertas", label: "Manutenções Registradas" },
  { value: "custo_combustivel", label: "Custo de Combustível (R$)" },
];

interface MetaForm {
  id?: number;
  indicador: string;
  descricao: string;
  valorMeta: string;
  valorLimiteAlerta: string;
  tipoAlerta: "acima" | "abaixo";
  ativo: "sim" | "nao";
}

const FORM_VAZIO: MetaForm = {
  indicador: "",
  descricao: "",
  valorMeta: "",
  valorLimiteAlerta: "",
  tipoAlerta: "acima",
  ativo: "sim",
};

export default function MetasAlertas() {
  const [modalAberto, setModalAberto] = useState(false);
  const [form, setForm] = useState<MetaForm>(FORM_VAZIO);
  const [editando, setEditando] = useState(false);

  const utils = trpc.useUtils();
  const metasList = trpc.metas.list.useQuery();
  const upsertMeta = trpc.metas.upsert.useMutation({
    onSuccess: () => {
      utils.metas.list.invalidate();
      setModalAberto(false);
      setForm(FORM_VAZIO);
      toast.success(editando ? "Meta atualizada!" : "Meta criada com sucesso!");
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });
  const deleteMeta = trpc.metas.delete.useMutation({
    onSuccess: () => {
      utils.metas.list.invalidate();
      toast.success("Meta removida.");
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  function abrirNova() {
    setForm(FORM_VAZIO);
    setEditando(false);
    setModalAberto(true);
  }

  function abrirEditar(meta: any) {
    setForm({
      id: meta.id,
      indicador: meta.indicador,
      descricao: meta.descricao ?? "",
      valorMeta: meta.valorMeta ?? "",
      valorLimiteAlerta: meta.valorLimiteAlerta ?? "",
      tipoAlerta: meta.tipoAlerta ?? "acima",
      ativo: meta.ativo ?? "sim",
    });
    setEditando(true);
    setModalAberto(true);
  }

  function salvar() {
    if (!form.indicador) {
      toast.error("Selecione um indicador.");
      return;
    }
    if (!form.valorLimiteAlerta) {
      toast.error("Informe o valor limite para o alerta.");
      return;
    }
    upsertMeta.mutate(form);
  }

  function getLabelIndicador(value: string) {
    return INDICADORES.find((i) => i.value === value)?.label ?? value;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Bell className="w-6 h-6 text-amber-500" />
            Metas e Alertas Mobile
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Configure os limites dos indicadores para receber alertas push no celular.
          </p>
        </div>
        <Button onClick={abrirNova} className="gap-2">
          <Plus className="w-4 h-4" />
          Nova Meta
        </Button>
      </div>

      {/* Aviso informativo */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-amber-800">
          <p className="font-semibold mb-1">Como funcionam os alertas</p>
          <p>
            Quando o Dashboard mobile é aberto, os valores atuais dos indicadores são verificados
            automaticamente. Se algum valor ultrapassar o limite configurado, uma notificação push
            é enviada para todos os dispositivos com notificações ativas.
          </p>
        </div>
      </div>

      {/* Tabela de metas */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Indicador</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Meta</TableHead>
              <TableHead>Limite Alerta</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {metasList.isLoading && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Carregando...
                </TableCell>
              </TableRow>
            )}
            {!metasList.isLoading && (!metasList.data || metasList.data.length === 0) && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Nenhuma meta configurada. Clique em "Nova Meta" para começar.
                </TableCell>
              </TableRow>
            )}
            {metasList.data?.map((meta) => (
              <TableRow key={meta.id}>
                <TableCell className="font-medium text-sm">
                  {getLabelIndicador(meta.indicador)}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {meta.descricao ?? "-"}
                </TableCell>
                <TableCell className="text-sm">
                  {meta.valorMeta
                    ? Number(meta.valorMeta).toLocaleString("pt-BR", { maximumFractionDigits: 2 })
                    : "-"}
                </TableCell>
                <TableCell className="text-sm font-semibold">
                  {meta.valorLimiteAlerta
                    ? Number(meta.valorLimiteAlerta).toLocaleString("pt-BR", { maximumFractionDigits: 2 })
                    : "-"}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {meta.tipoAlerta === "acima" ? (
                      <TrendingUp className="w-3.5 h-3.5 text-red-500" />
                    ) : (
                      <TrendingDown className="w-3.5 h-3.5 text-blue-500" />
                    )}
                    <span className="text-xs">
                      {meta.tipoAlerta === "acima" ? "Acima do limite" : "Abaixo do limite"}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={meta.ativo === "sim" ? "default" : "secondary"}>
                    {meta.ativo === "sim" ? "Ativo" : "Inativo"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => abrirEditar(meta)}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => {
                        if (confirm("Remover esta meta?")) {
                          deleteMeta.mutate({ id: meta.id });
                        }
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Modal de criação/edição */}
      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar Meta" : "Nova Meta de Alerta"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Indicador *</Label>
              <Select
                value={form.indicador}
                onValueChange={(v) => setForm((f) => ({ ...f, indicador: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o indicador..." />
                </SelectTrigger>
                <SelectContent>
                  {INDICADORES.map((ind) => (
                    <SelectItem key={ind.value} value={ind.value}>
                      {ind.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Descrição (exibida na notificação)</Label>
              <Input
                placeholder="Ex: Consumo de Diesel mensal"
                value={form.descricao}
                onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Meta (referência)</Label>
                <Input
                  type="number"
                  placeholder="Ex: 50000"
                  value={form.valorMeta}
                  onChange={(e) => setForm((f) => ({ ...f, valorMeta: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Limite para Alerta *</Label>
                <Input
                  type="number"
                  placeholder="Ex: 60000"
                  value={form.valorLimiteAlerta}
                  onChange={(e) => setForm((f) => ({ ...f, valorLimiteAlerta: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Disparar alerta quando o valor estiver</Label>
              <Select
                value={form.tipoAlerta}
                onValueChange={(v: "acima" | "abaixo") =>
                  setForm((f) => ({ ...f, tipoAlerta: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="acima">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-red-500" />
                      Acima do limite
                    </div>
                  </SelectItem>
                  <SelectItem value="abaixo">
                    <div className="flex items-center gap-2">
                      <TrendingDown className="w-4 h-4 text-blue-500" />
                      Abaixo do limite
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={form.ativo}
                onValueChange={(v: "sim" | "nao") => setForm((f) => ({ ...f, ativo: v }))}
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

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalAberto(false)}>
              Cancelar
            </Button>
            <Button onClick={salvar} disabled={upsertMeta.isPending}>
              {upsertMeta.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
