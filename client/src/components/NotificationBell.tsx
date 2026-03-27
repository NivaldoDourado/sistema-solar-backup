import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Bell, Check, CheckCheck, Wrench, AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";

export function NotificationBell() {
  const [open, setOpen] = useState(false);

  const { data: naoLidas, refetch: refetchNaoLidas } = trpc.notificacoes.naoLidas.useQuery(undefined, {
    refetchInterval: 60000, // Verificar a cada 60 segundos
  });

  const { data: todasNotificacoes, refetch: refetchTodas } = trpc.notificacoes.list.useQuery(undefined, {
    enabled: open,
  });

  const verificarRevisoes = trpc.notificacoes.verificarRevisoes.useMutation({
    onSuccess: (data) => {
      if (data.novasNotificacoes > 0) {
        toast.info(`${data.novasNotificacoes} nova(s) notificação(ões) de revisão preventiva`);
      }
      refetchNaoLidas();
      refetchTodas();
    },
  });

  const marcarLida = trpc.notificacoes.marcarLida.useMutation({
    onSuccess: () => {
      refetchNaoLidas();
      refetchTodas();
    },
  });

  const marcarTodasLidas = trpc.notificacoes.marcarTodasLidas.useMutation({
    onSuccess: () => {
      refetchNaoLidas();
      refetchTodas();
      toast.success("Todas as notificações foram marcadas como lidas");
    },
  });

  // Verificar revisões ao montar o componente
  useEffect(() => {
    verificarRevisoes.mutate();
    // Verificar a cada 5 minutos
    const interval = setInterval(() => {
      verificarRevisoes.mutate();
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const count = naoLidas?.count || 0;
  const notificacoesList = open ? (todasNotificacoes || []) : [];

  const getIconForTipo = (tipo: string) => {
    switch (tipo) {
      case "revisao_preventiva":
        return <Wrench className="h-4 w-4 text-orange-500" />;
      case "manutencao_vencida":
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default:
        return <Bell className="h-4 w-4 text-blue-500" />;
    }
  };

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9"
        >
          <Bell className="h-5 w-5" />
          {count > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-bold animate-pulse">
              {count > 9 ? "9+" : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-sm">Notificações</h3>
          <div className="flex items-center gap-1">
            {count > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => marcarTodasLidas.mutate()}
              >
                <CheckCheck className="h-3.5 w-3.5 mr-1" />
                Marcar todas como lidas
              </Button>
            )}
          </div>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {notificacoesList.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhuma notificação</p>
            </div>
          ) : (
            notificacoesList.map((notif) => (
              <div
                key={notif.id}
                className={`flex items-start gap-3 p-3 border-b last:border-b-0 transition-colors ${
                  notif.lida === "nao"
                    ? "bg-blue-50/50 dark:bg-blue-950/20"
                    : "opacity-60"
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  {getIconForTipo(notif.tipo)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${notif.lida === "nao" ? "font-semibold" : "font-normal"}`}>
                    {notif.titulo}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {notif.mensagem}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDate(notif.createdAt)}
                  </p>
                </div>
                {notif.lida === "nao" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={() => marcarLida.mutate({ id: notif.id })}
                    title="Marcar como lida"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))
          )}
        </div>

        {count > 0 && (
          <div className="p-2 border-t bg-orange-50 dark:bg-orange-950/20">
            <p className="text-xs text-orange-700 dark:text-orange-300 text-center font-medium">
              ⚠ {count} equipamento(s) com revisão preventiva vencida
            </p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
