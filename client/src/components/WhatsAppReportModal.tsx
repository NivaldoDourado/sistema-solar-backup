/**
 * WhatsAppReportModal.tsx
 * Modal profissional para envio de relatório consolidado via WhatsApp.
 * Permite selecionar destinatários por cargo e escolher quais cards incluir.
 */
import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  MessageSquare,
  Send,
  Users,
  LayoutDashboard,
  ChevronDown,
  ChevronUp,
  CheckSquare,
  Square,
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface Destinatario {
  id: number;
  nome: string;
  telefone: string;
  cargo: string;
  ativo: "sim" | "nao";
  cardsSelecionados?: string; // JSON string
}

export interface CardDisponivel {
  id: string;
  label: string;
  mensagem?: string; // mensagem pré-formatada para este card
  temDados?: boolean; // se há dados disponíveis
}

interface WhatsAppReportModalProps {
  open: boolean;
  onClose: () => void;
  destinatarios: Destinatario[];
  cards: CardDisponivel[];
  periodoLabel: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseCardsDestinatario(cardsSelecionados: string | undefined, allCards: CardDisponivel[]): string[] {
  if (!cardsSelecionados) return allCards.map(c => c.id);
  try {
    const parsed = JSON.parse(cardsSelecionados);
    return Array.isArray(parsed) ? parsed : allCards.map(c => c.id);
  } catch {
    return allCards.map(c => c.id);
  }
}

function getCargoBadgeColor(cargo: string): string {
  const c = cargo.toLowerCase();
  if (c.includes("diretor")) return "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300";
  if (c.includes("financ")) return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300";
  if (c.includes("gerente")) return "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300";
  if (c.includes("s\u00f3cio") || c.includes("socio")) return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";
  return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function WhatsAppReportModal({
  open,
  onClose,
  destinatarios,
  cards,
  periodoLabel,
}: WhatsAppReportModalProps) {
  const ativos = useMemo(() => destinatarios.filter(d => d.ativo === "sim"), [destinatarios]);

  // Destinatários selecionados (todos por padrão)
  const [selectedDests, setSelectedDests] = useState<Set<number>>(() => new Set(ativos.map(d => d.id)));

  // Cards selecionados globalmente (todos com dados por padrão)
  const [selectedCards, setSelectedCards] = useState<Set<string>>(
    () => new Set(cards.filter(c => c.temDados !== false).map(c => c.id))
  );

  // UI state
  const [showPreview, setShowPreview] = useState(false);
  const [showDestinatarios, setShowDestinatarios] = useState(true);
  const [showCards, setShowCards] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [enviados, setEnviados] = useState<Set<number>>(new Set());

  // Agrupar destinatários por cargo
  const cargoGroups = useMemo(() => {
    const groups: Record<string, Destinatario[]> = {};
    ativos.forEach(d => {
      const cargo = d.cargo || "Outros";
      if (!groups[cargo]) groups[cargo] = [];
      groups[cargo].push(d);
    });
    return groups;
  }, [ativos]);

  // Montar mensagem consolidada para um destinatário específico
  function buildMessage(dest: Destinatario): string {
    const destCards = parseCardsDestinatario(dest.cardsSelecionados, cards);
    // Intersecção: cards que o destinatário quer E que o usuário selecionou E que têm dados
    const cardsParaEnviar = cards.filter(
      c => destCards.includes(c.id) && selectedCards.has(c.id) && c.mensagem
    );

    let msg = `⚙️ *RELATÓRIO - PEDREIRA SOLAR*\n`;
    msg += `📅 ${periodoLabel}\n\n`;

    cardsParaEnviar.forEach(c => {
      msg += c.mensagem + "\n";
    });

    msg += `_Enviado pelo GEM - Sistema de Gestão Estratégica em Mineração_`;
    return msg;
  }

  // Preview: mensagem do primeiro destinatário selecionado
  const previewMessage = useMemo(() => {
    const firstDest = ativos.find(d => selectedDests.has(d.id));
    if (!firstDest) return "Nenhum destinatário selecionado.";
    return buildMessage(firstDest);
  }, [ativos, selectedDests, selectedCards, cards, periodoLabel]);

  function toggleDest(id: number) {
    setSelectedDests(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleCard(id: string) {
    setSelectedCards(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllDests() {
    setSelectedDests(new Set(ativos.map(d => d.id)));
  }

  function clearAllDests() {
    setSelectedDests(new Set());
  }

  function selectAllCards() {
    setSelectedCards(new Set(cards.filter(c => c.temDados !== false).map(c => c.id)));
  }

  function clearAllCards() {
    setSelectedCards(new Set());
  }

  function handleEnviar() {
    const destsParaEnviar = ativos.filter(d => selectedDests.has(d.id));
    if (destsParaEnviar.length === 0) {
      toast.error("Selecione pelo menos um destinatário");
      return;
    }
    if (selectedCards.size === 0) {
      toast.error("Selecione pelo menos um card para incluir no relatório");
      return;
    }

    setEnviando(true);
    const newEnviados = new Set<number>();

    destsParaEnviar.forEach((dest, idx) => {
      setTimeout(() => {
        const msg = buildMessage(dest);
        const telefone = dest.telefone.replace(/\D/g, "");
        const url = `https://wa.me/${telefone}?text=${encodeURIComponent(msg)}`;
        window.open(url, "_blank");
        newEnviados.add(dest.id);
        setEnviados(new Set(newEnviados));

        if (idx === destsParaEnviar.length - 1) {
          setEnviando(false);
          toast.success(`Relatório enviado para ${destsParaEnviar.length} destinatário(s)!`);
        }
      }, idx * 1200);
    });
  }

  const selectedDestsCount = selectedDests.size;
  const selectedCardsCount = selectedCards.size;
  const cardsComDados = cards.filter(c => c.temDados !== false).length;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col gap-0 p-0">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <DialogTitle className="text-lg">Enviar Relatório via WhatsApp</DialogTitle>
              <DialogDescription className="text-sm mt-0.5">
                Selecione os destinatários e os cards a incluir no relatório
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="px-6 py-4 space-y-5">

            {/* ── Seção Destinatários ── */}
            <div className="border rounded-xl overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-4 py-3 bg-muted/40 hover:bg-muted/60 transition-colors"
                onClick={() => setShowDestinatarios(v => !v)}
              >
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <span className="font-semibold text-sm">Destinatários</span>
                  <Badge variant="secondary" className="text-xs">
                    {selectedDestsCount} / {ativos.length} selecionados
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="text-xs text-primary hover:underline"
                    onClick={e => { e.stopPropagation(); selectAllDests(); }}
                  >
                    Todos
                  </button>
                  <span className="text-muted-foreground text-xs">|</span>
                  <button
                    className="text-xs text-muted-foreground hover:underline"
                    onClick={e => { e.stopPropagation(); clearAllDests(); }}
                  >
                    Nenhum
                  </button>
                  {showDestinatarios ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </div>
              </button>

              {showDestinatarios && (
                <div className="divide-y">
                  {Object.entries(cargoGroups).map(([cargo, dests]) => (
                    <div key={cargo} className="px-4 py-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${getCargoBadgeColor(cargo)}`}>
                          {cargo}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {dests.filter(d => selectedDests.has(d.id)).length}/{dests.length}
                        </span>
                      </div>
                      <div className="space-y-2 pl-1">
                        {dests.map(dest => (
                          <div key={dest.id} className="flex items-center gap-3">
                            <Checkbox
                              id={`dest-${dest.id}`}
                              checked={selectedDests.has(dest.id)}
                              onCheckedChange={() => toggleDest(dest.id)}
                            />
                            <label
                              htmlFor={`dest-${dest.id}`}
                              className="flex-1 flex items-center justify-between cursor-pointer"
                            >
                              <span className="text-sm font-medium">{dest.nome}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground font-mono">
                                  {dest.telefone}
                                </span>
                                {enviados.has(dest.id) && (
                                  <Badge className="bg-green-500/10 text-green-600 text-xs border-0">
                                    ✓ Enviado
                                  </Badge>
                                )}
                              </div>
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  {ativos.length === 0 && (
                    <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                      Nenhum destinatário ativo cadastrado.{" "}
                      <a href="/destinatarios-whatsapp" className="text-primary hover:underline">
                        Cadastrar destinatários
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Seção Cards ── */}
            <div className="border rounded-xl overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-4 py-3 bg-muted/40 hover:bg-muted/60 transition-colors"
                onClick={() => setShowCards(v => !v)}
              >
                <div className="flex items-center gap-2">
                  <LayoutDashboard className="w-4 h-4 text-muted-foreground" />
                  <span className="font-semibold text-sm">Cards do Relatório</span>
                  <Badge variant="secondary" className="text-xs">
                    {selectedCardsCount} / {cardsComDados} com dados
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="text-xs text-primary hover:underline"
                    onClick={e => { e.stopPropagation(); selectAllCards(); }}
                  >
                    Todos
                  </button>
                  <span className="text-muted-foreground text-xs">|</span>
                  <button
                    className="text-xs text-muted-foreground hover:underline"
                    onClick={e => { e.stopPropagation(); clearAllCards(); }}
                  >
                    Nenhum
                  </button>
                  {showCards ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </div>
              </button>

              {showCards && (
                <div className="px-4 py-3 grid grid-cols-2 gap-2">
                  {cards.map(card => {
                    const temDados = card.temDados !== false;
                    return (
                      <div
                        key={card.id}
                        className={`flex items-center gap-2 p-2 rounded-lg transition-colors ${
                          temDados ? "hover:bg-muted/50 cursor-pointer" : "opacity-40 cursor-not-allowed"
                        }`}
                        onClick={() => temDados && toggleCard(card.id)}
                      >
                        <Checkbox
                          id={`card-${card.id}`}
                          checked={selectedCards.has(card.id)}
                          disabled={!temDados}
                          onCheckedChange={() => temDados && toggleCard(card.id)}
                        />
                        <label
                          htmlFor={`card-${card.id}`}
                          className={`text-xs leading-tight ${temDados ? "cursor-pointer" : "cursor-not-allowed"}`}
                        >
                          {card.label}
                          {!temDados && (
                            <span className="ml-1 text-muted-foreground">(sem dados)</span>
                          )}
                        </label>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Preview da Mensagem ── */}
            <div className="border rounded-xl overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-4 py-3 bg-muted/40 hover:bg-muted/60 transition-colors"
                onClick={() => setShowPreview(v => !v)}
              >
                <div className="flex items-center gap-2">
                  {showPreview ? <EyeOff className="w-4 h-4 text-muted-foreground" /> : <Eye className="w-4 h-4 text-muted-foreground" />}
                  <span className="font-semibold text-sm">
                    {showPreview ? "Ocultar" : "Visualizar"} mensagem de exemplo
                  </span>
                </div>
                {showPreview ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </button>
              {showPreview && (
                <div className="px-4 py-3">
                  <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-2 font-medium">
                      Exemplo para: {ativos.find(d => selectedDests.has(d.id))?.nome || "—"}
                    </p>
                    <pre className="text-xs whitespace-pre-wrap font-mono text-foreground/80 leading-relaxed max-h-48 overflow-y-auto">
                      {previewMessage}
                    </pre>
                  </div>
                </div>
              )}
            </div>

          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-muted/20 flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {selectedDestsCount > 0
              ? `Será aberta uma janela do WhatsApp para cada destinatário selecionado.`
              : "Selecione pelo menos um destinatário."}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white gap-2"
              disabled={enviando || selectedDestsCount === 0 || selectedCardsCount === 0}
              onClick={handleEnviar}
            >
              <Send className="w-4 h-4" />
              {enviando
                ? "Enviando..."
                : `Enviar para ${selectedDestsCount} destinatário${selectedDestsCount !== 1 ? "s" : ""}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
