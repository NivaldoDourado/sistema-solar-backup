/**
 * Rota REST para importação do PDF "Resumo de Vendas (Produto)" exportado do ERP.
 * Usa pdf-parse (Node.js) para extração de texto — compatível com deploy sem binários do sistema.
 * Persiste na tabela resumo_vendas_produto, substituindo dados do mesmo período.
 */
import { Router } from "express";
import multer from "multer";
import { getDb } from "./db";
import { resumoVendasProduto } from "../drizzle/schema";
import { and, gte, lte } from "drizzle-orm";
import { sdk } from "./_core/sdk";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Converte "01/04/2026" → "2026-04-01" */
function parseDateBR(s: string): string {
  const [d, m, y] = s.trim().split("/");
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

/** Converte "1.007.254,9300" → 1007254.93 */
function parseBRNumber(s: string): number {
  if (!s || s.trim() === "-" || s.trim() === "") return 0;
  const clean = s.trim().replace(/\./g, "").replace(",", ".");
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : n;
}

/** Extrai texto de um PDF usando pdf-parse (Node.js puro) */
async function pdfToText(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const parser: any = new PDFParse({ data: new Uint8Array(buffer) });
  await parser.load();
  const result = await parser.getText();
  return result.text;
}

// ─── Parser ───────────────────────────────────────────────────────────────────

interface LinhaVenda {
  produto: string;
  grupo: string;
  marca: string;
  valor: number;
  quantidade: number;
  vlMedio: number;
}

interface CabecalhoPDF {
  periodoInicio: string; // YYYY-MM-DD
  periodoFim: string;    // YYYY-MM-DD
  setor: string;
}

/**
 * Extrai cabeçalho e linhas do texto do PDF.
 *
 * Estrutura do PDF "Resumo de Vendas (Produto)":
 *   Período:  01/04/2026 a 30/04/2026
 *   ...
 *   Produto       Grupo          Marca        Valor          Quant         Vl.Médio
 *   BICA CORRIDA  1 - PRODUÇÃO   2 - GERAL    1.007.254,9300 12.519,2000   80,4568
 *   ...
 *   Total:                                    7.588.173,9000 93.271,0000   81,3562
 *
 * Com pdf-parse, o texto pode não preservar colunas perfeitamente,
 * mas os números BR no final de cada linha são consistentes.
 */
export function parseResumoVendasPDF(text: string): { cabecalho: CabecalhoPDF; linhas: LinhaVenda[] } {
  const lines = text.split("\n").map(l => l.trimEnd()).filter(l => l.trim());

  // ── Cabeçalho ──
  let periodoInicio = "";
  let periodoFim = "";
  let setor = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Caso 1: "Período: 01/05/2026 a 31/05/2026" na mesma linha
    const mPeriodo = line.match(/Per[ií]odo[:\s]+(\d{2}\/\d{2}\/\d{4})\s+a\s+(\d{2}\/\d{2}\/\d{4})/i);
    if (mPeriodo) {
      periodoInicio = parseDateBR(mPeriodo[1]);
      periodoFim = parseDateBR(mPeriodo[2]);
    }
    // Caso 2: "Período:" numa linha e "01/05/2026 a 31/05/2026" na próxima (pdf-parse v2)
    if (!periodoInicio && /Per[ií]odo\s*:?\s*$/i.test(line.trim())) {
      // Procurar nas próximas 3 linhas
      for (let j = 1; j <= 3 && i + j < lines.length; j++) {
        const nextLine = lines[i + j].trim();
        const mNext = nextLine.match(/(\d{2}\/\d{2}\/\d{4})\s+a\s+(\d{2}\/\d{2}\/\d{4})/);
        if (mNext) {
          periodoInicio = parseDateBR(mNext[1]);
          periodoFim = parseDateBR(mNext[2]);
          break;
        }
      }
    }
    // Caso 3: linha solta com formato de período (fallback)
    if (!periodoInicio) {
      const mSolta = line.trim().match(/^(\d{2}\/\d{2}\/\d{4})\s+a\s+(\d{2}\/\d{2}\/\d{4})$/);
      if (mSolta) {
        periodoInicio = parseDateBR(mSolta[1]);
        periodoFim = parseDateBR(mSolta[2]);
      }
    }
    const mSetor = line.match(/Setor[:\s]+(.+?)(?:\s{2,}|$)/i);
    if (mSetor) setor = mSetor[1].trim();
  }

  // ── Linhas de produto ──
  const linhas: LinhaVenda[] = [];

  // Linhas a ignorar
  const SKIP = /^(Produto|Grupo|Marca|Valor|Quant|Vl\.M|Total:|Emitido|P[áa]gina|Vendedor|Per[ií]odo|Setor|Cliente|Descontar|Incluir|S[eé]rie|Produto:|SOLAR PEDREIRA|Resumo|NÃO|SIM|TODOS|BALCAO|Usuario|28-|Incluir Outras)/i;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || SKIP.test(trimmed)) continue;

    // Encontrar todos os números BR na linha (formato: 1.234,5678 ou 123,45)
    const numPat = /([\d]{1,3}(?:\.\d{3})*,\d+)/g;
    const matches: RegExpExecArray[] = [];
    let mx: RegExpExecArray | null;
    while ((mx = numPat.exec(trimmed)) !== null) matches.push(mx);
    if (matches.length < 3) continue;

    // Os 3 últimos números são: valor, quantidade, vlMedio
    const vlMedio = parseBRNumber(matches[matches.length - 1][1]);
    const quantidade = parseBRNumber(matches[matches.length - 2][1]);
    const valor = parseBRNumber(matches[matches.length - 3][1]);

    if (valor === 0 && quantidade === 0) continue;

    // Remover os números do final para obter a parte textual
    let resto = trimmed;
    // Remover os 3 últimos números BR e espaços ao redor
    for (let i = 0; i < 3; i++) {
      resto = resto.replace(/\s+[\d]{1,3}(?:\.\d{3})*,\d+\s*$/, "").trimEnd();
    }

    // Separar produto, grupo e marca
    // Grupos/marcas têm padrão "N - TEXTO" ou "N - TEXTO/TEXTO"
    // Dividir por 2+ espaços
    const partes = resto.split(/\s{2,}/).map(p => p.trim()).filter(Boolean);

    let produto = "";
    let grupo = "";
    let marca = "";

    if (partes.length >= 3) {
      produto = partes[0];
      grupo = partes[1];
      marca = partes[2];
    } else if (partes.length === 2) {
      produto = partes[0];
      grupo = partes[1];
    } else {
      // Tentar separar por padrão "N - "
      const mGM = resto.match(/^(.+?)\s{1,}(\d+\s*-\s*[^\d]+?)\s{1,}(\d+\s*-\s*[^\d]+?)\s*$/);
      if (mGM) {
        produto = mGM[1].trim();
        grupo = mGM[2].trim();
        marca = mGM[3].trim();
      } else {
        const mG = resto.match(/^(.+?)\s{1,}(\d+\s*-\s*.+?)\s*$/);
        if (mG) {
          produto = mG[1].trim();
          grupo = mG[2].trim();
        } else {
          produto = resto.trim();
        }
      }
    }

    if (!produto) continue;

    linhas.push({ produto, grupo, marca, valor, quantidade, vlMedio });
  }

  return { cabecalho: { periodoInicio, periodoFim, setor }, linhas };
}

// ─── Rota Express ─────────────────────────────────────────────────────────────

export function registerImportacaoVendasRoute(app: any) {
  const router = Router();

  router.post("/api/importacao-vendas", upload.single("file"), async (req: any, res: any) => {
    try {
      // Autenticação
      let currentUser: any = null;
      try {
        currentUser = await sdk.authenticateRequest(req as any);
      } catch (_e) {
        return res.status(401).json({ error: "Não autenticado" });
      }
      if (!currentUser?.id) return res.status(401).json({ error: "Não autenticado" });

      if (!req.file) return res.status(400).json({ error: "Nenhum arquivo enviado" });

      const db = await getDb();
      if (!db) return res.status(500).json({ error: "Banco de dados indisponível" });

      // Extrair texto do PDF via pdf-parse
      let pdfText = "";
      try {
        pdfText = await pdfToText(req.file.buffer);
      } catch (e: any) {
        return res.status(400).json({ error: `Erro ao ler PDF: ${e.message}` });
      }

      // Parsear
      const { cabecalho, linhas } = parseResumoVendasPDF(pdfText);

      if (!cabecalho.periodoInicio || !cabecalho.periodoFim) {
        return res.status(400).json({
          error: "Não foi possível identificar o período no PDF. Verifique se o arquivo é o 'Resumo de Vendas (Produto)' correto.",
          textoParcial: pdfText.slice(0, 500),
        });
      }

      if (linhas.length === 0) {
        return res.status(400).json({
          error: "Nenhum produto encontrado no PDF. Verifique o formato do arquivo.",
          textoParcial: pdfText.slice(0, 1000),
        });
      }

      const dtInicio = new Date(cabecalho.periodoInicio + "T12:00:00Z");
      const dtFim = new Date(cabecalho.periodoFim + "T12:00:00Z");

      // Deletar registros existentes do mesmo período
      await db.delete(resumoVendasProduto).where(
        and(
          gte(resumoVendasProduto.periodoInicio, dtInicio),
          lte(resumoVendasProduto.periodoFim, dtFim)
        )
      );

      // Inserir novos registros
      const registros = linhas.map(l => ({
        periodoInicio: dtInicio,
        periodoFim: dtFim,
        produto: l.produto,
        grupo: l.grupo || null,
        marca: l.marca || null,
        valor: String(l.valor),
        quantidade: String(l.quantidade),
        vlMedio: String(l.vlMedio),
        setor: cabecalho.setor || null,
        userId: currentUser.id,
      }));

      await db.insert(resumoVendasProduto).values(registros);

      return res.json({
        success: true,
        periodo: `${cabecalho.periodoInicio} a ${cabecalho.periodoFim}`,
        setor: cabecalho.setor,
        totalProdutos: linhas.length,
        totalValor: linhas.reduce((s, l) => s + l.valor, 0),
        totalQuantidade: linhas.reduce((s, l) => s + l.quantidade, 0),
      });
    } catch (err: any) {
      console.error("[importacaoVendas] Erro:", err);
      return res.status(500).json({ error: err.message ?? "Erro interno" });
    }
  });

  app.use(router);
}
