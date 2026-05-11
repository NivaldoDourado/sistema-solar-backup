import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { getDb } from "./db";
import { custoSetor, lancamentoCusto, contaCusto, periodoCusto, lancamentoSalario, equipamentos, equipamentoExcluidoTag } from "../drizzle/schema";
import { eq, and, asc, sql, desc } from "drizzle-orm";
import { calcularRateioMem } from "./rateioMem_calc";
import { calcularRateioMset, type RateioMsetResult } from "./rateioMset_calc";
import { CORRESPONDENCIAS_FORCADAS, CORRESPONDENCIAS_APROVADAS } from "./importDespesas_correspondencias";

/**
 * Calcula o total real de despesas a partir de lancamento_custo + salários (mesma lógica da Apuração de Custo)
 * Filtra equipamentos excluídos.
 */
async function calcularTotalRealDespesas(periodoCustoId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  // Buscar exclusões
  const idsExclRows = await db.select({ id: equipamentos.id }).from(equipamentos).where(sql`${equipamentos.excluidoCusto} = 'sim'`);
  const idsExcluidos = new Set(idsExclRows.map(r => r.id));
  const tagsExclRows = await db.select({ tag: equipamentoExcluidoTag.tag }).from(equipamentoExcluidoTag);
  const tagsExcluidas = new Set(tagsExclRows.map(r => r.tag.toUpperCase()));

  // Mapear IDs excluídos para tags
  const allExcludedTags = new Set(tagsExcluidas);
  for (const [tag, equipId] of Object.entries(CORRESPONDENCIAS_APROVADAS)) {
    if (idsExcluidos.has(equipId)) allExcludedTags.add(tag.toUpperCase());
  }
  for (const [tag, { equipamentoId }] of Object.entries(CORRESPONDENCIAS_FORCADAS)) {
    if (idsExcluidos.has(equipamentoId)) allExcludedTags.add(tag.toUpperCase());
  }

  // Buscar lançamentos
  const lancamentosNormais = await db
    .select({ valor: lancamentoCusto.valor, observacoes: lancamentoCusto.observacoes })
    .from(lancamentoCusto)
    .where(eq(lancamentoCusto.periodoCustoId, periodoCustoId));

  // Filtrar excluídos
  let total = 0;
  for (const l of lancamentosNormais) {
    const obs = l.observacoes ?? "";
    if (obs.startsWith("[Import]")) {
      const rest = obs.substring(9).trim();
      const dashIdx = rest.indexOf(" - ");
      const tag = dashIdx === -1 ? rest.trim().toUpperCase() : rest.substring(0, dashIdx).trim().toUpperCase();
      if (allExcludedTags.has(tag)) continue;
    }
    total += parseFloat(String(l.valor ?? "0"));
  }

  // Salários
  const salariosRows = await db
    .select({ totalValor: sql<string>`CAST(SUM(${lancamentoSalario.valor}) AS DECIMAL(14,2))` })
    .from(lancamentoSalario)
    .where(eq(lancamentoSalario.periodoCustoId, periodoCustoId));
  const totalSalarios = parseFloat(salariosRows[0]?.totalValor ?? "0");

  return total + totalSalarios;
}

/**
 * Converte o resultado do rateio MEM para o formato sintético da Apuração de Custo.
 * Gera dados equivalentes aos importados da planilha RSSET.
 */
function convertRateioMemToSintetico(rateio: { subsetores: any[]; totalGeral: number; equipamentosSemRateio?: { id: number; nome: string; tag: string; despesaTotal: number }[] }) {
  type Grupo = {
    grupoNome: string;
    subsetores: any[];
    subtotalCusto: number;
    subtotalDespesa: number;
    subtotalGeral: number;
    subtotalCustoTon: number;
  };

  const gruposMap: Record<string, Grupo> = {};
  let virtualId = 900000; // IDs virtuais altos para não colidir com IDs reais

  for (const sub of rateio.subsetores) {
    if (!gruposMap[sub.grupoNome]) {
      gruposMap[sub.grupoNome] = {
        grupoNome: sub.grupoNome,
        subsetores: [],
        subtotalCusto: 0,
        subtotalDespesa: 0,
        subtotalGeral: 0,
        subtotalCustoTon: 0,
      };
    }

    const lancVirtual = {
      id: virtualId++,
      periodoCustoId: 0,
      grupoNome: sub.grupoNome,
      subsetorNome: sub.subsetorNome,
      setorId: null,
      custoFixo: "0",
      custoVariavel: sub.totalSubsetor.toFixed(2),
      totalCusto: sub.totalSubsetor.toFixed(2),
      despesaFixa: "0",
      despesaVariavel: "0",
      totalDespesa: "0",
      totalGeral: sub.totalSubsetor.toFixed(2),
      custoTon: "0",
      percentualTotal: rateio.totalGeral > 0
        ? ((sub.totalSubsetor / rateio.totalGeral) * 100).toFixed(4)
        : "0",
      ordemExibicao: 0,
      userId: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    gruposMap[sub.grupoNome].subsetores.push(lancVirtual);
    gruposMap[sub.grupoNome].subtotalCusto += sub.totalSubsetor;
    gruposMap[sub.grupoNome].subtotalDespesa += 0;
    gruposMap[sub.grupoNome].subtotalGeral += sub.totalSubsetor;
  }

  // Incluir equipamentos sem rateio como "NÃO ALOCADOS" em SERVIÇOS AUXILIARES
  if (rateio.equipamentosSemRateio && rateio.equipamentosSemRateio.length > 0) {
    const totalSemRateio = rateio.equipamentosSemRateio.reduce((s, e) => s + e.despesaTotal, 0);
    if (totalSemRateio > 0) {
      const grupoNome = "SERVI\u00c7OS AUXILIARES";
      const subsetorNome = "N\u00c3O ALOCADOS";
      if (!gruposMap[grupoNome]) {
        gruposMap[grupoNome] = {
          grupoNome,
          subsetores: [],
          subtotalCusto: 0,
          subtotalDespesa: 0,
          subtotalGeral: 0,
          subtotalCustoTon: 0,
        };
      }
      const lancVirtual = {
        id: virtualId++,
        periodoCustoId: 0,
        grupoNome,
        subsetorNome,
        setorId: null,
        custoFixo: "0",
        custoVariavel: totalSemRateio.toFixed(2),
        totalCusto: totalSemRateio.toFixed(2),
        despesaFixa: "0",
        despesaVariavel: "0",
        totalDespesa: "0",
        totalGeral: totalSemRateio.toFixed(2),
        custoTon: "0",
        percentualTotal: "0",
        ordemExibicao: 0,
        userId: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      gruposMap[grupoNome].subsetores.push(lancVirtual);
      gruposMap[grupoNome].subtotalCusto += totalSemRateio;
      gruposMap[grupoNome].subtotalGeral += totalSemRateio;
    }
  }

  const ORDEM_GRUPOS: Record<string, number> = {
    "DESMONTE DE ROCHA": 1,
    "PEDRA PARA BRITADOR": 2,
    "BRITAGEM": 3,
    "EXPEDI\u00c7\u00c3O": 4,
    "SERVI\u00c7OS AUXILIARES": 5,
    "ADMINISTRA\u00c7\u00c3O": 6,
  };

  const gruposOrdenados = Object.values(gruposMap)
    .sort((a, b) => (ORDEM_GRUPOS[a.grupoNome] ?? 99) - (ORDEM_GRUPOS[b.grupoNome] ?? 99))
    .map(g => ({
      ...g,
      subsetores: [...g.subsetores].sort(
        (a: any, b: any) => parseFloat(b.totalGeral ?? "0") - parseFloat(a.totalGeral ?? "0")
      ),
    }));

  return {
    grupos: gruposOrdenados,
    totalGeral: rateio.totalGeral,
    totalCustoTon: 0,
    lancamentos: gruposOrdenados.flatMap(g => g.subsetores),
    fonte: "rateio_mem" as const,
  };
}

/**
 * Injeta despesas MSET calculadas on-the-fly no resultado sintético.
 * Soma os valores das despesas setoriais ao totalDespesa/totalGeral de cada subsetor.
 */
function injetarDespesasMsetNoSintetico(
  sintetico: {
    grupos: any[];
    totalGeral: number;
    totalCustoTon: number;
    lancamentos: any[];
    fonte: string;
  },
  mset: RateioMsetResult
) {
  const ORDEM_GRUPOS: Record<string, number> = {
    "DESMONTE DE ROCHA": 1,
    "PEDRA PARA BRITADOR": 2,
    "BRITAGEM": 3,
    "EXPEDI\u00c7\u00c3O": 4,
    "SERVI\u00c7OS AUXILIARES": 5,
    "ADMINISTRA\u00c7\u00c3O": 6,
  };

  // Criar mapa de subsetores existentes no sintético
  const subsetoresMap = new Map<string, any>();
  for (const grupo of sintetico.grupos) {
    for (const sub of grupo.subsetores) {
      subsetoresMap.set(`${grupo.grupoNome}||${sub.subsetorNome}`, { sub, grupo });
    }
  }

  let virtualId = 800000;

  for (const [subsetorNome, subData] of Object.entries(mset.porSubsetor)) {
    const key = `${subData.grupoNome}||${subData.subsetorNome}`;
    const existing = subsetoresMap.get(key);

    const despesaTotal = subData.total;

    if (existing) {
      // Somar ao subsetor existente
      const sub = existing.sub;
      const grupo = existing.grupo;
      const oldDespesa = parseFloat(sub.totalDespesa ?? "0");
      const oldGeral = parseFloat(sub.totalGeral ?? "0");

      sub.totalDespesa = (oldDespesa + despesaTotal).toFixed(2);
      sub.despesaVariavel = (parseFloat(sub.despesaVariavel ?? "0") + despesaTotal).toFixed(2);
      sub.totalGeral = (oldGeral + despesaTotal).toFixed(2);

      grupo.subtotalDespesa += despesaTotal;
      grupo.subtotalGeral += despesaTotal;
    } else {
      // Criar novo subsetor
      const lancVirtual = {
        id: virtualId++,
        periodoCustoId: 0,
        grupoNome: subData.grupoNome,
        subsetorNome: subData.subsetorNome,
        setorId: null,
        custoFixo: "0",
        custoVariavel: "0",
        totalCusto: "0",
        despesaFixa: "0",
        despesaVariavel: despesaTotal.toFixed(2),
        totalDespesa: despesaTotal.toFixed(2),
        totalGeral: despesaTotal.toFixed(2),
        custoTon: "0",
        percentualTotal: "0",
        ordemExibicao: 0,
        userId: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Encontrar ou criar o grupo
      let grupo = sintetico.grupos.find((g: any) => g.grupoNome === subData.grupoNome);
      if (!grupo) {
        grupo = {
          grupoNome: subData.grupoNome,
          subsetores: [],
          subtotalCusto: 0,
          subtotalDespesa: 0,
          subtotalGeral: 0,
          subtotalCustoTon: 0,
        };
        sintetico.grupos.push(grupo);
      }
      grupo.subsetores.push(lancVirtual);
      grupo.subtotalDespesa += despesaTotal;
      grupo.subtotalGeral += despesaTotal;

      sintetico.lancamentos.push(lancVirtual);
    }
  }

  // Recalcular totalGeral e percentuais
  sintetico.totalGeral = sintetico.grupos.reduce(
    (s: number, g: any) => s + g.subtotalGeral,
    0
  );

  // Recalcular percentuais de cada subsetor
  for (const grupo of sintetico.grupos) {
    for (const sub of grupo.subsetores) {
      const geral = parseFloat(sub.totalGeral ?? "0");
      sub.percentualTotal = sintetico.totalGeral > 0
        ? ((geral / sintetico.totalGeral) * 100).toFixed(4)
        : "0";
    }
    // Reordenar subsetores por totalGeral decrescente
    grupo.subsetores.sort(
      (a: any, b: any) => parseFloat(b.totalGeral ?? "0") - parseFloat(a.totalGeral ?? "0")
    );
  }

  // Reordenar grupos
  sintetico.grupos.sort(
    (a: any, b: any) => (ORDEM_GRUPOS[a.grupoNome] ?? 99) - (ORDEM_GRUPOS[b.grupoNome] ?? 99)
  );

  // Atualizar lancamentos
  sintetico.lancamentos = sintetico.grupos.flatMap((g: any) => g.subsetores);
}

export const custoSetorRouter = router({
  // Listar todos os lançamentos de custo por setor de um período
  listarPorPeriodo: protectedProcedure
    .input(z.object({ periodoCustoId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return await db
        .select()
        .from(custoSetor)
        .where(eq(custoSetor.periodoCustoId, input.periodoCustoId))
        .orderBy(asc(custoSetor.ordemExibicao), asc(custoSetor.grupoNome), asc(custoSetor.subsetorNome));
    }),

  // Upsert (criar ou atualizar) um lançamento de custo por setor
  upsert: protectedProcedure
    .input(
      z.object({
        periodoCustoId: z.number(),
        grupoNome: z.string(),
        subsetorNome: z.string(),
        setorId: z.number().optional().nullable(),
        custoFixo: z.number().default(0),
        custoVariavel: z.number().default(0),
        totalCusto: z.number().default(0),
        despesaFixa: z.number().default(0),
        despesaVariavel: z.number().default(0),
        totalDespesa: z.number().default(0),
        totalGeral: z.number().default(0),
        custoTon: z.number().default(0),
        percentualTotal: z.number().default(0),
        ordemExibicao: z.number().default(0),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      // Verificar se já existe
      const [existing] = await db
        .select({ id: custoSetor.id })
        .from(custoSetor)
        .where(
          and(
            eq(custoSetor.periodoCustoId, input.periodoCustoId),
            eq(custoSetor.subsetorNome, input.subsetorNome)
          )
        )
        .limit(1);

      const data = {
        periodoCustoId: input.periodoCustoId,
        grupoNome: input.grupoNome,
        subsetorNome: input.subsetorNome,
        setorId: input.setorId ?? null,
        custoFixo: input.custoFixo.toFixed(2),
        custoVariavel: input.custoVariavel.toFixed(2),
        totalCusto: input.totalCusto.toFixed(2),
        despesaFixa: input.despesaFixa.toFixed(2),
        despesaVariavel: input.despesaVariavel.toFixed(2),
        totalDespesa: input.totalDespesa.toFixed(2),
        totalGeral: input.totalGeral.toFixed(2),
        custoTon: input.custoTon.toFixed(4),
        percentualTotal: input.percentualTotal.toFixed(4),
        ordemExibicao: input.ordemExibicao,
        userId: ctx.user.id,
      };

      if (existing) {
        await db.update(custoSetor).set(data).where(eq(custoSetor.id, existing.id));
        return { id: existing.id, action: "updated" };
      } else {
        const [result] = await db.insert(custoSetor).values(data);
        return { id: (result as any).insertId, action: "created" };
      }
    }),

  // Deletar todos os lançamentos de um período (para reimportação)
  deletarPorPeriodo: protectedProcedure
    .input(z.object({ periodoCustoId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.delete(custoSetor).where(eq(custoSetor.periodoCustoId, input.periodoCustoId));
      return { success: true };
    }),

  // Relatório consolidado por grupo (com subtotais)
  relatorio: protectedProcedure
    .input(z.object({ periodoCustoId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { grupos: [], totalGeral: 0, totalCustoTon: 0, lancamentos: [] };

      const lancamentos = await db
        .select()
        .from(custoSetor)
        .where(eq(custoSetor.periodoCustoId, input.periodoCustoId))
        .orderBy(asc(custoSetor.ordemExibicao), asc(custoSetor.grupoNome), asc(custoSetor.subsetorNome));

      // ─── FALLBACK: Se não há dados importados, gerar sintético a partir do rateio MEM + MSET ───
      if (lancamentos.length === 0) {
        const rateioResult = await calcularRateioMem(input.periodoCustoId);
        if (rateioResult.subsetores.length > 0) {
          const sintetico = convertRateioMemToSintetico(rateioResult);

          // Injetar despesas MSET on-the-fly no sintético
          const msetResult = await calcularRateioMset(input.periodoCustoId);
          if (msetResult.despesas.length > 0) {
            injetarDespesasMsetNoSintetico(sintetico, msetResult);
          }

          // ─── RECONCILIAÇÃO: Garantir que totalGeral = total real (lancamento_custo + salários) ───
          const totalReal = await calcularTotalRealDespesas(input.periodoCustoId);
          const diferenca = totalReal - sintetico.totalGeral;
          if (diferenca > 1) { // Mais de R$ 1 de diferença
            // Adicionar a diferença como "NÃO ALOCADOS" em SERVIÇOS AUXILIARES
            const grupoNome = "SERVI\u00c7OS AUXILIARES";
            const subsetorNome = "N\u00c3O ALOCADOS";
            let grupo = sintetico.grupos.find((g: any) => g.grupoNome === grupoNome);
            if (!grupo) {
              grupo = {
                grupoNome,
                subsetores: [],
                subtotalCusto: 0,
                subtotalDespesa: 0,
                subtotalGeral: 0,
                subtotalCustoTon: 0,
              };
              sintetico.grupos.push(grupo);
            }
            // Verificar se já existe subsetor "NÃO ALOCADOS"
            let subExistente = grupo.subsetores.find((s: any) => s.subsetorNome === subsetorNome);
            if (subExistente) {
              const oldGeral = parseFloat(subExistente.totalGeral ?? "0");
              subExistente.totalGeral = (oldGeral + diferenca).toFixed(2);
              subExistente.custoVariavel = (parseFloat(subExistente.custoVariavel ?? "0") + diferenca).toFixed(2);
              subExistente.totalCusto = (parseFloat(subExistente.totalCusto ?? "0") + diferenca).toFixed(2);
              grupo.subtotalCusto += diferenca;
              grupo.subtotalGeral += diferenca;
            } else {
              const lancVirtual = {
                id: 999999,
                periodoCustoId: 0,
                grupoNome,
                subsetorNome,
                setorId: null,
                custoFixo: "0",
                custoVariavel: diferenca.toFixed(2),
                totalCusto: diferenca.toFixed(2),
                despesaFixa: "0",
                despesaVariavel: "0",
                totalDespesa: "0",
                totalGeral: diferenca.toFixed(2),
                custoTon: "0",
                percentualTotal: "0",
                ordemExibicao: 0,
                userId: 0,
                createdAt: new Date(),
                updatedAt: new Date(),
              };
              grupo.subsetores.push(lancVirtual);
              grupo.subtotalCusto += diferenca;
              grupo.subtotalGeral += diferenca;
              sintetico.lancamentos.push(lancVirtual);
            }

            // Atualizar totalGeral
            sintetico.totalGeral = totalReal;

            // Recalcular percentuais
            for (const g of sintetico.grupos) {
              for (const sub of g.subsetores) {
                const geral = parseFloat(sub.totalGeral ?? "0");
                sub.percentualTotal = sintetico.totalGeral > 0
                  ? ((geral / sintetico.totalGeral) * 100).toFixed(4)
                  : "0";
              }
              g.subsetores.sort(
                (a: any, b: any) => parseFloat(b.totalGeral ?? "0") - parseFloat(a.totalGeral ?? "0")
              );
            }
          }

          return sintetico;
        }
      }

      // Agrupar por grupoNome
      type LancItem = typeof lancamentos[0];
      type Grupo = {
        grupoNome: string;
        subsetores: LancItem[];
        subtotalCusto: number;
        subtotalDespesa: number;
        subtotalGeral: number;
        subtotalCustoTon: number;
      };
      const grupos: Record<string, Grupo> = {};

      for (const l of lancamentos) {
        if (!grupos[l.grupoNome]) {
          grupos[l.grupoNome] = {
            grupoNome: l.grupoNome,
            subsetores: [],
            subtotalCusto: 0,
            subtotalDespesa: 0,
            subtotalGeral: 0,
            subtotalCustoTon: 0,
          };
        }
        grupos[l.grupoNome].subsetores.push(l);
        grupos[l.grupoNome].subtotalCusto += parseFloat(l.totalCusto ?? "0");
        grupos[l.grupoNome].subtotalDespesa += parseFloat(l.totalDespesa ?? "0");
        grupos[l.grupoNome].subtotalGeral += parseFloat(l.totalGeral ?? "0");
        grupos[l.grupoNome].subtotalCustoTon += parseFloat(l.custoTon ?? "0");
      }

      const totalGeral = lancamentos.reduce(
        (s: number, l: LancItem) => s + parseFloat(l.totalGeral ?? "0"),
        0
      );
      const totalCustoTon = lancamentos.reduce(
        (s: number, l: LancItem) => s + parseFloat(l.custoTon ?? "0"),
        0
      );

      // Ordenar subsetores dentro de cada grupo por totalGeral decrescente
      const gruposOrdenados = Object.values(grupos).map((g) => ({
        ...g,
        subsetores: [...g.subsetores].sort(
          (a, b) => parseFloat(b.totalGeral ?? "0") - parseFloat(a.totalGeral ?? "0")
        ),
      }));

      return {
        grupos: gruposOrdenados,
        totalGeral,
        totalCustoTon,
        lancamentos,
      };
    }),
});
