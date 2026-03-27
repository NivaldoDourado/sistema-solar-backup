import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import {
  exportToExcel,
  exportToPDF,
  type ExportOptions,
} from "@/lib/export-utils";
import { toast } from "sonner";

interface ExportButtonsProps {
  options: ExportOptions;
  disabled?: boolean;
}

export function ExportButtons({ options, disabled }: ExportButtonsProps) {
  const handleExport = (format: "excel" | "pdf") => {
    try {
      if (options.data.length === 0) {
        toast.error("Não há dados para exportar.");
        return;
      }

      if (format === "excel") {
        exportToExcel(options);
      } else {
        exportToPDF(options);
      }

      toast.success(
        `Relatório exportado em ${format === "excel" ? "Excel" : "PDF"} com sucesso.`
      );
    } catch (error) {
      toast.error("Ocorreu um erro ao exportar o relatório.");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          <Download className="h-4 w-4 mr-2" />
          Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport("excel")}>
          <FileSpreadsheet className="h-4 w-4 mr-2 text-green-600" />
          Exportar Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("pdf")}>
          <FileText className="h-4 w-4 mr-2 text-red-600" />
          Exportar PDF (.pdf)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
