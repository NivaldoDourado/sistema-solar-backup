/**
 * Rota REST para importação de planilha Excel de custos (CUSTOSOLAR).
 * Lê a aba MEMGERAL e extrai os totais consolidados por tipo de desembolso.
 * Cria/atualiza o período de custo e os lançamentos correspondentes.
 */
import { Router } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { getDb } from "./db";
import { contaCusto, periodoCusto, lancamentoCusto } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { sdk } from "./_core/sdk";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

export function registerImportacaoCustoRoute(app: any) {
  const router = Router();

  router.post("/api/importacao-custo", upload.single("file"), async (req: any, res: any) => {
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

      // Ler o arquivo Excel
      const workbook = XLSX.read(req.file.buffer, { type: "buffer", cellDates: true });

      // Verificar se a aba MEMGERAL existe
      if (!workbook.SheetNames.includes("MEMGERAL")) {
        return res.status(400).json({ error: "Arquivo inválido: aba 'MEMGERAL' não encontrada. Certifique-se de usar o modelo CUSTOSOLAR." });
      }

      // Extrair data do período da aba EMPRESA
      let mes = 0;
      let ano = 0;
      let producaoTotal = 0;
      let quantidadeVendida = 0;

      if (workbook.SheetNames.includes("EMPRESA")) {
        const wsEmp = workbook.Sheets["EMPRESA"];
        const empData = XLSX.utils.sheet_to_json(wsEmp, { header: 1, defval: null }) as any[][];
        for (const row of empData) {
          if (row[2] === "DATA INICIAL DO CUSTO" && row[3]) {
            const d = row[3] instanceof Date ? row[3] : new Date(row[3]);
            mes = d.getMonth() + 1;
            ano = d.getFullYear();
          }
        }
      }

      if (mes === 0 || ano === 0) {
        return res.status(400).json({ error: "Não foi possível identificar o período (mês/ano) na aba EMPRESA." });
      }

      // Extrair produção total da aba EMPRESA (SP09 = EXPEDIÇÃO = produção vendida/expedida)
      if (workbook.SheetNames.includes("EMPRESA")) {
        const wsEmp = workbook.Sheets["EMPRESA"];
        const empData = XLSX.utils.sheet_to_json(wsEmp, { header: 1, defval: null }) as any[][];
        for (const row of empData) {
          if (row[1] === "SP09" && row[2] === "EXPEDIÇÃO" && typeof row[5] === "number") {
            quantidadeVendida = row[5];
          }
        }
      }

      // Extrair produção total da aba PRODSEC (PROD, DO MÊS (ton))
      if (workbook.SheetNames.includes("PRODSEC")) {
        const wsProd = workbook.Sheets["PRODSEC"];
        const prodData = XLSX.utils.sheet_to_json(wsProd, { header: 1, defval: null }) as any[][];
        for (const row of prodData) {
          if (row[1] === "PROD, DO MÊS (ton)" && typeof row[2] === "number" && row[2] > 0) {
            producaoTotal = row[2];
            break;
          }
        }
      }

      // Extrair dados da aba MEMGERAL - seção TOTAL (linhas 36-55, colunas I-N)
      const wsMem = workbook.Sheets["MEMGERAL"];
      const memData = XLSX.utils.sheet_to_json(wsMem, { header: 1, defval: null }) as any[][];

      // Mapeamento de nomes da planilha para nomes do sistema
      // A seção TOTAL começa na linha 36 (índice 35) com cabeçalho
      // Colunas: I(8)=conta, J(9)=CF, K(10)=CV, L(11)=DF, M(12)=DV, N(13)=TOTAL
      const HEADER_MARKER = "RATEIO POR TIPO DE DESEMBOLSO";
      const SKIP_NAMES = new Set(["RATEIO POR TIPO DE DESEMBOLSO", "CUST.FIXO", "LIVRE", null, undefined, ""]);

      // Encontrar a última seção TOTAL (linhas 36+)
      let totalSectionStart = -1;
      for (let i = 35; i < memData.length; i++) {
        const row = memData[i];
        if (row && row[8] === HEADER_MARKER) {
          totalSectionStart = i + 1; // linha após o cabeçalho
        }
      }

      if (totalSectionStart === -1) {
        return res.status(400).json({ error: "Seção 'RATEIO POR TIPO DE DESEMBOLSO' não encontrada na aba MEMGERAL." });
      }

      // Extrair lançamentos da seção TOTAL
      interface LancamentoImport {
        nomePlanilha: string;
        custofixo: number;
        custovariavel: number;
        despesafixa: number;
        despesavariavel: number;
        total: number;
      }
      const lancamentosImport: LancamentoImport[] = [];

      for (let i = totalSectionStart; i < memData.length; i++) {
        const row = memData[i];
        if (!row || !row[8]) continue;
        const nome = String(row[8]).trim();
        if (SKIP_NAMES.has(nome)) continue;
        if (typeof row[13] !== "number" && row[13] === null) continue;

        const cf = typeof row[9] === "number" ? row[9] : 0;
        const cv = typeof row[10] === "number" ? row[10] : 0;
        const df = typeof row[11] === "number" ? row[11] : 0;
        const dv = typeof row[12] === "number" ? row[12] : 0;
        const total = cf + cv + df + dv;

        if (total === 0) continue;

        lancamentosImport.push({
          nomePlanilha: nome,
          custofixo: cf,
          custovariavel: cv,
          despesafixa: df,
          despesavariavel: dv,
          total,
        });
      }

      if (lancamentosImport.length === 0) {
        return res.status(400).json({ error: "Nenhum lançamento encontrado na planilha. Verifique se o arquivo é o modelo CUSTOSOLAR correto." });
      }

      // Buscar todas as contas de custo cadastradas no sistema
      const contasCadastradas = await db.select().from(contaCusto).where(eq(contaCusto.ativo, "sim"));

      // Criar mapeamento por nome (normalizado)
      const normalizeName = (name: string): string => {
        return name.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
      }
      const contaMap = new Map<string, typeof contasCadastradas[0]>();
      for (const c of contasCadastradas) {
        contaMap.set(normalizeName(c.nome), c);
      }

      // Tentar mapear cada lançamento da planilha para uma conta do sistema
      const mapeados: Array<{ contaId: number; nomePlanilha: string; nomeSistema: string; classificacao: string; divisor: string; valor: number }> = [];
      const naoMapeados: string[] = [];

      for (const l of lancamentosImport) {
        const normNome = normalizeName(l.nomePlanilha);
        const conta = contaMap.get(normNome);

        if (conta) {
          // Conta encontrada — usar classificação e divisor da conta
          // O valor a lançar é o TOTAL (CF+CV+DF+DV)
          mapeados.push({
            contaId: conta.id,
            nomePlanilha: l.nomePlanilha,
            nomeSistema: conta.nome,
            classificacao: conta.classificacao ?? "custo_variavel",
            divisor: conta.divisor ?? "producao",
            valor: l.total,
          });
        } else {
          naoMapeados.push(l.nomePlanilha);
        }
      }

      // Criar ou atualizar o período de custo
      const [periodoExistente] = await db
        .select()
        .from(periodoCusto)
        .where(and(eq(periodoCusto.mes, mes), eq(periodoCusto.ano, ano)))
        .limit(1);

      let periodoId: number;
      if (periodoExistente) {
        // Atualizar produção e vendas se não estiverem preenchidas
        await db
          .update(periodoCusto)
          .set({
            producaoTotal: producaoTotal > 0 ? String(producaoTotal) : periodoExistente.producaoTotal,
            quantidadeVendida: quantidadeVendida > 0 ? String(quantidadeVendida) : periodoExistente.quantidadeVendida,
          })
          .where(eq(periodoCusto.id, periodoExistente.id));
        periodoId = periodoExistente.id;

        // Verificar se está fechado
        if (periodoExistente.fechado === "sim") {
          return res.status(400).json({ error: `O período ${mes}/${ano} está fechado. Não é possível importar lançamentos.` });
        }
      } else {
        // Criar novo período
        const result = await db.insert(periodoCusto).values({
          mes,
          ano,
          producaoTotal: producaoTotal > 0 ? String(producaoTotal) : null,
          quantidadeVendida: quantidadeVendida > 0 ? String(quantidadeVendida) : null,
          despesasIndiretas: "0",
          fechado: "nao",
          userId: currentUser.id,
        });
        periodoId = Number(result[0].insertId);
      }

      // Inserir/atualizar lançamentos mapeados
      const existentes = await db
        .select()
        .from(lancamentoCusto)
        .where(eq(lancamentoCusto.periodoCustoId, periodoId));
      const existenteMap = new Map(existentes.map((l) => [l.contaCustoId, l]));

      let created = 0;
      let updated = 0;

      for (const item of mapeados) {
        const valorStr = item.valor.toFixed(2);
        const existing = existenteMap.get(item.contaId);
        if (existing) {
          await db
            .update(lancamentoCusto)
            .set({ valor: valorStr, observacoes: `Importado da planilha CUSTOSOLAR` })
            .where(eq(lancamentoCusto.id, existing.id));
          updated++;
        } else {
          await db.insert(lancamentoCusto).values({
            periodoCustoId: periodoId,
            contaCustoId: item.contaId,
            valor: valorStr,
            observacoes: `Importado da planilha CUSTOSOLAR`,
            userId: currentUser.id,
          });
          created++;
        }
      }

      return res.json({
        success: true,
        periodo: { mes, ano, id: periodoId },
        producaoTotal,
        quantidadeVendida,
        totalLancamentos: lancamentosImport.length,
        mapeados: mapeados.length,
        naoMapeados,
        created,
        updated,
      });
    } catch (err: any) {
      console.error("Erro na importação de custos:", err);
      return res.status(500).json({ error: err?.message ?? "Erro interno na importação" });
    }
  });

  app.use(router);
}
