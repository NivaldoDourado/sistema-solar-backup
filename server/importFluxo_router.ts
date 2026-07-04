import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { lancamentoFluxo, periodoCusto, lancamentoCusto, contaCusto, contaExcluidaFluxo, simulacaoFluxoParcial } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import * as XLSX from "xlsx";
import {
  CONTAS_IMPORTAR,
  CONTAS_EXCLUIR,
  CONTAS_INDIVIDUAIS_EXCLUIR,
  CONTAS_TETO_VALOR,
  EXCECOES_IMPORTAR,
  extrairCodigoNome,
  detectarNivel,
  getSetorEnergia,
  type ContaFluxoConfig,
} from "./importFluxo_correspondencias";

// ===== TIPOS =====

interface ContaParsed {
  codigo: string;
  nome: string;
  nivel: number; // 1=principal, 2=agrupada, 3=subagrupada, 4=sub-sub
  valor: number | null;
  observacoes: string | null;
  contaPrincipalCodigo: string;
  contaPrincipalNome: string;
  contaAgrupadaCodigo: string | null;
  contaAgrupadaNome: string | null;
  contaSubagrupadaCodigo: string | null;
  contaSubagrupadaNome: string | null;
}

interface ContaImportPreview {
  contaPrincipalCodigo: string;
  contaPrincipalNome: string;
  contaSistema: string;
  setor: string;
  valorTotal: number;
  subcontas: {
    codigo: string;
    nome: string;
    nivel: number;
    valor: number;
    setor: string; // pode ser diferente do principal (rateio energia)
    isRateio: boolean;
    percentualRateio: number | null;
    observacoes: string | null;
  }[];
  excluidas: {
    codigo: string;
    nome: string;
    valor: number;
    motivo: string;
  }[];
}

interface FluxoParsed {
  periodo: string; // ex: "Abril/2026"
  dataInicio: number; // serial Excel
  dataFim: number;
  contasImportar: ContaImportPreview[];
  contasExcluir: { codigo: string; nome: string; valorTotal: number }[];
  totalImportar: number;
  totalExcluir: number;
}

// ===== PARSER =====

export function parsePlanilhaFluxo(buffer: Buffer, extraExcluidos: string[] = []): FluxoParsed {
  // Combinar exclusões estáticas com dinâmicas (do banco)
  const todasExclusoesIndividuais = [...CONTAS_INDIVIDUAIS_EXCLUIR, ...extraExcluidos];
  const wb = XLSX.read(buffer, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

  // Extrair período do cabeçalho (linha 0)
  const headerRow = data[0] || [];
  const dataInicio = headerRow[4] || 0;
  const dataFim = headerRow[6] || 0;
  
  // Converter serial Excel para mês/ano
  let periodo = "";
  if (typeof dataInicio === "number" && dataInicio > 0) {
    const d = new Date((dataInicio - 25569) * 86400 * 1000);
    const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    periodo = `${meses[d.getMonth()]}/${d.getFullYear()}`;
  }

  // Parse hierárquico
  const contasParsed: ContaParsed[] = [];
  let contaPrincipalAtual: { codigo: string; nome: string } | null = null;
  let contaAgrupadaAtual: { codigo: string; nome: string } | null = null;
  let contaSubagrupadaAtual: { codigo: string; nome: string } | null = null;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || !row[0]) continue;

    const col0 = String(row[0]);
    const trimmed = col0.trim();

    // Ignorar linhas de seção, total e cabeçalho
    if (trimmed === "ENTRADAS" || trimmed === "SAIDAS" || trimmed.startsWith("Total") ||
        trimmed.startsWith("Page ") || trimmed === "" || trimmed === "Item") continue;

    const nivel = detectarNivel(col0);
    if (nivel === 0) continue; // Seção (ENTRADAS, SAIDAS, etc.)

    const parsed = extrairCodigoNome(trimmed);
    if (!parsed) continue; // Não é uma conta (ex: "Total")

    // Handle both numeric values and Brazilian-formatted string values (e.g., "18.900,00")
    let valor: number | null = null;
    if (typeof row[1] === "number") {
      valor = row[1];
    } else if (typeof row[1] === "string" && row[1].trim() !== "" && row[1].trim() !== "Valor") {
      const cleaned = row[1].trim().replace(/\./g, "").replace(",", ".");
      const parsed2 = parseFloat(cleaned);
      if (!isNaN(parsed2)) valor = parsed2;
    }
    const obs = typeof row[2] === "string" ? row[2].trim() : null;

    if (nivel === 1) {
      contaPrincipalAtual = { codigo: parsed.codigo, nome: parsed.nome };
      contaAgrupadaAtual = null;
      contaSubagrupadaAtual = null;
      // Conta principal pode ter valor direto (ex: 2184-COMISSÃO DE VENDAS dentro de outra)
      if (valor !== null) {
        contasParsed.push({
          ...parsed,
          nivel: 1,
          valor,
          observacoes: obs,
          contaPrincipalCodigo: parsed.codigo,
          contaPrincipalNome: parsed.nome,
          contaAgrupadaCodigo: null,
          contaAgrupadaNome: null,
          contaSubagrupadaCodigo: null,
          contaSubagrupadaNome: null,
        });
      }
    } else if (nivel === 2) {
      contaAgrupadaAtual = { codigo: parsed.codigo, nome: parsed.nome };
      contaSubagrupadaAtual = null;
      if (valor !== null) {
        contasParsed.push({
          ...parsed,
          nivel: 2,
          valor,
          observacoes: obs,
          contaPrincipalCodigo: contaPrincipalAtual?.codigo || "",
          contaPrincipalNome: contaPrincipalAtual?.nome || "",
          contaAgrupadaCodigo: parsed.codigo,
          contaAgrupadaNome: parsed.nome,
          contaSubagrupadaCodigo: null,
          contaSubagrupadaNome: null,
        });
      }
    } else if (nivel === 3) {
      contaSubagrupadaAtual = { codigo: parsed.codigo, nome: parsed.nome };
      if (valor !== null) {
        contasParsed.push({
          ...parsed,
          nivel: 3,
          valor,
          observacoes: obs,
          contaPrincipalCodigo: contaPrincipalAtual?.codigo || "",
          contaPrincipalNome: contaPrincipalAtual?.nome || "",
          contaAgrupadaCodigo: contaAgrupadaAtual?.codigo || null,
          contaAgrupadaNome: contaAgrupadaAtual?.nome || null,
          contaSubagrupadaCodigo: parsed.codigo,
          contaSubagrupadaNome: parsed.nome,
        });
      }
    } else if (nivel === 4) {
      if (valor !== null) {
        contasParsed.push({
          ...parsed,
          nivel: 4,
          valor,
          observacoes: obs,
          contaPrincipalCodigo: contaPrincipalAtual?.codigo || "",
          contaPrincipalNome: contaPrincipalAtual?.nome || "",
          contaAgrupadaCodigo: contaAgrupadaAtual?.codigo || null,
          contaAgrupadaNome: contaAgrupadaAtual?.nome || null,
          contaSubagrupadaCodigo: contaSubagrupadaAtual?.codigo || null,
          contaSubagrupadaNome: contaSubagrupadaAtual?.nome || null,
        });
      }
    }
  }

  // Agrupar por conta principal e classificar
  const contasImportar: ContaImportPreview[] = [];
  const contasExcluir: { codigo: string; nome: string; valorTotal: number }[] = [];

  // Processar contas principais
  const contasPrincipaisUnicas = Array.from(new Set(contasParsed.map(c => c.contaPrincipalCodigo)));

  for (const codigoPrincipal of contasPrincipaisUnicas) {
    const contasDessaPrincipal = contasParsed.filter(c => c.contaPrincipalCodigo === codigoPrincipal);
    if (contasDessaPrincipal.length === 0) continue;

    const nomePrincipal = contasDessaPrincipal[0].contaPrincipalNome;

    // Verificar se a conta principal deve ser excluída
    if (CONTAS_EXCLUIR.includes(codigoPrincipal)) {
      // Verificar exceções dentro da conta excluída
      const excecoes = contasDessaPrincipal.filter(c =>
        EXCECOES_IMPORTAR.some(e => e.codigo === c.codigo)
      );

      if (excecoes.length > 0) {
        // Importar as exceções separadamente
        for (const exc of excecoes) {
          const config = EXCECOES_IMPORTAR.find(e => e.codigo === exc.codigo)!;
          contasImportar.push({
            contaPrincipalCodigo: exc.codigo,
            contaPrincipalNome: exc.nome,
            contaSistema: config.contaSistema,
            setor: config.setor,
            valorTotal: exc.valor || 0,
            subcontas: [{
              codigo: exc.codigo,
              nome: exc.nome,
              nivel: exc.nivel,
              valor: exc.valor || 0,
              setor: config.setor,
              isRateio: false,
              percentualRateio: null,
              observacoes: exc.observacoes,
            }],
            excluidas: [],
          });
        }
      }

      // Calcular total excluído (sem as exceções)
      const totalExcluido = contasDessaPrincipal
        .filter(c => !EXCECOES_IMPORTAR.some(e => e.codigo === c.codigo))
        .filter(c => c.nivel === 2 || (c.nivel === 1 && c.valor !== null)) // Só nível 2 direto ou nível 1 com valor
        .reduce((sum, c) => sum + (c.valor || 0), 0);

      contasExcluir.push({
        codigo: codigoPrincipal,
        nome: nomePrincipal,
        valorTotal: totalExcluido,
      });
      continue;
    }

    // Verificar se a conta principal está na lista de importação
    const config = CONTAS_IMPORTAR.find(c => c.codigo === codigoPrincipal);
    if (!config) {
      // Conta não mapeada - excluir (entradas, etc.)
      const totalExcluido = contasDessaPrincipal
        .filter(c => c.nivel === 2 || (c.nivel === 1 && c.valor !== null))
        .reduce((sum, c) => sum + (c.valor || 0), 0);
      if (totalExcluido > 0) {
        contasExcluir.push({ codigo: codigoPrincipal, nome: nomePrincipal, valorTotal: totalExcluido });
      }
      continue;
    }

    // Processar conta a importar
    const preview: ContaImportPreview = {
      contaPrincipalCodigo: codigoPrincipal,
      contaPrincipalNome: nomePrincipal,
      contaSistema: config.contaSistema,
      setor: config.setor,
      valorTotal: 0,
      subcontas: [],
      excluidas: [],
    };

    // Processar subcontas
    for (const conta of contasDessaPrincipal) {
      if (conta.valor === null || conta.valor === 0) continue;

      // Verificar exclusão individual (estática + dinâmica do banco)
      if (todasExclusoesIndividuais.includes(conta.codigo)) {
        preview.excluidas.push({
          codigo: conta.codigo,
          nome: conta.nome,
          valor: conta.valor,
          motivo: "Excluída individualmente",
        });
        continue;
      }

      // Aplicar teto de valor (a partir de jun/26)
      const tetoConfig = CONTAS_TETO_VALOR[conta.codigo];
      if (tetoConfig && conta.valor > tetoConfig.teto) {
        conta.valor = tetoConfig.teto;
      }

      // Determinar setor (pode ter rateio especial para energia)
      let setor = config.setor;
      let isRateio = false;
      let percentualRateio: number | null = null;

      if (config.codigo === "2183") {
        // Energia elétrica - rateio especial
        const setorEnergia = getSetorEnergia(conta.codigo);
        if (setorEnergia) {
          if (setorEnergia.setor) {
            setor = setorEnergia.setor;
          } else if (setorEnergia.rateio) {
            // Criar múltiplas entradas para rateio
            for (const r of setorEnergia.rateio) {
              preview.subcontas.push({
                codigo: conta.codigo,
                nome: `${conta.nome} (${Math.round(r.percentual * 100)}%)`,
                nivel: conta.nivel,
                valor: Math.round(conta.valor * r.percentual * 100) / 100,
                setor: r.setor,
                isRateio: true,
                percentualRateio: r.percentual,
                observacoes: conta.observacoes,
              });
            }
            continue; // Já adicionou via rateio
          }
        }
      }

      preview.subcontas.push({
        codigo: conta.codigo,
        nome: conta.nome,
        nivel: conta.nivel,
        valor: conta.valor,
        setor,
        isRateio,
        percentualRateio,
        observacoes: conta.observacoes,
      });
    }

    // Calcular valor total (soma das subcontas importadas)
    preview.valorTotal = preview.subcontas.reduce((sum, s) => sum + s.valor, 0);

    if (preview.valorTotal > 0 || preview.subcontas.length > 0) {
      contasImportar.push(preview);
    }
  }

  const totalImportar = contasImportar.reduce((sum, c) => sum + c.valorTotal, 0);
  const totalExcluir = contasExcluir.reduce((sum, c) => sum + c.valorTotal, 0);

  return {
    periodo,
    dataInicio: typeof dataInicio === "number" ? dataInicio : 0,
    dataFim: typeof dataFim === "number" ? dataFim : 0,
    contasImportar,
    contasExcluir,
    totalImportar,
    totalExcluir,
  };
}

// ===== ROUTER =====

export const importFluxoRouter = router({
  /**
   * Faz o parse da planilha e retorna preview para confirmação
   */
  parsePlanilha: protectedProcedure
    .input(z.object({ fileBase64: z.string() }))
    .mutation(async ({ input }) => {
      const buffer = Buffer.from(input.fileBase64, "base64");

      // Buscar contas excluídas dinâmicas do banco
      const db = (await getDb())!;
      const excluidas = await db.select({ codigo: contaExcluidaFluxo.codigo }).from(contaExcluidaFluxo);
      const codigosExcluidos = excluidas.map((c: { codigo: string }) => c.codigo);

      const parsed = parsePlanilhaFluxo(buffer, codigosExcluidos);
      return parsed;
    }),

  /**
   * Confirma a importação e grava os lançamentos no banco
   */
  confirmarImportacao: protectedProcedure
    .input(z.object({
      periodoCustoId: z.number(),
      contasImportar: z.array(z.object({
        contaPrincipalCodigo: z.string(),
        contaPrincipalNome: z.string(),
        contaSistema: z.string(),
        setor: z.string(),
        subcontas: z.array(z.object({
          codigo: z.string(),
          nome: z.string(),
          nivel: z.number(),
          valor: z.number(),
          setor: z.string(),
          isRateio: z.boolean(),
          percentualRateio: z.number().nullable(),
          observacoes: z.string().nullable(),
        })),
      })),
    }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;

      const db = (await getDb())!;

      // Verificar se já existem lançamentos de fluxo para este período
      const existentes = await db
        .select()
        .from(lancamentoFluxo)
        .where(eq(lancamentoFluxo.periodoCustoId, input.periodoCustoId))
        .limit(1);

      if (existentes.length > 0) {
        // Excluir lançamentos anteriores para reimportação
        await db
          .delete(lancamentoFluxo)
          .where(eq(lancamentoFluxo.periodoCustoId, input.periodoCustoId));
      }

      // Inserir novos lançamentos
      let totalInseridos = 0;
      for (const conta of input.contasImportar) {
        for (const sub of conta.subcontas) {
          if (sub.valor === 0) continue;

          await db.insert(lancamentoFluxo).values({
            periodoCustoId: input.periodoCustoId,
            contaPrincipalCodigo: conta.contaPrincipalCodigo,
            contaPrincipalNome: conta.contaPrincipalNome,
            contaSistema: conta.contaSistema,
            setor: sub.setor,
            contaAgrupadaCodigo: sub.codigo,
            contaAgrupadaNome: sub.nome,
            contaSubagrupadaCodigo: null,
            contaSubagrupadaNome: null,
            nivel: sub.nivel,
            valor: String(sub.valor),
            observacoes: sub.observacoes,
            isRateio: sub.isRateio,
            percentualRateio: sub.percentualRateio ? String(sub.percentualRateio) : null,
            userId,
          });
          totalInseridos++;
        }
      }

      // ===== INTEGRAÇÃO COM APURAÇÃO DE CUSTO =====
      // Buscar todas as contas de custo para mapear contaSistema → contaCustoId
      const contasCusto = await db.select().from(contaCusto);
      const contaMap = new Map<string, number>();
      for (const c of contasCusto) {
        contaMap.set(c.nome.toLowerCase(), c.id);
      }

      // Excluir lançamentos de custo anteriores originados do Fluxo para este período
      const lancamentosFluxoExistentes = await db
        .select({ id: lancamentoCusto.id })
        .from(lancamentoCusto)
        .where(
          and(
            eq(lancamentoCusto.periodoCustoId, input.periodoCustoId),
          )
        );
      // Filtrar apenas os que têm observação [Fluxo]
      for (const lf of lancamentosFluxoExistentes) {
        // Buscar observação
        const [full] = await db.select({ observacoes: lancamentoCusto.observacoes }).from(lancamentoCusto).where(eq(lancamentoCusto.id, lf.id)).limit(1);
        if (full?.observacoes?.startsWith("[Fluxo]")) {
          await db.delete(lancamentoCusto).where(eq(lancamentoCusto.id, lf.id));
        }
      }

      // Agrupar valores por contaSistema para inserir lançamentos agregados
      const valoresPorConta = new Map<string, { total: number; detalhes: string[] }>();
      for (const conta of input.contasImportar) {
        const totalConta = conta.subcontas.reduce((sum, s) => sum + s.valor, 0);
        if (totalConta === 0) continue;
        const key = conta.contaSistema.toLowerCase();
        if (!valoresPorConta.has(key)) {
          valoresPorConta.set(key, { total: 0, detalhes: [] });
        }
        const entry = valoresPorConta.get(key)!;
        entry.total += totalConta;
        entry.detalhes.push(`${conta.contaPrincipalCodigo}-${conta.contaPrincipalNome}`);
      }

      // Inserir lançamentos na tabela lancamento_custo
      let totalLancamentosCusto = 0;
      for (const [contaNomeLower, { total, detalhes }] of Array.from(valoresPorConta.entries())) {
        const contaCustoId = contaMap.get(contaNomeLower);
        if (!contaCustoId) continue; // Conta não encontrada no sistema
        await db.insert(lancamentoCusto).values({
          periodoCustoId: input.periodoCustoId,
          contaCustoId,
          valor: total.toFixed(2),
          observacoes: `[Fluxo] ${detalhes.join("; ")}`,
          userId,
        });
        totalLancamentosCusto++;
      }

      // Descartar dados parciais de simulação de fluxo para este período (importação oficial substitui)
      const periodoInfo = await db.select().from(periodoCusto).where(eq(periodoCusto.id, input.periodoCustoId)).limit(1);
      if (periodoInfo.length > 0) {
        await db.delete(simulacaoFluxoParcial).where(
          and(
            eq(simulacaoFluxoParcial.mes, periodoInfo[0].mes),
            eq(simulacaoFluxoParcial.ano, periodoInfo[0].ano),
          )
        );
      }

      return { totalInseridos, totalLancamentosCusto };
    }),

  /**
   * Lista lançamentos de fluxo por período (agrupados por conta principal)
   */
  listarPorPeriodo: protectedProcedure
    .input(z.object({ periodoCustoId: z.number() }))
    .query(async ({ input }) => {
      const db = (await getDb())!;
      const lancamentos = await db
        .select()
        .from(lancamentoFluxo)
        .where(eq(lancamentoFluxo.periodoCustoId, input.periodoCustoId));

      // Agrupar por conta principal
      const agrupados: Record<string, {
        contaPrincipalCodigo: string;
        contaPrincipalNome: string;
        contaSistema: string;
        setorPrincipal: string;
        valorTotal: number;
        lancamentos: typeof lancamentos;
      }> = {};

      for (const l of lancamentos) {
        const key = l.contaPrincipalCodigo;
        if (!agrupados[key]) {
          agrupados[key] = {
            contaPrincipalCodigo: l.contaPrincipalCodigo,
            contaPrincipalNome: l.contaPrincipalNome,
            contaSistema: l.contaSistema,
            setorPrincipal: l.setor,
            valorTotal: 0,
            lancamentos: [],
          };
        }
        agrupados[key].valorTotal += Number(l.valor);
        agrupados[key].lancamentos.push(l);
      }

      return Object.values(agrupados).sort((a, b) => b.valorTotal - a.valorTotal);
    }),

  /**
   * Exclui todos os lançamentos de fluxo de um período
   */
  excluirPorPeriodo: protectedProcedure
    .input(z.object({ periodoCustoId: z.number() }))
    .mutation(async ({ input }) => {
      const db = (await getDb())!;
      await db
        .delete(lancamentoFluxo)
        .where(eq(lancamentoFluxo.periodoCustoId, input.periodoCustoId));
      return { success: true };
    }),

  /**
   * Resumo por setor (para integração com apuração de custo)
   */
  resumoPorSetor: protectedProcedure
    .input(z.object({ periodoCustoId: z.number() }))
    .query(async ({ input }) => {
      const db = (await getDb())!;
      const lancamentos = await db
        .select()
        .from(lancamentoFluxo)
        .where(eq(lancamentoFluxo.periodoCustoId, input.periodoCustoId));

      // Agrupar por setor e conta do sistema
      const porSetor: Record<string, {
        setor: string;
        contas: Record<string, { contaSistema: string; valor: number }>;
        total: number;
      }> = {};

      for (const l of lancamentos) {
        if (!porSetor[l.setor]) {
          porSetor[l.setor] = { setor: l.setor, contas: {}, total: 0 };
        }
        if (!porSetor[l.setor].contas[l.contaSistema]) {
          porSetor[l.setor].contas[l.contaSistema] = { contaSistema: l.contaSistema, valor: 0 };
        }
        const val = Number(l.valor);
        porSetor[l.setor].contas[l.contaSistema].valor += val;
        porSetor[l.setor].total += val;
      }

      return Object.values(porSetor)
        .map(s => ({
          setor: s.setor,
          total: s.total,
          contas: Object.values(s.contas).sort((a, b) => b.valor - a.valor),
        }))
        .sort((a, b) => b.total - a.total);
    }),

  /**
   * Detalhe de uma conta específica do Fluxo: distribuição por setor com subcontas
   */
  detalhePorConta: protectedProcedure
    .input(z.object({ periodoCustoId: z.number(), contaSistema: z.string() }))
    .query(async ({ input }) => {
      const db = (await getDb())!;
      const lancamentos = await db
        .select()
        .from(lancamentoFluxo)
        .where(and(
          eq(lancamentoFluxo.periodoCustoId, input.periodoCustoId),
          eq(lancamentoFluxo.contaSistema, input.contaSistema),
        ));
      // Agrupar por setor
      const porSetor: Record<string, {
        setor: string;
        valor: number;
        isRateio: boolean;
        percentualRateio: number | null;
        subcontas: { nome: string; valor: number }[];
      }> = {};
      for (const l of lancamentos) {
        if (!porSetor[l.setor]) {
          porSetor[l.setor] = { setor: l.setor, valor: 0, isRateio: !!l.isRateio, percentualRateio: l.percentualRateio ? Number(l.percentualRateio) : null, subcontas: [] };
        }
        const val = Number(l.valor);
        porSetor[l.setor].valor += val;
        porSetor[l.setor].subcontas.push({
          nome: l.contaAgrupadaNome || l.contaPrincipalNome,
          valor: val,
        });
      }
      const total = Object.values(porSetor).reduce((s, r) => s + r.valor, 0);
      return {
        contaSistema: input.contaSistema,
        total,
        setores: Object.values(porSetor)
          .map(s => ({
            setor: s.setor,
            valor: s.valor,
            percentual: total > 0 ? (s.valor / total) * 100 : 0,
            isRateio: s.isRateio,
            percentualRateio: s.percentualRateio,
            subcontas: s.subcontas.sort((a, b) => b.valor - a.valor),
          }))
          .sort((a, b) => b.valor - a.valor),
      };
    }),
});
