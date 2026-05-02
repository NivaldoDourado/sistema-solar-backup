/**
 * Rota REST para importação de planilha Excel de custos (CUSTOSOLAR).
 * Lê a aba MEMGERAL e extrai os totais consolidados por tipo de desembolso.
 * Cria/atualiza o período de custo e os lançamentos correspondentes.
 */
import { Router } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { distance } from "fastest-levenshtein";
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

      // Extrair dados da aba MEMGERAL - seção TOTAL (tabela verde consolidada)
      // O XLSX.js lê a planilha com índices 0-based.
      // A aba MEMGERAL tem 3 tabelas lado a lado:
      //   Col 0-5: RATEIO POR SETOR (Despesas/Custos/Total)
      //   Col 7-12: RATEIO POR TIPO DE DESEMBOLSO (Despesas/Custos/Total)
      // As 3 ocorrências de "RATEIO POR TIPO DE DESEMBOLSO" estão na col 7:
      //   1ª = DESPESAS (laranja), 2ª = CUSTOS (azul), 3ª = TOTAL consolidado (verde)
      // Usamos a 3ª ocorrência (tabela verde) para importação sintética.
      // Colunas: 7=conta, 8=CF, 9=CV, 10=DF, 11=DV
      const wsMem = workbook.Sheets["MEMGERAL"];
      const memData = XLSX.utils.sheet_to_json(wsMem, { header: 1, defval: null }) as any[][];

      const HEADER_MARKER = "RATEIO POR TIPO DE DESEMBOLSO";
      const SKIP_NAMES = new Set(["RATEIO POR TIPO DE DESEMBOLSO", "CUST.FIXO", "CUST.VARIA", "DESP. FIXA", "DESP. VARIA", "TOTAL", "LIVRE", null, undefined, ""]);

      // Encontrar a TERCEIRA ocorrência de RATEIO POR TIPO DE DESEMBOLSO na col 7 (tabela verde)
      let occurrenceCount = 0;
      let totalSectionStart = -1;
      for (let i = 0; i < memData.length; i++) {
        const row = memData[i];
        if (row && row[7] === HEADER_MARKER) {
          occurrenceCount++;
          if (occurrenceCount === 3) {
            totalSectionStart = i + 1; // linha após o cabeçalho da tabela verde
            break;
          }
        }
      }

      if (totalSectionStart === -1) {
        // Fallback: tentar qualquer ocorrência na col 7
        for (let i = 0; i < memData.length; i++) {
          const row = memData[i];
          if (row && row[7] === HEADER_MARKER) {
            totalSectionStart = i + 1;
          }
        }
      }

      if (totalSectionStart === -1) {
        return res.status(400).json({ error: "Seção 'RATEIO POR TIPO DE DESEMBOLSO' não encontrada na aba MEMGERAL. Verifique se o arquivo é o modelo CUSTOSOLAR correto." });
      }

      // Extrair lançamentos da seção TOTAL (tabela verde)
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
        if (!row || row[7] === null || row[7] === undefined) continue;
        const nome = String(row[7]).trim();
        if (!nome || SKIP_NAMES.has(nome)) continue;

        const cf = typeof row[8] === "number" ? row[8] : 0;
        const cv = typeof row[9] === "number" ? row[9] : 0;
        const df = typeof row[10] === "number" ? row[10] : 0;
        const dv = typeof row[11] === "number" ? row[11] : 0;
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

      // Normalização para comparação: minúsculas, sem acentos, sem pontuação/espaços extras
      const normalizeName = (name: string): string => {
        return name
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "") // remover acentos
          .replace(/[^a-z0-9]/g, " ")      // substituir pontuação por espaço
          .replace(/\s+/g, " ")            // colapsar espaços múltiplos
          .trim();
      };

      // Função de similaridade: retorna score 0-1 (1 = idêntico)
      const similarity = (a: string, b: string): number => {
        const na = normalizeName(a);
        const nb = normalizeName(b);
        if (na === nb) return 1;
        const maxLen = Math.max(na.length, nb.length);
        if (maxLen === 0) return 1;
        const dist = distance(na, nb);
        return 1 - dist / maxLen;
      };

      // Limiar mínimo de similaridade para aceitar o mapeamento (70%)
      const SIMILARITY_THRESHOLD = 0.70;

      // Tabela de aliases: nomes conhecidos da planilha CUSTOSOLAR → nomes no sistema
      // Chave: nome da planilha normalizado (sem acentos, só letras/números/espaços)
      // Valor: nome do sistema normalizado (para comparar com o banco)
      const ALIASES: Record<string, string> = {
        // Salários administrativos
        "sal adm diretoria pro labore encargos": "rh adm salarios nao operacionais",
        // Salários operacionais — aceita tanto 'RH - Salários da Operação' quanto 'Sal.Oper./Enc. Oper.'
        "sal do oper": "sal oper enc oper",
        "sal oper": "sal oper enc oper",
        // Peças de reposição
        "pecas de reposicao": "pecas de reposicao itens de consumo",
        // Outras despesas
        "outras despesas": "outras despesas dos equipamentos",
        // Impostos
        "imp trib taxas e cefem": "impostos cefem e outras taxas",
        // Despesas administrativas
        "desp admin telef e inform": "despesas administrativas",
        // Outras despesas de setores
        "outras desp setor proc": "outras despesas de setores",
        // Equipamentos de apoio
        "equip apoio comb lub pecas serv": "equipamentos de apoio",
        // Jurídico / Consultorias
        "juridico cons esp serv ter": "consultorias especializadas",
        // Comissão de vendas (com erro de grafia na planilha)
        "comisao de vendas": "comissao de vendas",
      };

      // Função de normalização para aliases (apenas letras/números, sem espaços extras)
      const normalizeAlias = (name: string): string => {
        return name
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]/g, " ")
          .replace(/\s+/g, " ")
          .trim();
      };

      // Tentar mapear cada lançamento da planilha para uma conta do sistema
      const mapeados: Array<{ contaId: number; nomePlanilha: string; nomeSistema: string; classificacao: string; divisor: string; valor: number; score: number }> = [];
      const naoMapeados: string[] = [];

      for (const l of lancamentosImport) {
        let melhorConta: typeof contasCadastradas[0] | null = null;
        let melhorScore = 0;

        // Verificar se há um alias para o nome da planilha
        const normAlias = normalizeAlias(l.nomePlanilha);
        const aliasTarget = ALIASES[normAlias];

        for (const c of contasCadastradas) {
          let score = similarity(l.nomePlanilha, c.nome);

          // Se há alias, comparar também com o nome normalizado do alias
          if (aliasTarget) {
            const scoreAlias = similarity(aliasTarget, normalizeAlias(c.nome));
            if (scoreAlias > score) score = scoreAlias;
          }

          if (score > melhorScore) {
            melhorScore = score;
            melhorConta = c;
          }
        }

        if (melhorConta && melhorScore >= SIMILARITY_THRESHOLD) {
          mapeados.push({
            contaId: melhorConta.id,
            nomePlanilha: l.nomePlanilha,
            nomeSistema: melhorConta.nome,
            classificacao: melhorConta.classificacao ?? "custo_variavel",
            divisor: melhorConta.divisor ?? "producao",
            valor: l.total,
            score: melhorScore,
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
