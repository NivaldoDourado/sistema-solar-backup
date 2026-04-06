import { Download, FileSpreadsheet, FileText, MessageCircle } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { exportToExcel, exportToPDF, type ExportOptions } from "@/lib/export-utils";

export interface DashboardExportMenuProps {
  /** Título do card — usado como título do relatório */
  title: string;
  /** Subtítulo opcional (ex: período selecionado) */
  subtitle?: string;
  /** Nome do arquivo sem extensão */
  filename: string;
  /** Dados para exportação em Excel/PDF */
  exportOptions: Omit<ExportOptions, "title" | "subtitle" | "filename">;
  /** Mensagem formatada para WhatsApp (texto puro) */
  whatsappMessage?: string;
  /** Destinatários do WhatsApp (telefones com DDI) */
  whatsappDestinatarios?: string[];
  /** Classe CSS adicional */
  className?: string;
  /** Variante visual: 'default' para web, 'mobile' para mobile (botão branco/transparente) */
  variant?: "default" | "mobile";
}

export function DashboardExportMenu({
  title,
  subtitle,
  filename,
  exportOptions,
  whatsappMessage,
  whatsappDestinatarios,
  className = "",
  variant = "default",
}: DashboardExportMenuProps) {
  const handleExcel = () => {
    exportToExcel({ title, subtitle, filename, ...exportOptions });
  };

  const handlePDF = () => {
    exportToPDF({ title, subtitle, filename, ...exportOptions });
  };

  const handleWhatsApp = () => {
    if (!whatsappMessage || !whatsappDestinatarios?.length) return;
    const encoded = encodeURIComponent(whatsappMessage);
    whatsappDestinatarios.forEach((tel, idx) => {
      const numero = tel.replace(/\D/g, "");
      setTimeout(() => {
        window.open(`https://wa.me/${numero}?text=${encoded}`, "_blank");
      }, idx * 800);
    });
  };

  const hasWhatsApp = !!(whatsappMessage && whatsappDestinatarios?.length);

  const trigger =
    variant === "mobile" ? (
      <button
        className={`flex items-center justify-center w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 transition-colors ${className}`}
        title="Exportar dados"
      >
        <Download className="w-3.5 h-3.5 text-white" />
      </button>
    ) : (
      <Button
        variant="ghost"
        size="sm"
        className={`h-7 gap-1 text-xs text-muted-foreground hover:text-foreground px-2 ${className}`}
        title="Exportar dados deste card"
      >
        <Download className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Exportar</span>
      </Button>
    );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
          Exportar como
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleExcel} className="gap-2 cursor-pointer">
          <FileSpreadsheet className="h-4 w-4 text-green-600" />
          Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handlePDF} className="gap-2 cursor-pointer">
          <FileText className="h-4 w-4 text-red-600" />
          PDF
        </DropdownMenuItem>
        {hasWhatsApp && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleWhatsApp} className="gap-2 cursor-pointer">
              <MessageCircle className="h-4 w-4 text-green-500" />
              WhatsApp
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
