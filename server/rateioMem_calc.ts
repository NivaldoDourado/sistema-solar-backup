/**
 * Módulo compartilhado de cálculo do Rateio MEM
 * 
 * Contém a lógica de cálculo on-the-fly que pode ser reutilizada por:
 * - rateioMem_router.ts (tela de Rateio MEM)
 * - custoSetorRas_router.ts (Relatório Analítico - fallback)
 * - custoSetor_router.ts (Apuração de Custo - fallback)
 */

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
  servicos,
  equipamentoExcluidoTag,
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
export const SETOR_PARA_SUBSETOR_MEM: Record<string, { subsetor: string; grupo: string }> = {
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
  60001: "BRITAGEM PRIMÁRIA",
};

const NOMES_GRUPOS_EXCLUIDOS = ['BALANÇAS INTEGRADORAS'];

// Mapeamento de grupo para setor padrão (fallback)
const GRUPO_PARA_SETOR_PADRAO: Record<string, string> = {
  "BRITADORES": "BRITAGEM SECUNDÁRIA",
  "PENEIRAS VIBRATÓRIAS": "BRITAGEM SECUNDÁRIA",
  "TRANSPORTADORES DE CORREIA": "BRITAGEM SECUNDÁRIA",
  "COMPRESSORES DE AR DIESEL": "DESMONTE PRIMÁRIO",
  "PERFURATRIZES HIDRAULICAS": "DESMONTE PRIMÁRIO",
  "PERFURATRIZES PNEUMÁTICAS": "DESMONTE PRIMÁRIO",
  "ESCAVADEIRAS HIDRÁULICAS": "CARGA E TRANSPORTE DE PEDRA DA MINA",
  "CAMINHÕES INTERNOS": "CARGA E TRANSPORTE DE PEDRA DA MINA",
  "CAMINHÕES MELOSA": "CARGA E TRANSPORTE DE PEDRA DA MINA",
  "CAMINHÕES PIPA": "OUTROS SERVIÇOS AUXILIARES",
  "CAMINHÕES DA ENTREGA DE MATERIAL": "EXPEDIÇÃO",
  "PÁS CARREGADEIRAS": "EXPEDIÇÃO",
  "DRAGAS E BOMBA D'AGUA SUCÇÃO DIESEL": "DESMONTE PRIMÁRIO",
  "CARROS PEQUENOS": "ADMINISTRACAO",
  "OUTROS PARA CUSTO": "OUTROS SERVIÇOS AUXILIARES",
};

// ─── Interfaces ─────────────────────────────────────────────────────────────

export interface DespesasEquipamento {
  salOperEncOper: number;
  combustivel: number;
  lubrificantes: number;
  pecasDesgaste: number;
  pecasReposicao: number;
  outrasDespesas: number;
  total: number;
}

export interface EquipamentoRateado {
  equipamentoId: number;
  equipamentoNome: string;
  equipamentoTag: string;
  horasTotal: number;
  horasNoSetor: number;
  percentual: number;
  despesas: DespesasEquipamento;
}

export interface SubsetorMem {
  subsetorNome: string;
  grupoNome: string;
  equipamentos: EquipamentoRateado[];
  totalSubsetor: number;
  totalHoras: number;
}

export interface ProducaoSubsetor {
  subsetorNome: string;
  grupoNome: string;
  toneladas: number;
}

export interface RateioMemResult {
  subsetores: SubsetorMem[];
  totalGeral: number;
  equipamentosSemRateio: { id: number; nome: string; tag: string; despesaTotal: number }[];
  equipamentosSemCorrespondencia: string[];
  producaoPorSubsetor?: ProducaoSubsetor[];
}

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

function buildTagToIdMap(
  equipsList: { id: number; codigoTag: string | null; nomeDoEquipamento: string }[]
): Map<string, number> {
  const map = new Map<string, number>();
  for (const [tag, info] of Object.entries(CORRESPONDENCIAS_FORCADAS)) {
    map.set(tag.toUpperCase(), info.equipamentoId);
  }
  for (const [tag, id] of Object.entries(CORRESPONDENCIAS_APROVADAS)) {
    map.set(tag.toUpperCase(), id);
  }
  for (const equip of equipsList) {
    if (equip.codigoTag) {
      map.set(equip.codigoTag.toUpperCase(), equip.id);
    }
  }
  return map;
}

function resolverSetorFallback(
  equip: { id: number; setorId: number | null; grupoId: number | null; nomeDoEquipamento: string },
  setoresMap: Map<number, string>,
  gruposMap?: Map<number, string>,
): string | null {
  if (equip.setorId && setoresMap.has(equip.setorId)) {
    return setoresMap.get(equip.setorId)!;
  }
  // Inferir pelo grupo
  if (equip.grupoId && gruposMap?.has(equip.grupoId)) {
    const grupoNome = gruposMap.get(equip.grupoId)!;
    if (GRUPO_PARA_SETOR_PADRAO[grupoNome]) {
      return GRUPO_PARA_SETOR_PADRAO[grupoNome];
    }
  }
  // Inferir pelo nome
  const nome = equip.nomeDoEquipamento.toUpperCase();
  if (nome.includes('EXPLOSIVOS')) return 'DESMONTE PRIMÁRIO';
  if (nome.includes('PERFURATRIZ')) return 'DESMONTE PRIMÁRIO';
  if (nome.includes('COMPRESSOR')) return 'DESMONTE PRIMÁRIO';
  if (nome.includes('DRAGA')) return 'DESMONTE PRIMÁRIO';
  if (nome.includes('BRITADOR') && nome.includes('MOVEL')) return 'BRITAGEM MÓVEL';
  if (nome.includes('BRITADOR') || nome.includes('PENEIRA') || nome.includes('ALIMENTADOR') || nome.includes('CALHA')) return 'BRITAGEM SECUNDÁRIA';
  if (nome.includes('TRANSP') && nome.includes('CORREIA')) return 'BRITAGEM SECUNDÁRIA';
  if (nome.includes('ESCAVADEIRA') || nome.includes('KOMATSU')) return 'CARGA E TRANSPORTE DE PEDRA DA MINA';
  if (nome.includes('CAVALINHO') || nome.includes('CARRETA')) return 'EXPEDIÇÃO';
  if (nome.includes('PIPA')) return 'OUTROS SERVIÇOS AUXILIARES';
  if (nome.includes('BASCULANTE')) return 'CARGA E TRANSPORTE DE PEDRA DA MINA';
  if (nome.includes('MELOSA') || nome.includes('MELOZA')) return 'CARGA E TRANSPORTE DE PEDRA DA MINA';
  if (nome.includes('RANGER') || nome.includes('FORD') || nome.includes('VAN')) return 'ADMINISTRACAO';
  return null;
}

// ─── Função principal de cálculo ────────────────────────────────────────────

/**
 * Calcula o rateio MEM completo para um período.
 * Função reutilizável que pode ser chamada por múltiplos routers.
 */
export async function calcularRateioMem(periodoCustoId: number): Promise<RateioMemResult> {
  const db = await getDb();
  if (!db) return { subsetores: [], totalGeral: 0, equipamentosSemRateio: [], equipamentosSemCorrespondencia: [] };

  // 1. Buscar período
  const [periodo] = await db
    .select({ id: periodoCusto.id, mes: periodoCusto.mes, ano: periodoCusto.ano })
    .from(periodoCusto)
    .where(eq(periodoCusto.id, periodoCustoId));

  if (!periodo) return { subsetores: [], totalGeral: 0, equipamentosSemRateio: [], equipamentosSemCorrespondencia: [] };

  const { dataInicio, dataFim } = getMesDates(periodo.mes, periodo.ano);

  // 2. Buscar grupos excluídos
  const gruposExcluidos = await db
    .select({ id: gruposDeEquipamentos.id })
    .from(gruposDeEquipamentos)
    .where(or(
      ...NOMES_GRUPOS_EXCLUIDOS.map(n => like(gruposDeEquipamentos.nome, `%${n}%`))
    ));
  const idsGruposExcluidos = new Set(gruposExcluidos.map(g => g.id));

  // 3. Buscar todos os equipamentos (excluindo os marcados como excluidoCusto)
  const equipsList = await db
    .select({
      id: equipamentos.id,
      codigoTag: equipamentos.codigoTag,
      nomeDoEquipamento: equipamentos.nomeDoEquipamento,
      grupoId: equipamentos.grupoId,
      setorId: equipamentos.setorId,
      excluidoCusto: equipamentos.excluidoCusto,
    })
    .from(equipamentos);

  // IDs de equipamentos excluídos do custo (cadastrados)
  const idsEquipExcluidos = new Set(equipsList.filter(e => e.excluidoCusto === "sim").map(e => e.id));

  // Tags excluídas (equipamentos sem vínculo no cadastro)
  const tagsExcluidasRows = await db.select().from(equipamentoExcluidoTag);
  const tagsExcluidasSet = new Set(tagsExcluidasRows.map(t => t.tag.toUpperCase()));

  const equipMap = new Map(equipsList.map(e => [e.id, e]));
  const tagToIdMap = buildTagToIdMap(equipsList);

  // Resolver IDs de equipamentos correspondentes a tags excluídas
  // (para filtrar também horas e salários que usam equipamentoId)
  for (const tagUpper of Array.from(tagsExcluidasSet)) {
    const equipId = tagToIdMap.get(tagUpper);
    if (equipId) idsEquipExcluidos.add(equipId);
  }

  // 4. Buscar setores e grupos
  const setoresRows = await db.select({ id: setores.id, nome: setores.nome }).from(setores);
  const setoresMap = new Map(setoresRows.map(s => [s.id, s.nome]));

  const gruposRows = await db.select({ id: gruposDeEquipamentos.id, nome: gruposDeEquipamentos.nome }).from(gruposDeEquipamentos);
  const gruposMap = new Map(gruposRows.map(g => [g.id, g.nome]));

  // 5. Buscar partes diárias do período
  const registros = await db
    .select({
      id: parteDiaria.id,
      equipamentoId: parteDiaria.equipamentoId,
      horaKmTrabalhados: parteDiaria.horaKmTrabalhados,
      data: parteDiaria.data,
    })
    .from(parteDiaria)
    .where(isNotNull(parteDiaria.horaKmTrabalhados));

  const registrosFiltrados = registros.filter(r => {
    const dateStr = extractDateStr(r.data);
    return dateStr >= dataInicio && dateStr <= dataFim;
  });

  // 6. Buscar itens de parte diária
  const pdIds = registrosFiltrados.map(r => r.id);
  let itens: { parteDiariaId: number; setorId: number; quantidade: string | null }[] = [];
  if (pdIds.length > 0) {
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
  const horasPorEquipSetor = new Map<number, Map<string, number>>();
  const horasTotalPorEquip = new Map<number, number>();

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

    const equip = equipMap.get(r.equipamentoId);
    if (equip?.grupoId && idsGruposExcluidos.has(equip.grupoId)) continue;
    if (idsEquipExcluidos.has(r.equipamentoId)) continue;

    horasTotalPorEquip.set(r.equipamentoId, (horasTotalPorEquip.get(r.equipamentoId) || 0) + horas);

    const setorFixo = EQUIPAMENTO_SETOR_FIXO[r.equipamentoId];
    if (setorFixo) {
      if (!horasPorEquipSetor.has(r.equipamentoId)) horasPorEquipSetor.set(r.equipamentoId, new Map());
      const setorMap = horasPorEquipSetor.get(r.equipamentoId)!;
      setorMap.set(setorFixo, (setorMap.get(setorFixo) || 0) + horas);
      continue;
    }

    const itensDoRegistro = itensPorPD.get(r.id);
    if (!itensDoRegistro || itensDoRegistro.length === 0) continue;

    const totalQtd = itensDoRegistro.reduce((sum, i) => sum + i.quantidade, 0);

    if (totalQtd <= 0) {
      const numSetores = itensDoRegistro.length;
      for (const item of itensDoRegistro) {
        const setorNome = setoresMap.get(item.setorId) || 'DESCONHECIDO';
        if (!horasPorEquipSetor.has(r.equipamentoId)) horasPorEquipSetor.set(r.equipamentoId, new Map());
        const setorMapEquip = horasPorEquipSetor.get(r.equipamentoId)!;
        setorMapEquip.set(setorNome, (setorMapEquip.get(setorNome) || 0) + horas / numSetores);
      }
    } else {
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

  // Fallback para equipamentos com PD mas sem itens
  for (const r of registrosFiltrados) {
    if (!r.equipamentoId) continue;
    const equip = equipMap.get(r.equipamentoId);
    if (equip?.grupoId && idsGruposExcluidos.has(equip.grupoId)) continue;
    if (idsEquipExcluidos.has(r.equipamentoId)) continue;
    if (EQUIPAMENTO_SETOR_FIXO[r.equipamentoId]) continue;
    if (horasPorEquipSetor.has(r.equipamentoId)) continue;

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

  // 8. Buscar despesas importadas
  const despesasImportadas = await db
    .select({
      equipamentoTag: itemDespesaImportado.equipamentoTag,
      classificacao: itemDespesaImportado.classificacao,
      custo: itemDespesaImportado.custo,
    })
    .from(itemDespesaImportado)
    .where(eq(itemDespesaImportado.periodoCustoId, periodoCustoId));

  // 9. Buscar salários operacionais
  const salariosOper = await db
    .select({
      equipamentoId: lancamentoSalario.equipamentoId,
      valor: lancamentoSalario.valor,
    })
    .from(lancamentoSalario)
    .where(and(
      eq(lancamentoSalario.periodoCustoId, periodoCustoId),
      eq(lancamentoSalario.contaCustoId, CONTA_SAL_OPER_ID),
    ));

  // 10. Agregar despesas por equipamentoId
  const despesasPorEquipId = new Map<number, DespesasEquipamento>();
  const tagsSetorSet = new Set(Object.keys(TAGS_OUTRAS_DESP_SETOR).map(t => t.toUpperCase()));
  const tagsNaoLancarSet = new Set(TAGS_NAO_LANCAR.map(t => t.toUpperCase()));
  const tagsExcluirSet = new Set(TAGS_EXCLUIR.map(t => t.toUpperCase()));
  const equipamentosSemCorrespondencia: string[] = [];

  for (const desp of despesasImportadas) {
    const tagUpper = desp.equipamentoTag.toUpperCase();
    if (tagsSetorSet.has(tagUpper) || tagsNaoLancarSet.has(tagUpper) || tagsExcluirSet.has(tagUpper)) continue;
    // Pular tags excluídas pelo usuário (equipamentos sem vínculo)
    if (tagsExcluidasSet.has(tagUpper)) continue;

    let equipId = tagToIdMap.get(tagUpper);
    if (!equipId) {
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

    // Pular equipamentos excluídos do custo
    if (idsEquipExcluidos.has(equipId)) continue;

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

  // 11. Ratear despesas por setor
  const subsetoresResult = new Map<string, SubsetorMem>();
  const equipamentosSemRateio: { id: number; nome: string; tag: string; despesaTotal: number }[] = [];

  for (const [equipId, despesas] of Array.from(despesasPorEquipId.entries())) {
    if (despesas.total <= 0) continue;

    const equip = equipMap.get(equipId);
    if (!equip) continue;
    if (equip.grupoId && idsGruposExcluidos.has(equip.grupoId)) continue;
    if (idsEquipExcluidos.has(equipId)) continue;

    const setoresDoEquip = horasPorEquipSetor.get(equipId);
    const horasTotal = horasTotalPorEquip.get(equipId) || 0;

    if (!setoresDoEquip || setoresDoEquip.size === 0) {
      const setorFallback = resolverSetorFallback(equip, setoresMap, gruposMap);
      if (setorFallback) {
        const mapping = SETOR_PARA_SUBSETOR_MEM[setorFallback.toUpperCase()] || SETOR_PARA_SUBSETOR_MEM[setorFallback];
        if (mapping) {
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
          subsetor.equipamentos.push({
            equipamentoId: equipId,
            equipamentoNome: equip.nomeDoEquipamento,
            equipamentoTag: equip.codigoTag || '',
            horasTotal: 0,
            horasNoSetor: 0,
            percentual: 100,
            despesas: { ...despesas },
          });
          subsetor.totalSubsetor += despesas.total;
          continue;
        }
      }
      equipamentosSemRateio.push({
        id: equipId,
        nome: equip.nomeDoEquipamento,
        tag: equip.codigoTag || '',
        despesaTotal: despesas.total,
      });
      continue;
    }

    const horasDistribuidas = Array.from(setoresDoEquip.values()).reduce((s, h) => s + h, 0);

    for (const [setorNome, horasNoSetor] of Array.from(setoresDoEquip.entries())) {
      const percentual = horasDistribuidas > 0 ? (horasNoSetor / horasDistribuidas) * 100 : 0;
      const fator = horasDistribuidas > 0 ? horasNoSetor / horasDistribuidas : 0;

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

      let equipRateado = subsetor.equipamentos.find(e => e.equipamentoId === equipId);
      if (equipRateado) {
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

  // 12. Ordenar resultados
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
}

// ─── Cálculo de Produção por Subsetor ─────────────────────────────────────────

/**
 * Calcula a produção (toneladas) por subsetor MEM para um período.
 * Usa a mesma lógica de distribuição proporcional do rateio:
 * - Busca itens de parte diária com produção > 0
 * - Agrupa por setor e converte para subsetor MEM
 */
export async function calcularProducaoPorSubsetor(periodoCustoId: number): Promise<ProducaoSubsetor[]> {
  const db = await getDb();
  if (!db) return [];

  // 1. Buscar período
  const [periodo] = await db
    .select({ id: periodoCusto.id, mes: periodoCusto.mes, ano: periodoCusto.ano })
    .from(periodoCusto)
    .where(eq(periodoCusto.id, periodoCustoId));

  if (!periodo) return [];

  const { dataInicio, dataFim } = getMesDates(periodo.mes, periodo.ano);

  // 2. Buscar setores
  const setoresRows = await db.select({ id: setores.id, nome: setores.nome }).from(setores);
  const setoresMap = new Map(setoresRows.map(s => [s.id, s.nome]));

  // 3. Buscar todas as partes diárias do período
  const registros = await db
    .select({
      id: parteDiaria.id,
      data: parteDiaria.data,
    })
    .from(parteDiaria);

  const registrosFiltrados = registros.filter(r => {
    const dateStr = extractDateStr(r.data);
    return dateStr >= dataInicio && dateStr <= dataFim;
  });

  const pdIds = registrosFiltrados.map(r => r.id);
  if (pdIds.length === 0) return [];

  // 4. Buscar itens com produção
  let itens: { parteDiariaId: number; setorId: number; producao: string | null }[] = [];
  const BATCH_SIZE = 500;
  for (let i = 0; i < pdIds.length; i += BATCH_SIZE) {
    const batch = pdIds.slice(i, i + BATCH_SIZE);
    const batchItens = await db
      .select({
        parteDiariaId: parteDiariaItens.parteDiariaId,
        setorId: parteDiariaItens.setorId,
        producao: parteDiariaItens.producao,
      })
      .from(parteDiariaItens)
      .where(inArray(parteDiariaItens.parteDiariaId, batch));
    itens.push(...batchItens);
  }

  // 5. Agregar produção por setor → subsetor MEM
  const producaoPorSubsetor = new Map<string, { subsetorNome: string; grupoNome: string; toneladas: number }>();

  for (const item of itens) {
    const producaoVal = parseFloat(item.producao || '0');
    if (producaoVal <= 0) continue;

    const setorNome = setoresMap.get(item.setorId) || 'DESCONHECIDO';
    const mapping = SETOR_PARA_SUBSETOR_MEM[setorNome.toUpperCase()] || SETOR_PARA_SUBSETOR_MEM[setorNome];
    if (!mapping) continue;

    const key = `${mapping.grupo}||${mapping.subsetor}`;
    if (!producaoPorSubsetor.has(key)) {
      producaoPorSubsetor.set(key, {
        subsetorNome: mapping.subsetor,
        grupoNome: mapping.grupo,
        toneladas: 0,
      });
    }
    producaoPorSubsetor.get(key)!.toneladas += producaoVal;
  }

  return Array.from(producaoPorSubsetor.values());
}
