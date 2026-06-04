import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { getDb } from "./db";
import { custoSetorEquipamento, custoSetorDespesa, lancamentoSalario, equipamentos, setores } from "../drizzle/schema";
import { eq, and, asc, inArray } from "drizzle-orm";
import { calcularRateioMem, SETOR_PARA_SUBSETOR_MEM } from "./rateioMem_calc";
import { calcularRateioMset, type RateioMsetResult } from "./rateioMset_calc";

// IDs das contas de salário (espelha salarios_router.ts)
const CONTA_SAL_ADM_ID = 1;
const CONTA_SAL_DIRETORIA_ID = 12;
const CONTA_SAL_OPER_ID = 30004;

import type { RateioMemResult } from "./rateioMem_calc";

/**
 * Converte o resultado do rateio MEM on-the-fly para o formato esperado
 * pelo Relatório Analítico (mesmo shape dos dados importados da planilha MEM).
 */
async function convertRateioMemToAnalitico(
  rateio: RateioMemResult,
) {
  // NOTA: Sal.Adm/Dir NÃO são processados aqui porque o MSET já os inclui
  // e injetarDespesasMsetNoAnalitico() os injeta no relatório. Evita duplicidade.

  // Montar estrutura de grupos/subsetores a partir do rateio MEM
  type SubsetorData = {
    subsetorNome: string;
    grupoNome: string;
    equipamentos: any[];
    despesasEspecificas: any[];
    totalEquipamentos: number;
    totalDespesasEspecificas: number;
    totalSubsetor: number;
  };

  type GrupoData = {
    grupoNome: string;
    subsetores: SubsetorData[];
    totalGrupo: number;
  };

  const subsetoresMap: Record<string, SubsetorData> = {};

  for (const sub of rateio.subsetores) {
    const key = `${sub.grupoNome}||${sub.subsetorNome}`;
    if (!subsetoresMap[key]) {
      subsetoresMap[key] = {
        subsetorNome: sub.subsetorNome,
        grupoNome: sub.grupoNome,
        equipamentos: [],
        despesasEspecificas: [],
        totalEquipamentos: 0,
        totalDespesasEspecificas: 0,
        totalSubsetor: 0,
      };
    }

    for (const equip of sub.equipamentos) {
      // Converter para o formato esperado pelo frontend (mesmo shape de custo_setor_equipamento)
      const equipRow = {
        id: equip.equipamentoId,
        periodoCustoId: 0,
        subsetorNome: sub.subsetorNome,
        grupoNome: sub.grupoNome,
        equipamentoNome: equip.equipamentoTag
          ? `${equip.equipamentoTag} - ${equip.equipamentoNome}`
          : equip.equipamentoNome,
        salOperEncOper: equip.despesas.salOperEncOper.toFixed(2),
        depreciacao: "0",
        combustivel: equip.despesas.combustivel.toFixed(2),
        lubrificantes: equip.despesas.lubrificantes.toFixed(2),
        pecasDesgaste: equip.despesas.pecasDesgaste.toFixed(2),
        pecasReposicao: equip.despesas.pecasReposicao.toFixed(2),
        outrasDespesas: equip.despesas.outrasDespesas.toFixed(2),
        totalDespesasEquipamento: equip.despesas.total.toFixed(2),
        horasTrabalhadas: equip.horasNoSetor.toFixed(2),
        qtdCombustivelLitros: "0",
        producaoTotal: "0",
        unidadeProducao: null,
        ordemExibicao: 0,
        userId: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      subsetoresMap[key].equipamentos.push(equipRow);
      subsetoresMap[key].totalEquipamentos += equip.despesas.total;
    }
  }

  // Calcular totais e agrupar
  const gruposMap: Record<string, GrupoData> = {};

  for (const subsetor of Object.values(subsetoresMap)) {
    subsetor.totalSubsetor = subsetor.totalEquipamentos + subsetor.totalDespesasEspecificas;

    subsetor.equipamentos.sort(
      (a: any, b: any) => parseFloat(b.totalDespesasEquipamento ?? "0") - parseFloat(a.totalDespesasEquipamento ?? "0")
    );
    subsetor.despesasEspecificas.sort(
      (a: any, b: any) => parseFloat(b.valor ?? "0") - parseFloat(a.valor ?? "0")
    );

    if (!gruposMap[subsetor.grupoNome]) {
      gruposMap[subsetor.grupoNome] = {
        grupoNome: subsetor.grupoNome,
        subsetores: [],
        totalGrupo: 0,
      };
    }
    gruposMap[subsetor.grupoNome].subsetores.push(subsetor);
    gruposMap[subsetor.grupoNome].totalGrupo += subsetor.totalSubsetor;
  }

  const totalGeral = Object.values(gruposMap).reduce((s, g) => s + g.totalGrupo, 0);

  const ORDEM_GRUPOS: Record<string, number> = {
    "DESMONTE DE ROCHA": 1,
    "PEDRA PARA BRITADOR": 2,
    "BRITAGEM": 3,
    "EXPEDIÇÃO": 4,
    "SERVIÇOS AUXILIARES": 5,
    "ADMINISTRAÇÃO": 6,
  };

  const grupos = Object.values(gruposMap).sort(
    (a, b) => (ORDEM_GRUPOS[a.grupoNome] ?? 99) - (ORDEM_GRUPOS[b.grupoNome] ?? 99)
  );

  return { grupos, totalGeral, fonte: "rateio_mem" as const };
}

// Mapeamento setor operacional (tabela setores) → subsetor do relatório analítico
const SETOR_PARA_SUBSETOR: Record<string, { subsetor: string; grupo: string }> = {
  "ADMINISTRACAO": { subsetor: "ADMINISTRAÇÃO", grupo: "ADMINISTRAÇÃO" },
  "ADMINISTRAÇÃO": { subsetor: "ADMINISTRAÇÃO", grupo: "ADMINISTRAÇÃO" },
  "BRITAGEM PRIMÁRIA": { subsetor: "BRITAGEM PRIMÁRIA", grupo: "BRITAGEM" },
  "BRITAGEM SECUNDÁRIA": { subsetor: "BRITAGEM SEC./TERC./QUART.", grupo: "BRITAGEM" },
  "BRITAGEM TERCEÁRIA": { subsetor: "BRITAGEM SEC./TERC./QUART.", grupo: "BRITAGEM" },
  "BRITAGEM QUARTENÁRIA": { subsetor: "BRITAGEM SEC./TERC./QUART.", grupo: "BRITAGEM" },
  "BRITAGEM MÓVEL": { subsetor: "BRITAGEM SEC./TERC./QUART.", grupo: "BRITAGEM" },
  "DESMONTE PRIMÁRIO": { subsetor: "DESMONTE PRIMÁRIO", grupo: "DESMONTE DE ROCHA" },
  "DESMONTE SECUNDÁRIO": { subsetor: "DESMONTE SECUNDÁRIO", grupo: "DESMONTE DE ROCHA" },
  "DECAPEAMENTO": { subsetor: "DECAPEAMENTO", grupo: "DESMONTE DE ROCHA" },
  "CARGA E TRANSPORTE DE PEDRA DA MINA": { subsetor: "PEDRA PARA BRITADOR", grupo: "PEDRA PARA BRITADOR" },
  "EXPEDIÇÃO": { subsetor: "EXPEDIÇÃO", grupo: "EXPEDIÇÃO" },
  "MOVIMENTAÇÃO DE ESTOQUE": { subsetor: "MOV. DE ESTOQUE", grupo: "EXPEDIÇÃO" },
  "OFICINA": { subsetor: "OFICINA E ALMOXARIFADO", grupo: "SERVIÇOS AUXILIARES" },
  "ALMOXARIFADO": { subsetor: "OFICINA E ALMOXARIFADO", grupo: "SERVIÇOS AUXILIARES" },
  "OUTROS SERVIÇOS AUXILIARES": { subsetor: "OUTROS SERVIÇOS", grupo: "SERVIÇOS AUXILIARES" },
  "REFEITÓRIO": { subsetor: "REFEITÓRIO E LIMPEZA", grupo: "SERVIÇOS AUXILIARES" },
  "LIMPEZA": { subsetor: "REFEITÓRIO E LIMPEZA", grupo: "SERVIÇOS AUXILIARES" },
  "ALIMENTAÇÃO": { subsetor: "REFEITÓRIO E LIMPEZA", grupo: "SERVIÇOS AUXILIARES" },
  "INDIRETAS": { subsetor: "DESPESAS INDIRETAS", grupo: "ADMINISTRAÇÃO" },
  "DESPESAS INDIRETAS": { subsetor: "DESPESAS INDIRETAS", grupo: "ADMINISTRAÇÃO" },
};

/**
 * Injeta despesas MSET calculadas on-the-fly no resultado do relatório analítico.
 * Adiciona como despesasEspecificas virtuais nos subsetores correspondentes.
 */
function injetarDespesasMsetNoAnalitico(
  analitico: { grupos: any[]; totalGeral: number; fonte: string },
  mset: RateioMsetResult
) {
  // Criar mapa de subsetores existentes no analítico
  const subsetoresMap = new Map<string, any>();
  for (const grupo of analitico.grupos) {
    for (const sub of grupo.subsetores) {
      subsetoresMap.set(`${sub.grupoNome}||${sub.subsetorNome}`, sub);
    }
  }

  let virtualIdCounter = -5000;

  for (const [subsetorNome, subData] of Object.entries(mset.porSubsetor)) {
    const key = `${subData.grupoNome}||${subData.subsetorNome}`;
    let subsetor = subsetoresMap.get(key);

    // Se o subsetor não existe no analítico, criar um novo
    if (!subsetor) {
      subsetor = {
        subsetorNome: subData.subsetorNome,
        grupoNome: subData.grupoNome,
        equipamentos: [],
        despesasEspecificas: [],
        totalEquipamentos: 0,
        totalDespesasEspecificas: 0,
        totalSubsetor: 0,
      };
      subsetoresMap.set(key, subsetor);

      // Encontrar ou criar o grupo
      let grupo = analitico.grupos.find((g: any) => g.grupoNome === subData.grupoNome);
      if (!grupo) {
        grupo = {
          grupoNome: subData.grupoNome,
          subsetores: [],
          totalGrupo: 0,
        };
        analitico.grupos.push(grupo);
      }
      grupo.subsetores.push(subsetor);
    }

    // Adicionar cada despesa MSET como despesa específica virtual
    for (const desp of subData.despesas) {
      const virtualDesp = {
        id: virtualIdCounter--,
        periodoCustoId: 0,
        subsetorNome: desp.subsetorNome,
        grupoNome: desp.grupoNome,
        descricao: desp.descricao,
        valor: desp.valor.toFixed(2),
        ordemExibicao: desp.ordemExibicao,
        userId: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      subsetor.despesasEspecificas.push(virtualDesp);
      subsetor.totalDespesasEspecificas += desp.valor;
    }

    // Recalcular total do subsetor
    subsetor.totalSubsetor = subsetor.totalEquipamentos + subsetor.totalDespesasEspecificas;

    // Reordenar despesas por valor decrescente
    subsetor.despesasEspecificas.sort(
      (a: any, b: any) => parseFloat(b.valor ?? "0") - parseFloat(a.valor ?? "0")
    );
  }

  // Recalcular totais dos grupos e total geral
  let novoTotalGeral = 0;
  for (const grupo of analitico.grupos) {
    grupo.totalGrupo = grupo.subsetores.reduce(
      (s: number, sub: any) => s + sub.totalSubsetor,
      0
    );
    novoTotalGeral += grupo.totalGrupo;
  }
  analitico.totalGeral = novoTotalGeral;
}

export const custoSetorRasRouter = router({
  // Listar equipamentos de um período e subsetor específico
  listarEquipamentosPorSubsetor: protectedProcedure
    .input(
      z.object({
        periodoCustoId: z.number(),
        subsetorNome: z.string(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return await db
        .select()
        .from(custoSetorEquipamento)
        .where(
          and(
            eq(custoSetorEquipamento.periodoCustoId, input.periodoCustoId),
            eq(custoSetorEquipamento.subsetorNome, input.subsetorNome)
          )
        )
        .orderBy(asc(custoSetorEquipamento.ordemExibicao));
    }),

  // Listar todos os equipamentos de um período
  listarEquipamentosPorPeriodo: protectedProcedure
    .input(z.object({ periodoCustoId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return await db
        .select()
        .from(custoSetorEquipamento)
        .where(eq(custoSetorEquipamento.periodoCustoId, input.periodoCustoId))
        .orderBy(
          asc(custoSetorEquipamento.grupoNome),
          asc(custoSetorEquipamento.subsetorNome),
          asc(custoSetorEquipamento.ordemExibicao)
        );
    }),

  // Listar despesas específicas de um período e subsetor
  listarDespesasPorSubsetor: protectedProcedure
    .input(
      z.object({
        periodoCustoId: z.number(),
        subsetorNome: z.string(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return await db
        .select()
        .from(custoSetorDespesa)
        .where(
          and(
            eq(custoSetorDespesa.periodoCustoId, input.periodoCustoId),
            eq(custoSetorDespesa.subsetorNome, input.subsetorNome)
          )
        )
        .orderBy(asc(custoSetorDespesa.ordemExibicao));
    }),

  // Listar todas as despesas de um período
  listarDespesasPorPeriodo: protectedProcedure
    .input(z.object({ periodoCustoId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return await db
        .select()
        .from(custoSetorDespesa)
        .where(eq(custoSetorDespesa.periodoCustoId, input.periodoCustoId))
        .orderBy(
          asc(custoSetorDespesa.grupoNome),
          asc(custoSetorDespesa.subsetorNome),
          asc(custoSetorDespesa.ordemExibicao)
        );
    }),

  // Relatório analítico completo por período
  // Retorna todos os subsetores com seus equipamentos e despesas específicas
  relatorioAnalitico: protectedProcedure
    .input(z.object({ periodoCustoId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { grupos: [], totalGeral: 0 };

      const [equipRows, despesas, salarioRows] = await Promise.all([
        db
          .select()
          .from(custoSetorEquipamento)
          .where(eq(custoSetorEquipamento.periodoCustoId, input.periodoCustoId))
          .orderBy(
            asc(custoSetorEquipamento.grupoNome),
            asc(custoSetorEquipamento.subsetorNome),
            asc(custoSetorEquipamento.ordemExibicao)
          ),
        db
          .select()
          .from(custoSetorDespesa)
          .where(eq(custoSetorDespesa.periodoCustoId, input.periodoCustoId))
          .orderBy(
            asc(custoSetorDespesa.grupoNome),
            asc(custoSetorDespesa.subsetorNome),
            asc(custoSetorDespesa.ordemExibicao)
          ),
        // Buscar lançamentos manuais de salário do período
        db
          .select({
            id: lancamentoSalario.id,
            contaCustoId: lancamentoSalario.contaCustoId,
            valor: lancamentoSalario.valor,
            equipamentoId: lancamentoSalario.equipamentoId,
            setorId: lancamentoSalario.setorId,
            descricao: lancamentoSalario.descricao,
          })
          .from(lancamentoSalario)
          .where(eq(lancamentoSalario.periodoCustoId, input.periodoCustoId)),
      ]);

      // ─── FALLBACK: Se não há dados importados (MEM), usar cálculo on-the-fly ───
      if (equipRows.length === 0) {
        const rateioResult = await calcularRateioMem(input.periodoCustoId);
        if (rateioResult.subsetores.length > 0) {
          // Converter resultado do rateio MEM para o formato do relatório analítico
          const analitico = await convertRateioMemToAnalitico(rateioResult);

          // Injetar despesas MSET on-the-fly (se não há dados importados na custo_setor_despesa)
          if (despesas.length === 0) {
            const msetResult = await calcularRateioMset(input.periodoCustoId);
            if (msetResult.despesas.length > 0) {
              injetarDespesasMsetNoAnalitico(analitico, msetResult);
            }
          }

          return analitico;
        }
      }

      // --- Processar salários manuais ---
      // Buscar nomes de equipamentos e setores referenciados
      const salEquipIds = salarioRows.filter(r => r.equipamentoId).map(r => r.equipamentoId!);
      const salSetorIds = salarioRows.filter(r => r.setorId).map(r => r.setorId!);

      let equipNomeMap = new Map<number, string>();
      let setorNomeMap = new Map<number, string>();

      if (salEquipIds.length > 0) {
        const eqs = await db.select({ id: equipamentos.id, nomeDoEquipamento: equipamentos.nomeDoEquipamento, codigoTag: equipamentos.codigoTag }).from(equipamentos);
        for (const e of eqs) {
          equipNomeMap.set(e.id, e.codigoTag ? `${e.codigoTag} - ${e.nomeDoEquipamento}` : e.nomeDoEquipamento);
        }
      }

      if (salSetorIds.length > 0) {
        const secs = await db.select({ id: setores.id, nome: setores.nome }).from(setores);
        for (const s of secs) {
          setorNomeMap.set(s.id, s.nome);
        }
      }

      // Sal.Oper. → somar ao salOperEncOper do equipamento no relatório
      // Criar mapa equipamentoNome → valor adicional de salário
      const salOperPorEquipNome = new Map<string, number>();
      for (const sal of salarioRows) {
        if (sal.contaCustoId === CONTA_SAL_OPER_ID && sal.equipamentoId) {
          const nomeEquip = equipNomeMap.get(sal.equipamentoId) ?? "";
          if (nomeEquip) {
            salOperPorEquipNome.set(nomeEquip, (salOperPorEquipNome.get(nomeEquip) ?? 0) + parseFloat(sal.valor));
          }
        }
      }

      // Sal.Adm./Sal.Diretoria → adicionar como despesas específicas virtuais
      // Agrupar por subsetor
      const salDespPorSubsetor = new Map<string, { subsetor: string; grupo: string; valor: number; descricao: string }[]>();
      for (const sal of salarioRows) {
        if ((sal.contaCustoId === CONTA_SAL_ADM_ID || sal.contaCustoId === CONTA_SAL_DIRETORIA_ID) && sal.setorId) {
          const setorNome = setorNomeMap.get(sal.setorId);
          if (!setorNome) continue;
          const mapping = SETOR_PARA_SUBSETOR[setorNome.toUpperCase()];
          if (!mapping) continue;
          const key = `${mapping.grupo}||${mapping.subsetor}`;
          if (!salDespPorSubsetor.has(key)) salDespPorSubsetor.set(key, []);
          salDespPorSubsetor.get(key)!.push({
            subsetor: mapping.subsetor,
            grupo: mapping.grupo,
            valor: parseFloat(sal.valor),
            descricao: sal.contaCustoId === CONTA_SAL_ADM_ID
              ? "Sal.Adm./Almox./Ofic./Serv.Aux./Encargos [Manual]"
              : "Sal. Diretoria/Pró-Labore [Manual]",
          });
        }
      }

      // Agrupar por grupo → subsetor
      type EquipItem = typeof equipRows[0];
      type DespItem = typeof despesas[0];

      type SubsetorData = {
        subsetorNome: string;
        grupoNome: string;
        equipamentos: EquipItem[];
        despesasEspecificas: DespItem[];
        totalEquipamentos: number;
        totalDespesasEspecificas: number;
        totalSubsetor: number;
      };

      type GrupoData = {
        grupoNome: string;
        subsetores: SubsetorData[];
        totalGrupo: number;
      };

      const gruposMap: Record<string, GrupoData> = {};
      const subsetoresMap: Record<string, SubsetorData> = {};

      // Processar equipamentos (com salários manuais somados ao salOperEncOper)
      for (const equip of equipRows) {
        const key = `${equip.grupoNome}||${equip.subsetorNome}`;

        if (!subsetoresMap[key]) {
          subsetoresMap[key] = {
            subsetorNome: equip.subsetorNome,
            grupoNome: equip.grupoNome,
            equipamentos: [],
            despesasEspecificas: [],
            totalEquipamentos: 0,
            totalDespesasEspecificas: 0,
            totalSubsetor: 0,
          };
        }

        // Somar salário manual ao salOperEncOper se houver
        const salExtra = salOperPorEquipNome.get(equip.equipamentoNome) ?? 0;
        let equipAjustado = equip;
        if (salExtra > 0) {
          const novoSal = parseFloat(equip.salOperEncOper ?? "0") + salExtra;
          const novoTotal = parseFloat(equip.totalDespesasEquipamento ?? "0") + salExtra;
          equipAjustado = {
            ...equip,
            salOperEncOper: novoSal.toFixed(2),
            totalDespesasEquipamento: novoTotal.toFixed(2),
          };
        }

        subsetoresMap[key].equipamentos.push(equipAjustado);
        subsetoresMap[key].totalEquipamentos += parseFloat(
          equipAjustado.totalDespesasEquipamento ?? "0"
        );
      }

      // Processar despesas específicas
      for (const desp of despesas) {
        const key = `${desp.grupoNome}||${desp.subsetorNome}`;

        if (!subsetoresMap[key]) {
          subsetoresMap[key] = {
            subsetorNome: desp.subsetorNome,
            grupoNome: desp.grupoNome,
            equipamentos: [],
            despesasEspecificas: [],
            totalEquipamentos: 0,
            totalDespesasEspecificas: 0,
            totalSubsetor: 0,
          };
        }

        subsetoresMap[key].despesasEspecificas.push(desp);
        subsetoresMap[key].totalDespesasEspecificas += parseFloat(desp.valor ?? "0");
      }

      // Adicionar salários manuais (Sal.Adm./Sal.Diretoria) como despesas específicas virtuais
      for (const [key, salItems] of Array.from(salDespPorSubsetor.entries())) {
        // Agrupar por descrição (conta) para somar valores
        const porDescricao = new Map<string, number>();
        for (const item of salItems) {
          porDescricao.set(item.descricao, (porDescricao.get(item.descricao) ?? 0) + item.valor);
        }

        const firstItem = salItems[0];
        if (!subsetoresMap[key]) {
          subsetoresMap[key] = {
            subsetorNome: firstItem.subsetor,
            grupoNome: firstItem.grupo,
            equipamentos: [],
            despesasEspecificas: [],
            totalEquipamentos: 0,
            totalDespesasEspecificas: 0,
            totalSubsetor: 0,
          };
        }

        for (const [descricao, valor] of Array.from(porDescricao.entries())) {
          // Criar uma despesa virtual com ID negativo para não conflitar
          const virtualDesp = {
            id: -(subsetoresMap[key].despesasEspecificas.length + 1000),
            periodoCustoId: input.periodoCustoId,
            subsetorNome: firstItem.subsetor,
            grupoNome: firstItem.grupo,
            descricao,
            valor: valor.toFixed(2),
            ordemExibicao: 999,
            userId: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          } as DespItem;

          subsetoresMap[key].despesasEspecificas.push(virtualDesp);
          subsetoresMap[key].totalDespesasEspecificas += valor;
        }
      }

      // Calcular totais dos subsetores e agrupar por grupo
      for (const subsetor of Object.values(subsetoresMap)) {
        subsetor.totalSubsetor =
          subsetor.totalEquipamentos + subsetor.totalDespesasEspecificas;

        // Ordenar equipamentos por totalDespesasEquipamento decrescente
        subsetor.equipamentos.sort(
          (a, b) =>
            parseFloat(b.totalDespesasEquipamento ?? "0") -
            parseFloat(a.totalDespesasEquipamento ?? "0")
        );

        // Ordenar despesas específicas por valor decrescente
        subsetor.despesasEspecificas.sort(
          (a, b) => parseFloat(b.valor ?? "0") - parseFloat(a.valor ?? "0")
        );

        if (!gruposMap[subsetor.grupoNome]) {
          gruposMap[subsetor.grupoNome] = {
            grupoNome: subsetor.grupoNome,
            subsetores: [],
            totalGrupo: 0,
          };
        }

        gruposMap[subsetor.grupoNome].subsetores.push(subsetor);
        gruposMap[subsetor.grupoNome].totalGrupo += subsetor.totalSubsetor;
      }

      const totalGeral = Object.values(gruposMap).reduce(
        (s, g) => s + g.totalGrupo,
        0
      );

      // Ordenar grupos e subsetores
      const ORDEM_GRUPOS: Record<string, number> = {
        "DESMONTE DE ROCHA": 1,
        "CARGA E TRANSPORTE": 2,
        BRITAGEM: 3,
        "EXPEDIÇÃO": 4,
        "SERVIÇOS AUXILIARES": 5,
        "ADMINISTRAÇÃO": 6,
      };

      const grupos = Object.values(gruposMap).sort(
        (a, b) =>
          (ORDEM_GRUPOS[a.grupoNome] ?? 99) - (ORDEM_GRUPOS[b.grupoNome] ?? 99)
      );

      return { grupos, totalGeral };
    }),

  // Distribuição de uma conta específica (ex: Energia Elétrica) por subsetor
  despesasPorDescricao: protectedProcedure
    .input(
      z.object({
        periodoCustoId: z.number(),
        descricao: z.string(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { subsetores: [], total: 0 };

      // Mapeamento de nomes do MEMGERAL para nomes no MSET (quando diferem)
      const MEMGERAL_TO_MSET: Record<string, string> = {
        "Despesas Administrativas": "Desp.Admin.Telef.e Inform.",
        "Consultorias Especializadas": "Juridíco/Cons.Esp./Serv.Ter.",
        "Equipamentos de Apoio": "Equip.Apoio (Comb./Lub/Peças/Serv.)",
        "Outras Despesas de Setores": "Outras Desp.Setor/Proc.",
        "Sal.Adm./Almox./Ofic./Serv.Aux./Encargos": "Sal.Adm./Almox./Ofic./Serv.Aux./Encargos",
        "Impostos, CEFEM e Outras Taxas": "Imp., Trib., Taxas e CEFEM",
        // Corrigir variações de acento
        "Jurídico/Cons.Esp./Serv.Ter.": "Jurídco/Cons.Esp./Serv.Ter.",
      };
      const descricaoBusca = MEMGERAL_TO_MSET[input.descricao] ?? input.descricao;

      const rows = await db
        .select()
        .from(custoSetorDespesa)
        .where(
          and(
            eq(custoSetorDespesa.periodoCustoId, input.periodoCustoId),
            eq(custoSetorDespesa.descricao, descricaoBusca)
          )
        )
        .orderBy(asc(custoSetorDespesa.ordemExibicao));

      // Se não há dados importados, tentar fallback MSET on-the-fly
      if (rows.length === 0) {
        const msetResult = await calcularRateioMset(input.periodoCustoId);
        // Filtrar despesas que correspondem à descrição buscada
        const msetRows = msetResult.despesas.filter(d => d.descricao === descricaoBusca);
        if (msetRows.length > 0) {
          msetRows.sort((a, b) => b.valor - a.valor);
          const total = msetRows.reduce((s, r) => s + r.valor, 0);
          return {
            subsetores: msetRows.map(r => ({
              subsetorNome: r.subsetorNome,
              grupoNome: r.grupoNome,
              valor: r.valor,
            })),
            total,
          };
        }
      }

      // Ordenar por valor decrescente
      rows.sort((a, b) => parseFloat(b.valor ?? "0") - parseFloat(a.valor ?? "0"));

      const total = rows.reduce((s, r) => s + parseFloat(r.valor ?? "0"), 0);

      return {
        subsetores: rows.map((r) => ({
          subsetorNome: r.subsetorNome,
          grupoNome: r.grupoNome,
          valor: parseFloat(r.valor ?? "0"),
        })),
        total,
      };
    }),

  // Deletar todos os dados RAS de um período (para reimportação)
  deletarPorPeriodo: protectedProcedure
    .input(z.object({ periodoCustoId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await Promise.all([
        db
          .delete(custoSetorEquipamento)
          .where(eq(custoSetorEquipamento.periodoCustoId, input.periodoCustoId)),
        db
          .delete(custoSetorDespesa)
          .where(eq(custoSetorDespesa.periodoCustoId, input.periodoCustoId)),
      ]);
      return { success: true };
    }),
});
