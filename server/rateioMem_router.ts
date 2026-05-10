/**
 * Router de Rateio MEM (Memória de Cálculo dos Equipamentos)
 * 
 * Calcula on-the-fly a distribuição das despesas de cada equipamento
 * pelos setores onde trabalhou, usando como critério de rateio a
 * proporção de horas trabalhadas em cada setor (derivada dos itens
 * da parte diária).
 * 
 * Fonte de dados:
 *   - Horas: parte_diaria + parte_diaria_itens (proporção por quantidade)
 *   - Despesas: item_despesa_importado (por equipamentoTag)
 *   - Salários Operacionais: lancamento_salario (conta 30004, por equipamentoId)
 * 
 * Mapeamento equipamentoTag → equipamentoId:
 *   Reutiliza CORRESPONDENCIAS_APROVADAS e CORRESPONDENCIAS_FORCADAS
 *   do módulo de importação de despesas.
 */

import { z } from "zod";
import { router, protectedProcedure, requirePermission } from "./_core/trpc";
import { getDb } from "./db";
import {
  equipamentos,
  setores,
  parteDiaria,
  parteDiariaItens,
  itemDespesaImportado,
  lancamentoSalario,
  gruposDeEquipamentos,
  periodoCusto,
} from "../drizzle/schema";
import { eq, and, inArray, isNotNull, or, like } from "drizzle-orm";
import {
  CORRESPONDENCIAS_APROVADAS,
  CORRESPONDENCIAS_FORCADAS,
  TAGS_OUTRAS_DESP_SETOR,
  TAGS_NAO_LANCAR,
  TAGS_EXCLUIR,
} from "./importDespesas_correspondencias";

// ─── Constantes ─────────────────────────────────────────────────────────────

const CONTA_SAL_OPER_ID = 30004;

// Mapeamento de setores do sistema para subsetores MEM
const SETOR_PARA_SUBSETOR_MEM: Record<string, { subsetor: string; grupo: string }> = {
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
  "INDIRETAS": { subsetor: "ADMINISTRAÇÃO", grupo: "ADMINISTRAÇÃO" },
};

// Classificações de despesas importadas → campo MEM
const CLASSIFICACAO_PARA_CAMPO: Record<string, string> = {
  "combustivel": "combustivel",
  "lubrificantes": "lubrificantes",
  "pecas_desgaste": "pecasDesgaste",
  "pecas_reposicao": "pecasReposicao",
  "outras_despesas": "outrasDespesas",
};

// Equipamentos especiais: BALANÇA INTEGRADORA PRIMÁRIO → BRITAGEM PRIMÁRIA
const EQUIPAMENTO_SETOR_FIXO: Record<number, string> = {
  60001: "BRITAGEM PRIMÁRIA", // BALANÇA INTEGRADORA PRIMÁRIO
};

// Grupos a excluir do rateio (ENTREGA DE MATERIAL, BALANÇA)
const NOMES_GRUPOS_EXCLUIDOS = ['ENTREGA DE MATERIAL', 'BALANÇA', 'BALANCA'];

// ─── Helpers ────────────────────────────────────────────────────────────────

function extractDateStr(d: unknown): string {
  if (d instanceof Date) return d.toISOString().split('T')[0];
  const s = String(d);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (s.includes('T')) return s.split('T')[0];
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
  return s;
}

function getMesDates(mes: number, ano: number) {
  const dataInicio = `${ano}-${String(mes).padStart(2, "0")}-01`;
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const dataFim = `${ano}-${String(mes).padStart(2, "0")}-${String(ultimoDia).padStart(2, "0")}`;
  return { dataInicio, dataFim };
}

/**
 * Resolve equipamentoTag → equipamentoId usando as correspondências aprovadas
 * e forçadas do módulo de importação, mais matching por codigoTag.
 */
function buildTagToIdMap(
  equipsList: { id: number; codigoTag: string | null; nomeDoEquipamento: string }[]
): Map<string, number> {
  const map = new Map<string, number>();

  // 1. Correspondências forçadas (prioridade máxima)
  for (const [tag, info] of Object.entries(CORRESPONDENCIAS_FORCADAS)) {
    map.set(tag.toUpperCase(), info.equipamentoId);
  }

  // 2. Correspondências aprovadas
  for (const [tag, id] of Object.entries(CORRESPONDENCIAS_APROVADAS)) {
    map.set(tag.toUpperCase(), id);
  }

  // 3. Matching por codigoTag exato
  for (const equip of equipsList) {
    if (equip.codigoTag) {
      map.set(equip.codigoTag.toUpperCase(), equip.id);
    }
  }

  return map;
}

// ─── Interfaces de resultado ────────────────────────────────────────────────

interface DespesasEquipamento {
  salOperEncOper: number;
  combustivel: number;
  lubrificantes: number;
  pecasDesgaste: number;
  pecasReposicao: number;
  outrasDespesas: number;
  total: number;
}

interface EquipamentoRateado {
  equipamentoId: number;
  equipamentoNome: string;
  equipamentoTag: string;
  horasTotal: number;
  horasNoSetor: number;
  percentual: number; // 0-100
  despesas: DespesasEquipamento;
}

interface SubsetorMem {
  subsetorNome: string;
  grupoNome: string;
  equipamentos: EquipamentoRateado[];
  totalSubsetor: number;
  totalHoras: number;
}

// ─── Router ─────────────────────────────────────────────────────────────────

export const rateioMemRouter = router({
  /**
   * Calcula o rateio MEM completo para um período.
   * Retorna os dados agrupados por subsetor MEM com equipamentos e despesas rateadas.
   */
  calcularRateio: protectedProcedure
    .input(z.object({
      periodoCustoId: z.number(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { subsetores: [], totalGeral: 0, equipamentosSemRateio: [] };

      // 1. Buscar período para obter mês/ano
      const [periodo] = await db
        .select({ id: periodoCusto.id, mes: periodoCusto.mes, ano: periodoCusto.ano })
        .from(periodoCusto)
        .where(eq(periodoCusto.id, input.periodoCustoId));

      if (!periodo) return { subsetores: [], totalGeral: 0, equipamentosSemRateio: [] };

      const { dataInicio, dataFim } = getMesDates(periodo.mes, periodo.ano);

      // 2. Buscar grupos excluídos
      const gruposExcluidos = await db
        .select({ id: gruposDeEquipamentos.id })
        .from(gruposDeEquipamentos)
        .where(or(
          ...NOMES_GRUPOS_EXCLUIDOS.map(n => like(gruposDeEquipamentos.nome, `%${n}%`))
        ));
      const idsGruposExcluidos = new Set(gruposExcluidos.map(g => g.id));

      // 3. Buscar todos os equipamentos
      const equipsList = await db
        .select({
          id: equipamentos.id,
          codigoTag: equipamentos.codigoTag,
          nomeDoEquipamento: equipamentos.nomeDoEquipamento,
          grupoId: equipamentos.grupoId,
        })
        .from(equipamentos);

      const equipMap = new Map(equipsList.map(e => [e.id, e]));
      const tagToIdMap = buildTagToIdMap(equipsList);

      // 4. Buscar setores
      const setoresRows = await db.select({ id: setores.id, nome: setores.nome }).from(setores);
      const setoresMap = new Map(setoresRows.map(s => [s.id, s.nome]));

      // 5. Buscar partes diárias do período com horas
      const registros = await db
        .select({
          id: parteDiaria.id,
          equipamentoId: parteDiaria.equipamentoId,
          horaKmTrabalhados: parteDiaria.horaKmTrabalhados,
          data: parteDiaria.data,
        })
        .from(parteDiaria)
        .where(isNotNull(parteDiaria.horaKmTrabalhados));

      // Filtrar por data do período
      const registrosFiltrados = registros.filter(r => {
        const dateStr = extractDateStr(r.data);
        return dateStr >= dataInicio && dateStr <= dataFim;
      });

      // 6. Buscar itens de parte diária para distribuição proporcional
      const pdIds = registrosFiltrados.map(r => r.id);
      let itens: { parteDiariaId: number; setorId: number; quantidade: string | null }[] = [];
      if (pdIds.length > 0) {
        // Buscar em lotes para evitar queries muito grandes
        const BATCH_SIZE = 500;
        for (let i = 0; i < pdIds.length; i += BATCH_SIZE) {
          const batch = pdIds.slice(i, i + BATCH_SIZE);
          const batchItens = await db
            .select({
              parteDiariaId: parteDiariaItens.parteDiariaId,
              setorId: parteDiariaItens.setorId,
              quantidade: parteDiariaItens.quantidade,
            })
            .from(parteDiariaItens)
            .where(inArray(parteDiariaItens.parteDiariaId, batch));
          itens.push(...batchItens);
        }
      }

      // 7. Calcular horas por equipamento por setor
      // Estrutura: equipamentoId → { setorNome → horas }
      const horasPorEquipSetor = new Map<number, Map<string, number>>();
      const horasTotalPorEquip = new Map<number, number>();

      // Agrupar itens por parteDiariaId
      const itensPorPD = new Map<number, { setorId: number; quantidade: number }[]>();
      for (const item of itens) {
        if (!itensPorPD.has(item.parteDiariaId)) itensPorPD.set(item.parteDiariaId, []);
        itensPorPD.get(item.parteDiariaId)!.push({
          setorId: item.setorId,
          quantidade: parseFloat(item.quantidade || '0'),
        });
      }

      for (const r of registrosFiltrados) {
        const horas = parseFloat(r.horaKmTrabalhados || '0');
        if (horas <= 0 || !r.equipamentoId) continue;

        // Verificar se equipamento está em grupo excluído
        const equip = equipMap.get(r.equipamentoId);
        if (equip?.grupoId && idsGruposExcluidos.has(equip.grupoId)) continue;

        // Acumular horas totais
        horasTotalPorEquip.set(r.equipamentoId, (horasTotalPorEquip.get(r.equipamentoId) || 0) + horas);

        // Verificar setor fixo (ex: BALANÇA INTEGRADORA)
        const setorFixo = EQUIPAMENTO_SETOR_FIXO[r.equipamentoId];
        if (setorFixo) {
          if (!horasPorEquipSetor.has(r.equipamentoId)) horasPorEquipSetor.set(r.equipamentoId, new Map());
          const setorMap = horasPorEquipSetor.get(r.equipamentoId)!;
          setorMap.set(setorFixo, (setorMap.get(setorFixo) || 0) + horas);
          continue;
        }

        // Distribuir horas proporcionalmente pelos setores dos itens
        const itensDoRegistro = itensPorPD.get(r.id);
        if (!itensDoRegistro || itensDoRegistro.length === 0) {
          // Sem itens: verificar se tem apenas 1 setor histórico
          // Neste caso, não distribuir (será tratado como "sem rateio")
          continue;
        }

        const totalQtd = itensDoRegistro.reduce((sum, i) => sum + i.quantidade, 0);

        if (totalQtd <= 0) {
          // Todos os itens têm quantidade 0: distribuir igualmente
          const numSetores = itensDoRegistro.length;
          for (const item of itensDoRegistro) {
            const setorNome = setoresMap.get(item.setorId) || 'DESCONHECIDO';
            if (!horasPorEquipSetor.has(r.equipamentoId)) horasPorEquipSetor.set(r.equipamentoId, new Map());
            const setorMapEquip = horasPorEquipSetor.get(r.equipamentoId)!;
            setorMapEquip.set(setorNome, (setorMapEquip.get(setorNome) || 0) + horas / numSetores);
          }
        } else {
          // Distribuir proporcionalmente
          for (const item of itensDoRegistro) {
            const proporcao = item.quantidade / totalQtd;
            const horasSetor = horas * proporcao;
            const setorNome = setoresMap.get(item.setorId) || 'DESCONHECIDO';
            if (!horasPorEquipSetor.has(r.equipamentoId)) horasPorEquipSetor.set(r.equipamentoId, new Map());
            const setorMapEquip = horasPorEquipSetor.get(r.equipamentoId)!;
            setorMapEquip.set(setorNome, (setorMapEquip.get(setorNome) || 0) + horasSetor);
          }
        }
      }

      // Para equipamentos com setor único (sem itens de PD mas com partes diárias),
      // usar o setor do primeiro item encontrado em qualquer parte diária do período
      for (const r of registrosFiltrados) {
        if (!r.equipamentoId) continue;
        const equip = equipMap.get(r.equipamentoId);
        if (equip?.grupoId && idsGruposExcluidos.has(equip.grupoId)) continue;
        if (EQUIPAMENTO_SETOR_FIXO[r.equipamentoId]) continue;

        // Se já tem distribuição, pular
        if (horasPorEquipSetor.has(r.equipamentoId)) continue;

        // Buscar o setor dos itens deste registro
        const itensDoRegistro = itensPorPD.get(r.id);
        if (itensDoRegistro && itensDoRegistro.length > 0) {
          const setorNome = setoresMap.get(itensDoRegistro[0].setorId) || 'DESCONHECIDO';
          const horas = parseFloat(r.horaKmTrabalhados || '0');
          if (horas > 0) {
            if (!horasPorEquipSetor.has(r.equipamentoId)) horasPorEquipSetor.set(r.equipamentoId, new Map());
            horasPorEquipSetor.get(r.equipamentoId)!.set(setorNome, (horasPorEquipSetor.get(r.equipamentoId)!.get(setorNome) || 0) + horas);
          }
        }
      }

      // 8. Buscar despesas importadas do período
      const despesasImportadas = await db
        .select({
          equipamentoTag: itemDespesaImportado.equipamentoTag,
          classificacao: itemDespesaImportado.classificacao,
          custo: itemDespesaImportado.custo,
        })
        .from(itemDespesaImportado)
        .where(eq(itemDespesaImportado.periodoCustoId, input.periodoCustoId));

      // 9. Buscar salários operacionais do período
      const salariosOper = await db
        .select({
          equipamentoId: lancamentoSalario.equipamentoId,
          valor: lancamentoSalario.valor,
        })
        .from(lancamentoSalario)
        .where(and(
          eq(lancamentoSalario.periodoCustoId, input.periodoCustoId),
          eq(lancamentoSalario.contaCustoId, CONTA_SAL_OPER_ID),
        ));

      // 10. Agregar despesas por equipamentoId
      // Primeiro, mapear tags → equipamentoId
      const despesasPorEquipId = new Map<number, DespesasEquipamento>();

      // Tags que não são equipamentos (são despesas de setor)
      const tagsSetorSet = new Set(Object.keys(TAGS_OUTRAS_DESP_SETOR).map(t => t.toUpperCase()));
      const tagsNaoLancarSet = new Set(TAGS_NAO_LANCAR.map(t => t.toUpperCase()));
      const tagsExcluirSet = new Set(TAGS_EXCLUIR.map(t => t.toUpperCase()));

      const equipamentosSemCorrespondencia: string[] = [];

      for (const desp of despesasImportadas) {
        const tagUpper = desp.equipamentoTag.toUpperCase();

        // Ignorar tags de setor, não lançar, excluir
        if (tagsSetorSet.has(tagUpper) || tagsNaoLancarSet.has(tagUpper) || tagsExcluirSet.has(tagUpper)) continue;

        // Resolver tag → equipamentoId
        let equipId = tagToIdMap.get(tagUpper);

        if (!equipId) {
          // Tentar matching parcial pelo codigoTag
          for (const equip of equipsList) {
            if (equip.codigoTag && equip.codigoTag.toUpperCase() === tagUpper) {
              equipId = equip.id;
              break;
            }
          }
        }

        if (!equipId) {
          if (!equipamentosSemCorrespondencia.includes(desp.equipamentoTag)) {
            equipamentosSemCorrespondencia.push(desp.equipamentoTag);
          }
          continue;
        }

        const campo = CLASSIFICACAO_PARA_CAMPO[desp.classificacao];
        if (!campo) continue;

        if (!despesasPorEquipId.has(equipId)) {
          despesasPorEquipId.set(equipId, {
            salOperEncOper: 0, combustivel: 0, lubrificantes: 0,
            pecasDesgaste: 0, pecasReposicao: 0, outrasDespesas: 0, total: 0,
          });
        }

        const d = despesasPorEquipId.get(equipId)!;
        const valor = parseFloat(desp.custo || '0');
        (d as any)[campo] += valor;
        d.total += valor;
      }

      // Adicionar salários operacionais
      for (const sal of salariosOper) {
        if (!sal.equipamentoId) continue;
        if (!despesasPorEquipId.has(sal.equipamentoId)) {
          despesasPorEquipId.set(sal.equipamentoId, {
            salOperEncOper: 0, combustivel: 0, lubrificantes: 0,
            pecasDesgaste: 0, pecasReposicao: 0, outrasDespesas: 0, total: 0,
          });
        }
        const d = despesasPorEquipId.get(sal.equipamentoId)!;
        const valor = parseFloat(sal.valor || '0');
        d.salOperEncOper += valor;
        d.total += valor;
      }

      // 11. Ratear despesas por setor usando proporção de horas
      // Estrutura: subsetorMEM → equipamentos rateados
      const subsetoresResult = new Map<string, SubsetorMem>();
      const equipamentosSemRateio: { id: number; nome: string; tag: string; despesaTotal: number }[] = [];

      for (const [equipId, despesas] of Array.from(despesasPorEquipId.entries())) {
        if (despesas.total <= 0) continue;

        const equip = equipMap.get(equipId);
        if (!equip) continue;

        // Verificar grupo excluído
        if (equip.grupoId && idsGruposExcluidos.has(equip.grupoId)) continue;

        const setoresDoEquip = horasPorEquipSetor.get(equipId);
        const horasTotal = horasTotalPorEquip.get(equipId) || 0;

        if (!setoresDoEquip || setoresDoEquip.size === 0) {
          // Equipamento sem distribuição de horas por setor
          equipamentosSemRateio.push({
            id: equipId,
            nome: equip.nomeDoEquipamento,
            tag: equip.codigoTag || '',
            despesaTotal: despesas.total,
          });
          continue;
        }

        // Calcular total de horas distribuídas para este equipamento
        const horasDistribuidas = Array.from(setoresDoEquip.values()).reduce((s, h) => s + h, 0);

        // Para cada setor onde trabalhou, ratear as despesas
        for (const [setorNome, horasNoSetor] of Array.from(setoresDoEquip.entries())) {
          const percentual = horasDistribuidas > 0 ? (horasNoSetor / horasDistribuidas) * 100 : 0;
          const fator = horasDistribuidas > 0 ? horasNoSetor / horasDistribuidas : 0;

          // Mapear setor do sistema para subsetor MEM
          const mapping = SETOR_PARA_SUBSETOR_MEM[setorNome.toUpperCase()] || SETOR_PARA_SUBSETOR_MEM[setorNome];
          if (!mapping) continue;

          const subsetorKey = `${mapping.grupo}||${mapping.subsetor}`;

          if (!subsetoresResult.has(subsetorKey)) {
            subsetoresResult.set(subsetorKey, {
              subsetorNome: mapping.subsetor,
              grupoNome: mapping.grupo,
              equipamentos: [],
              totalSubsetor: 0,
              totalHoras: 0,
            });
          }

          const subsetor = subsetoresResult.get(subsetorKey)!;

          // Verificar se este equipamento já existe neste subsetor (pode ter múltiplos setores mapeados ao mesmo subsetor MEM)
          let equipRateado = subsetor.equipamentos.find(e => e.equipamentoId === equipId);
          if (equipRateado) {
            // Somar ao existente
            equipRateado.horasNoSetor += horasNoSetor;
            equipRateado.percentual += percentual;
            equipRateado.despesas.salOperEncOper += despesas.salOperEncOper * fator;
            equipRateado.despesas.combustivel += despesas.combustivel * fator;
            equipRateado.despesas.lubrificantes += despesas.lubrificantes * fator;
            equipRateado.despesas.pecasDesgaste += despesas.pecasDesgaste * fator;
            equipRateado.despesas.pecasReposicao += despesas.pecasReposicao * fator;
            equipRateado.despesas.outrasDespesas += despesas.outrasDespesas * fator;
            equipRateado.despesas.total += despesas.total * fator;
          } else {
            subsetor.equipamentos.push({
              equipamentoId: equipId,
              equipamentoNome: equip.nomeDoEquipamento,
              equipamentoTag: equip.codigoTag || '',
              horasTotal,
              horasNoSetor,
              percentual,
              despesas: {
                salOperEncOper: despesas.salOperEncOper * fator,
                combustivel: despesas.combustivel * fator,
                lubrificantes: despesas.lubrificantes * fator,
                pecasDesgaste: despesas.pecasDesgaste * fator,
                pecasReposicao: despesas.pecasReposicao * fator,
                outrasDespesas: despesas.outrasDespesas * fator,
                total: despesas.total * fator,
              },
            });
          }

          subsetor.totalSubsetor += despesas.total * fator;
          subsetor.totalHoras += horasNoSetor;
        }
      }

      // 12. Ordenar resultados (decrescente por total)
      const ORDEM_GRUPOS: Record<string, number> = {
        "DESMONTE DE ROCHA": 1,
        "PEDRA PARA BRITADOR": 2,
        "BRITAGEM": 3,
        "EXPEDIÇÃO": 4,
        "SERVIÇOS AUXILIARES": 5,
        "ADMINISTRAÇÃO": 6,
      };

      const subsetores = Array.from(subsetoresResult.values())
        .map(s => {
          // Ordenar equipamentos por despesa total decrescente
          s.equipamentos.sort((a, b) => b.despesas.total - a.despesas.total);
          return s;
        })
        .sort((a, b) => {
          const ordemA = ORDEM_GRUPOS[a.grupoNome] ?? 99;
          const ordemB = ORDEM_GRUPOS[b.grupoNome] ?? 99;
          if (ordemA !== ordemB) return ordemA - ordemB;
          return b.totalSubsetor - a.totalSubsetor;
        });

      const totalGeral = subsetores.reduce((s, sub) => s + sub.totalSubsetor, 0);

      return {
        subsetores,
        totalGeral,
        equipamentosSemRateio,
        equipamentosSemCorrespondencia,
      };
    }),

  /**
   * Resumo sintético do rateio MEM por subsetor (para integração com Apuração de Custo)
   */
  resumoPorSubsetor: protectedProcedure
    .input(z.object({
      periodoCustoId: z.number(),
    }))
    .query(async ({ input, ctx }) => {
      // Reutilizar o cálculo completo e retornar apenas o resumo
      const db = await getDb();
      if (!db) return { subsetores: [], totalGeral: 0 };

      // Chamar internamente a mesma lógica (via caller)
      // Para evitar duplicação, vamos importar diretamente
      // Na prática, o frontend pode chamar calcularRateio e extrair o resumo
      // Aqui retornamos uma versão simplificada

      const [periodo] = await db
        .select({ id: periodoCusto.id, mes: periodoCusto.mes, ano: periodoCusto.ano })
        .from(periodoCusto)
        .where(eq(periodoCusto.id, input.periodoCustoId));

      if (!periodo) return { subsetores: [], totalGeral: 0 };

      // Delegar para calcularRateio e simplificar
      return { subsetores: [], totalGeral: 0, nota: "Use calcularRateio para dados completos" };
    }),
});
