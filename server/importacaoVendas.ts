/**
 * Rota REST para importação do PDF "Resumo de Vendas (Produto)" exportado do ERP.
 * Extrai os dados de produto, grupo, marca, valor, quantidade e valor médio.
 * Persiste na tabela resumo_vendas_produto, substituindo dados do mesmo período.
 */
import { Router } from "express";
import multer from "multer";
import * as pdfParseModule from "pdf-parse";
const pdfParse = (pdfParseModule as any).default ?? pdfParseModule;
import { getDb } from "./db";
import { resumoVendasProduto } from "../drizzle/schema";
import { and, gte, lte } from "drizzle-orm";
import { sdk } from "./_core/sdk";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// ─── Parser do texto extraído do PDF ─────────────────────────────────────────

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
 * Converte "01/04/2026" → "2026-04-01"
 */
function parseDateBR(s: string): string {
  const [d, m, y] = s.trim().split("/");
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

/**
 * Converte número no formato brasileiro "1.007.254,9300" → 1007254.93
 */
function parseBRNumber(s: string): number {
  if (!s || s.trim() === "-" || s.trim() === "") return 0;
  // Remove pontos de milhar, troca vírgula por ponto
  const clean = s.trim().replace(/\./g, "").replace(",", ".");
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : n;
}

/**
 * Extrai cabeçalho e linhas do texto do PDF.
 *
 * Estrutura esperada do texto:
 *   Período:  01/04/2026 a 30/04/2026
 *   Setor:    BALCAO/ATACADO
 *   ...
 *   Produto   Grupo   Marca   Valor   Quant   Vl.Médio
 *   BICA CORRIDA  1 - PRODUÇÃO  2 - GERAL  1.007.254,9300  12.519,2000  80,4568
 *   ...
 *   Total:    7.588.173,9000  93.271,0000  81,3562
 */
export function parseResumoVendasPDF(text: string): { cabecalho: CabecalhoPDF; linhas: LinhaVenda[] } {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

  // ── Extrair cabeçalho ──
  let periodoInicio = "";
  let periodoFim = "";
  let setor = "";

  for (const line of lines) {
    // "Período:  01/04/2026 a 30/04/2026"
    const mPeriodo = line.match(/Per[ií]odo[:\s]+(\d{2}\/\d{2}\/\d{4})\s+a\s+(\d{2}\/\d{2}\/\d{4})/i);
    if (mPeriodo) {
      periodoInicio = parseDateBR(mPeriodo[1]);
      periodoFim = parseDateBR(mPeriodo[2]);
    }
    // "Setor:  BALCAO/ATACADO"
    const mSetor = line.match(/^Setor[:\s]+(.+)$/i);
    if (mSetor) {
      setor = mSetor[1].trim();
    }
  }

  // ── Extrair linhas de produtos ──
  // Padrão: produto pode ter espaços, depois grupo "N - TEXTO", marca "N - TEXTO",
  // depois 3 números no formato BR
  const linhas: LinhaVenda[] = [];

  // Regex para capturar: NOME_PRODUTO  N - GRUPO  N - MARCA  VALOR  QUANT  VLMEDIO
  // Os números BR têm formato: dígitos com pontos e vírgula
  const numBR = /[\d.]+,\d+/;
  const grupoMarcaPattern = /\d+\s*-\s*[A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ\s\/]+/;

  // Estratégia: percorrer linhas e tentar identificar linhas de produto
  // Uma linha de produto termina com 3 números BR consecutivos
  for (const line of lines) {
    // Ignorar linhas de cabeçalho, rodapé, total
    if (/^(Produto|Grupo|Marca|Valor|Quant|Vl\.M|Total:|Emitido|P[áa]gina|Vendedor|Per[ií]odo|Setor|Cliente|Descontar|Incluir|S[eé]rie|Produto:)/i.test(line)) continue;
    if (/^\s*$/.test(line)) continue;

    // Tentar extrair os 3 números do final da linha
    const nums = line.match(/([\d.]+,\d+)\s+([\d.]+,\d+)\s+([\d.]+,\d+)\s*$/);
    if (!nums) continue;

    const valor = parseBRNumber(nums[1]);
    const quantidade = parseBRNumber(nums[2]);
    const vlMedio = parseBRNumber(nums[3]);

    // O restante da linha (sem os 3 números) contém: PRODUTO  GRUPO  MARCA
    const resto = line.slice(0, line.lastIndexOf(nums[1])).trim();

    // Tentar separar produto, grupo e marca
    // Grupos e marcas têm padrão "N - TEXTO"
    const partes = resto.split(/\s{2,}/); // separar por 2+ espaços

    let produto = "";
    let grupo = "";
    let marca = "";

    if (partes.length >= 3) {
      produto = partes[0].trim();
      grupo = partes[1].trim();
      marca = partes[2].trim();
    } else if (partes.length === 2) {
      produto = partes[0].trim();
      grupo = partes[1].trim();
    } else {
      // Tentar separar pelo padrão "N - "
      const mGrupo = resto.match(/^(.+?)\s+(\d+\s*-\s*[A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ\s\/]+?)\s+(\d+\s*-\s*[A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ\s\/]+?)\s*$/);
      if (mGrupo) {
        produto = mGrupo[1].trim();
        grupo = mGrupo[2].trim();
        marca = mGrupo[3].trim();
      } else {
        produto = resto.trim();
      }
    }

    if (!produto || valor === 0) continue;

    linhas.push({ produto, grupo, marca, valor, quantidade, vlMedio });
  }

  return {
    cabecalho: { periodoInicio, periodoFim, setor },
    linhas,
  };
}

// ─── Rota Express ─────────────────────────────────────────────────────────────

export function registerImportacaoVendasRoute(app: any) {
  const router = Router();

  router.post("/api/importacao-vendas", upload.single("file"), async (req: any, res: any) => {
    try {
      // Verificar autenticação
      let currentUser: any = null;
      try {
        currentUser = await sdk.authenticateRequest(req as any);
      } catch (_e) {
        return res.status(401).json({ error: "Não autenticado" });
      }
      if (!currentUser?.id) {
        return res.status(401).json({ error: "Não autenticado" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "Nenhum arquivo enviado" });
      }

      const db = await getDb();
      if (!db) {
        return res.status(500).json({ error: "Banco de dados indisponível" });
      }

      // Extrair texto do PDF
      let pdfText = "";
      try {
        const parsed = await pdfParse(req.file.buffer);
        pdfText = parsed.text;
      } catch (e: any) {
        return res.status(400).json({ error: `Erro ao ler PDF: ${e.message}` });
      }

      // Parsear o texto
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

      // Converter datas para Date objects (Drizzle exige Date para colunas date)
      const dtInicio = new Date(cabecalho.periodoInicio + "T00:00:00Z");
      const dtFim = new Date(cabecalho.periodoFim + "T00:00:00Z");

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
