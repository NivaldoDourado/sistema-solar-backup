import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface ExportColumn {
  header: string;
  key: string;
  width?: number;
  format?: (value: any) => string;
}

export interface ExportOptions {
  title: string;
  subtitle?: string;
  columns: ExportColumn[];
  data: Record<string, any>[];
  filename: string;
}

const LOGO_CDN_URL =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663227720411/Us3Q3oBA5LqqATDWwyHq5k/LogoDouradoGestao_005e6bc5.png";

const SYSTEM_NAME_LINE1 = "GEM - Gestão Estratégica em Mineração";
const SYSTEM_NAME_LINE2 = "SOLAR PEDREIRA";

function formatValue(value: any, col: ExportColumn): string {
  if (value === null || value === undefined) return "";
  if (col.format) return col.format(value);
  return String(value);
}

function formatDateBR(dateStr: string): string {
  if (!dateStr) return "";
  const s = String(dateStr);
  // Handle ISO format
  const d = s.includes("T") ? s.split("T")[0] : s;
  const parts = d.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return s;
}

export function exportToExcel(options: ExportOptions) {
  const { title, subtitle, columns, data, filename } = options;

  // Create header rows
  const headerRow = columns.map((col) => col.header);

  // Create data rows
  const dataRows = data.map((row) =>
    columns.map((col) => {
      const raw = row[col.key];
      if (col.format) return col.format(raw);
      return raw ?? "";
    })
  );

  // Build worksheet data
  const wsData: any[][] = [];
  wsData.push([SYSTEM_NAME_LINE1]);
  wsData.push([SYSTEM_NAME_LINE2]);
  wsData.push([title]);
  if (subtitle) wsData.push([subtitle]);
  wsData.push([]); // empty row
  wsData.push(headerRow);
  wsData.push(...dataRows);

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths
  ws["!cols"] = columns.map((col) => ({ wch: col.width || 18 }));

  // Merge header rows across all columns
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: columns.length - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: columns.length - 1 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: columns.length - 1 } },
  ];
  if (subtitle) {
    ws["!merges"].push({
      s: { r: 3, c: 0 },
      e: { r: 3, c: columns.length - 1 },
    });
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Relatório");

  const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([excelBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  saveAs(blob, `${filename}.xlsx`);
}

/**
 * Load an image from URL as base64 for use in jsPDF.
 * Returns null if loading fails.
 */
async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function exportToPDF(options: ExportOptions) {
  const { title, subtitle, columns, data, filename } = options;

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  const pageWidth = doc.internal.pageSize.getWidth();

  // Load logo
  const logoBase64 = await loadImageAsBase64(LOGO_CDN_URL);

  // ── Logo (top-right) ─────────────────────────────────────────────────────
  // Original logo is roughly square (428×470 px). We render at ~28mm wide.
  const logoW = 28;
  const logoH = 30; // keep aspect ratio close to original
  const logoX = pageWidth - logoW - 10;
  const logoY = 6;
  if (logoBase64) {
    doc.addImage(logoBase64, "PNG", logoX, logoY, logoW, logoH);
  }

  // ── System name (top-left, green area) ───────────────────────────────────
  let curY = 12;

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 80, 160); // blue
  doc.text(SYSTEM_NAME_LINE1, 14, curY);
  curY += 6;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);
  doc.text(SYSTEM_NAME_LINE2, 14, curY);
  curY += 7;

  // ── Report title ─────────────────────────────────────────────────────────
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text(title, 14, curY);
  curY += 6;

  // ── Subtitle ─────────────────────────────────────────────────────────────
  if (subtitle) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(subtitle, 14, curY);
    curY += 6;
  }

  // ── Generation timestamp ─────────────────────────────────────────────────
  doc.setFontSize(8);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(100, 100, 100);
  const now = new Date();
  doc.text(
    `Gerado em: ${now.toLocaleDateString("pt-BR")} às ${now.toLocaleTimeString("pt-BR")}`,
    14,
    curY
  );
  curY += 6;

  // ── Table ─────────────────────────────────────────────────────────────────
  const headers = columns.map((col) => col.header);
  const body = data.map((row) =>
    columns.map((col) => formatValue(row[col.key], col))
  );

  autoTable(doc, {
    head: [headers],
    body: body,
    startY: curY,
    styles: {
      fontSize: 8,
      cellPadding: 2,
    },
    headStyles: {
      fillColor: [41, 128, 185],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 8,
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
    margin: { left: 14, right: 14 },
    didDrawPage: (data: any) => {
      // Footer with page number
      const pageCount = doc.getNumberOfPages();
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      doc.text(
        `Página ${data.pageNumber} de ${pageCount}`,
        doc.internal.pageSize.getWidth() - 30,
        doc.internal.pageSize.getHeight() - 10
      );
    },
  });

  doc.save(`${filename}.pdf`);
}

// Helper formatters
export const formatters = {
  date: (value: any) => formatDateBR(String(value || "")),
  decimal: (value: any) =>
    value
      ? parseFloat(value).toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : "0,00",
  currency: (value: any) =>
    value
      ? `R$ ${parseFloat(value).toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`
      : "R$ 0,00",
  integer: (value: any) => (value ? parseInt(value).toString() : "0"),
  boolean: (value: any) => (value === "sim" || value === true ? "Sim" : "Não"),
};
