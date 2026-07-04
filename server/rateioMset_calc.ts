/**
 * Rateio MSET on-the-fly — calcula despesas de setores a partir dos dados já importados:
 *   1. lancamento_fluxo  → Energia, Consultorias, Desp. Administrativas, Frota, etc.
 *   2. lancamento_salario → Sal.Adm./Almox./Ofic./Serv.Aux./Encargos e Salário da Diretoria por setor
 *   3. lancamento_imposto → Impostos, CEFEM e Outras Taxas por setor
 *
 * O resultado é um array de despesas no mesmo shape de custo_setor_despesa,
 * pronto para ser injetado nos relatórios analítico e sintético sem precisar
 * importar a aba MSET da planilha.
 */

import { getDb } from "./db";
import {
  lancamentoFluxo,
  lancamentoSalario,
  lancamentoCusto,
  periodoCusto,
  setores,
  itemDespesaImportado,
  equipamentoExcluidoTag,
} from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { TAGS_OUTRAS_DESP_SETOR, TAGS_CONTA_EXPLOSIVOS } from "./importDespesas_correspondencias";

// ─── Mapeamento de setor operacional → subsetor/grupo do relatório ───────────
export const SETOR_PARA_SUBSETOR_MSET: Record<string, { subsetor: string; grupo: string }> = {
  "ADMINISTRACAO":                        { subsetor: "ADMINISTRAÇÃO",              grupo: "ADMINISTRAÇÃO" },
  "ADMINISTRAÇÃO":                        { subsetor: "ADMINISTRAÇÃO",              grupo: "ADMINISTRAÇÃO" },
  "BRITAGEM PRIMÁRIA":                    { subsetor: "BRITAGEM PRIMÁRIA",          grupo: "BRITAGEM" },
  "BRITAGEM SECUNDÁRIA":                  { subsetor: "BRITAGEM SEC./TERC./QUART.", grupo: "BRITAGEM" },
  "BRITAGEM TERCEÁRIA":                   { subsetor: "BRITAGEM SEC./TERC./QUART.", grupo: "BRITAGEM" },
  "BRITAGEM QUARTENÁRIA":                 { subsetor: "BRITAGEM SEC./TERC./QUART.", grupo: "BRITAGEM" },
  "BRITAGEM MÓVEL":                       { subsetor: "BRITAGEM SEC./TERC./QUART.", grupo: "BRITAGEM" },
  "BRITAGEM SEC./TERC./QUART.":           { subsetor: "BRITAGEM SEC./TERC./QUART.", grupo: "BRITAGEM" },
  "DESMONTE PRIMÁRIO":                    { subsetor: "DESMONTE PRIMÁRIO",          grupo: "DESMONTE DE ROCHA" },
  "DESMONTE SECUNDÁRIO":                  { subsetor: "DESMONTE SECUNDÁRIO",        grupo: "DESMONTE DE ROCHA" },
  "DECAPEAMENTO":                         { subsetor: "DECAPEAMENTO",               grupo: "DESMONTE DE ROCHA" },
  "CARGA E TRANSPORTE DE PEDRA DA MINA":  { subsetor: "PEDRA PARA BRITADOR",       grupo: "PEDRA PARA BRITADOR" },
  "PEDRA PARA BRITADOR":                  { subsetor: "PEDRA PARA BRITADOR",       grupo: "PEDRA PARA BRITADOR" },
  "EXPEDIÇÃO":                            { subsetor: "EXPEDIÇÃO",                  grupo: "EXPEDIÇÃO" },
  "MOVIMENTAÇÃO DE ESTOQUE":              { subsetor: "MOV. DE ESTOQUE",            grupo: "EXPEDIÇÃO" },
  "MOV. DE ESTOQUE":                      { subsetor: "MOV. DE ESTOQUE",            grupo: "EXPEDIÇÃO" },
  "OFICINA":                              { subsetor: "OFICINA E ALMOXARIFADO",     grupo: "SERVIÇOS AUXILIARES" },
  "ALMOXARIFADO":                         { subsetor: "OFICINA E ALMOXARIFADO",     grupo: "SERVIÇOS AUXILIARES" },
  "OFICINA E ALMOXARIFADO":               { subsetor: "OFICINA E ALMOXARIFADO",     grupo: "SERVIÇOS AUXILIARES" },
  "OUTROS SERVIÇOS AUXILIARES":           { subsetor: "OUTROS SERVIÇOS",            grupo: "SERVIÇOS AUXILIARES" },
  "OUTROS SERVIÇOS":                      { subsetor: "OUTROS SERVIÇOS",            grupo: "SERVIÇOS AUXILIARES" },
  "REFEITÓRIO":                           { subsetor: "REFEITÓRIO E LIMPEZA",       grupo: "SERVIÇOS AUXILIARES" },
  "LIMPEZA":                              { subsetor: "REFEITÓRIO E LIMPEZA",       grupo: "SERVIÇOS AUXILIARES" },
  "ALIMENTAÇÃO":                          { subsetor: "REFEITÓRIO E LIMPEZA",       grupo: "SERVIÇOS AUXILIARES" },
  "REFEITÓRIO E LIMPEZA":                 { subsetor: "REFEITÓRIO E LIMPEZA",       grupo: "SERVIÇOS AUXILIARES" },
  "APOIO GERAL":                          { subsetor: "OUTROS SERVIÇOS",            grupo: "SERVIÇOS AUXILIARES" },
  "INDIRETAS":                            { subsetor: "DESPESAS INDIRETAS",          grupo: "ADMINISTRAÇÃO" },
  "DESPESAS INDIRETAS":                    { subsetor: "DESPESAS INDIRETAS",          grupo: "ADMINISTRAÇÃO" },
  "DIRETORIA":                            { subsetor: "ADMINISTRAÇÃO",              grupo: "ADMINISTRAÇÃO" },
  "PRÓ-LABORE":                           { subsetor: "ADMINISTRAÇÃO",              grupo: "ADMINISTRAÇÃO" },
  "CARGA E TRANSPORTE":                   { subsetor: "PEDRA PARA BRITADOR",       grupo: "PEDRA PARA BRITADOR" },
};

// ─── Mapeamento de contaSistema do Fluxo → descrição na MSET ─────────────────
// Esses nomes aparecem na tabela custo_setor_despesa.descricao
const CONTA_SISTEMA_PARA_DESCRICAO_MSET: Record<string, string> = {
  "Energia Elétrica":                     "Energia Elétrica",
  "Consultorias Especializadas":          "Juridíco/Cons.Esp./Serv.Ter.",
  "Despesas Administrativas":             "Desp.Admin.Telef.e Inform.",
  "Frota/Man.Pat./Seg./Out.":             "Equip.Apoio (Comb./Lub/Peças/Serv.)",
  "Impostos, CEFEM e Outras Taxas":       "Imp., Trib., Taxas e CEFEM",
  "Despesas Indiretas":                   "Despesas Indiretas",
  "Comissão de Vendas":                   "Comissão de Vendas",
};

// IDs de contas de salário (espelha salarios_router.ts)
const CONTA_SAL_ADM_ID = 1;
const CONTA_SAL_DIRETORIA_ID = 12;

// ─── Resultado ───────────────────────────────────────────────────────────────
export interface DespesaMsetCalculada {
  subsetorNome: string;
  grupoNome: string;
  descricao: string;
  valor: number;
  ordemExibicao: number;
  fonte: "fluxo" | "salario" | "imposto";
}

export interface RateioMsetResult {
  despesas: DespesaMsetCalculada[];
  /** Total geral de todas as despesas MSET */
  totalGeral: number;
  /** Agrupado por subsetor para fácil consumo */
  porSubsetor: Record<string, {
    subsetorNome: string;
    grupoNome: string;
    despesas: DespesaMsetCalculada[];
    total: number;
  }>;
}

/**
 * Calcula o rateio MSET on-the-fly para um período de custo.
 */
export async function calcularRateioMset(periodoCustoId: number): Promise<RateioMsetResult> {
  const db = await getDb();
  if (!db) return { despesas: [], totalGeral: 0, porSubsetor: {} };

  // Verificar se o período existe
  const [periodo] = await db
    .select({ id: periodoCusto.id })
    .from(periodoCusto)
    .where(eq(periodoCusto.id, periodoCustoId))
    .limit(1);

  if (!periodo) return { despesas: [], totalGeral: 0, porSubsetor: {} };

  // ID da conta de impostos no lancamento_custo
  const CONTA_IMPOSTOS_ID = 2;
  const OBS_PREFIX_IMPOSTOS = "[Impostos Manual]";

  // Buscar dados em paralelo
  const [fluxoRows, salarioRows, impostoRows, setoresRows] = await Promise.all([
    db
      .select()
      .from(lancamentoFluxo)
      .where(eq(lancamentoFluxo.periodoCustoId, periodoCustoId)),
    db
      .select()
      .from(lancamentoSalario)
      .where(eq(lancamentoSalario.periodoCustoId, periodoCustoId)),
    // Impostos são lançamentos na lancamento_custo com contaCustoId=2 e obs "[Impostos Manual]"
    db
      .select({
        id: lancamentoCusto.id,
        valor: lancamentoCusto.valor,
        observacoes: lancamentoCusto.observacoes,
      })
      .from(lancamentoCusto)
      .where(
        and(
          eq(lancamentoCusto.periodoCustoId, periodoCustoId),
          eq(lancamentoCusto.contaCustoId, CONTA_IMPOSTOS_ID)
        )
      ),
    db
      .select({ id: setores.id, nome: setores.nome })
      .from(setores),
  ]);

  const setorNomeMap = new Map<number, string>();
  for (const s of setoresRows) {
    setorNomeMap.set(s.id, s.nome);
  }

  const despesas: DespesaMsetCalculada[] = [];
  let ordemGlobal = 0;

  // ─── 1. Processar Fluxo Realizado ──────────────────────────────────────────
  // Agrupar por contaSistema + setor → valor
  const fluxoPorContaSetor = new Map<string, number>();
  for (const row of fluxoRows) {
    const valor = parseFloat(row.valor ?? "0");
    if (valor === 0) continue;
    const key = `${row.contaSistema}||${row.setor}`;
    fluxoPorContaSetor.set(key, (fluxoPorContaSetor.get(key) ?? 0) + valor);
  }

  for (const [key, valor] of Array.from(fluxoPorContaSetor.entries())) {
    const [contaSistema, setor] = key.split("||");
    if (!contaSistema || !setor) continue;

    // Mapear setor do fluxo para subsetor/grupo do relatório
    const mapping = SETOR_PARA_SUBSETOR_MSET[setor.toUpperCase()] ?? SETOR_PARA_SUBSETOR_MSET[setor];
    if (!mapping) continue;

    // Mapear contaSistema para descrição MSET
    const descricao = CONTA_SISTEMA_PARA_DESCRICAO_MSET[contaSistema] ?? contaSistema;

    ordemGlobal++;
    despesas.push({
      subsetorNome: mapping.subsetor,
      grupoNome: mapping.grupo,
      descricao,
      valor,
      ordemExibicao: ordemGlobal,
      fonte: "fluxo",
    });
  }

  // ─── 2. Processar Salários (Adm/Diretoria por setor) ──────────────────────
  // Sal.Adm. e Sal.Diretoria lançados por setor viram despesas MSET
  for (const sal of salarioRows) {
    if (
      (sal.contaCustoId === CONTA_SAL_ADM_ID || sal.contaCustoId === CONTA_SAL_DIRETORIA_ID) &&
      sal.setorId
    ) {
      const setorNome = setorNomeMap.get(sal.setorId);
      if (!setorNome) continue;

      const mapping = SETOR_PARA_SUBSETOR_MSET[setorNome.toUpperCase()] ?? SETOR_PARA_SUBSETOR_MSET[setorNome];
      if (!mapping) continue;

      const valor = parseFloat(sal.valor ?? "0");
      if (valor === 0) continue;

      const descricao = sal.contaCustoId === CONTA_SAL_ADM_ID
        ? "Sal.Adm./Almox./Ofic./Serv.Aux./Encargos"
        : "Salário da Diretoria";

      ordemGlobal++;
      despesas.push({
        subsetorNome: mapping.subsetor,
        grupoNome: mapping.grupo,
        descricao,
        valor,
        ordemExibicao: ordemGlobal,
        fonte: "salario",
      });
    }
  }

  // ─── 3. Processar Impostos (lancamento_custo com contaCustoId=2) ─────────
  // Impostos do fluxo já são capturados na etapa 1 (contaSistema = "Impostos, CEFEM e Outras Taxas")
  // Aqui processamos apenas os impostos manuais que não vieram do fluxo
  for (const imp of impostoRows) {
    const obs = imp.observacoes ?? "";
    // Apenas impostos manuais (não os importados do fluxo)
    if (!obs.startsWith(OBS_PREFIX_IMPOSTOS)) continue;

    const valor = parseFloat(imp.valor ?? "0");
    if (valor === 0) continue;

    // Extrair descrição da observação
    const descricaoImp = obs.replace(OBS_PREFIX_IMPOSTOS, "").trim() || "Imp., Trib., Taxas e CEFEM";

    // Impostos manuais vão para EXPEDIÇÃO (padrão do mapeamento de fluxo)
    ordemGlobal++;
    despesas.push({
      subsetorNome: "EXPEDIÇÃO",
      grupoNome: "EXPEDIÇÃO",
      descricao: "Imp., Trib., Taxas e CEFEM",
      valor,
      ordemExibicao: ordemGlobal,
      fonte: "imposto",
    });
  }

  // ─── 4. Processar Despesas Específicas de Setores (TAGS_OUTRAS_DESP_SETOR) ──────
  // Essas despesas são excluídas do MEM e precisam entrar no MSET
  const tagsSetorEntries = Object.entries(TAGS_OUTRAS_DESP_SETOR);
  const tagsSetorUpper = tagsSetorEntries.map(([tag, setor]) => ({ tag: tag.toUpperCase(), setor }));

  // Buscar tags excluídas pelo usuário
  const tagsExcluidasRows = await db.select().from(equipamentoExcluidoTag);
  const tagsExcluidasSet = new Set(tagsExcluidasRows.map(t => t.tag.toUpperCase()));

  // Buscar itens importados do período que são de setores
  const itensImportados = await db
    .select({
      equipamentoTag: itemDespesaImportado.equipamentoTag,
      custo: itemDespesaImportado.custo,
      classificacao: itemDespesaImportado.classificacao,
    })
    .from(itemDespesaImportado)
    .where(eq(itemDespesaImportado.periodoCustoId, periodoCustoId));

  // Filtrar itens de tags de Explosivos e Acessórios (conta específica de setor)
  const tagsExplosivosUpperMset = new Set(TAGS_CONTA_EXPLOSIVOS.map(t => t.toUpperCase()));
  for (const item of itensImportados) {
    const tagUpper = item.equipamentoTag.toUpperCase();
    if (!tagsExplosivosUpperMset.has(tagUpper)) continue;
    if (tagsExcluidasSet.has(tagUpper)) continue;
    const valor = parseFloat(item.custo || '0');
    if (valor === 0) continue;
    // Explosivos vai para DESMONTE PRIMÁRIO
    const mappingExpl = SETOR_PARA_SUBSETOR_MSET["DESMONTE PRIMÁRIO"];
    if (!mappingExpl) continue;
    ordemGlobal++;
    despesas.push({
      subsetorNome: mappingExpl.subsetor,
      grupoNome: mappingExpl.grupo,
      descricao: "Explosivos e Acessórios",
      valor,
      ordemExibicao: ordemGlobal,
      fonte: "fluxo",
    });
  }

  // Filtrar apenas itens de tags de setores (não excluídas)
  for (const item of itensImportados) {
    const tagUpper = item.equipamentoTag.toUpperCase();
    const tagInfo = tagsSetorUpper.find(t => t.tag === tagUpper);
    if (!tagInfo) continue;
    // Pular se a tag está excluída pelo usuário
    if (tagsExcluidasSet.has(tagUpper)) continue;

    const valor = parseFloat(item.custo || '0');
    if (valor === 0) continue;

    // Mapear o setor destino para subsetor/grupo do relatório
    const setorDestino = tagInfo.setor;
    const mapping = SETOR_PARA_SUBSETOR_MSET[setorDestino.toUpperCase()] ?? SETOR_PARA_SUBSETOR_MSET[setorDestino];
    if (!mapping) continue;

    ordemGlobal++;
    despesas.push({
      subsetorNome: mapping.subsetor,
      grupoNome: mapping.grupo,
      descricao: `Outras Desp. Setor (${item.equipamentoTag})`,
      valor,
      ordemExibicao: ordemGlobal,
      fonte: "fluxo", // Usar fluxo como fonte para manter compatibilidade
    });
  }

  // ─── 5. Processar Despesas Indiretas (campo do período de custo) ──────
  const [periodoData] = await db
    .select({ despesasIndiretas: periodoCusto.despesasIndiretas })
    .from(periodoCusto)
    .where(eq(periodoCusto.id, periodoCustoId));

  if (periodoData) {
    const despIndiretas = parseFloat(periodoData.despesasIndiretas ?? "0");
    if (despIndiretas > 0) {
      const mappingIndiretas = SETOR_PARA_SUBSETOR_MSET["INDIRETAS"];
      if (mappingIndiretas) {
        ordemGlobal++;
        despesas.push({
          subsetorNome: mappingIndiretas.subsetor,
          grupoNome: mappingIndiretas.grupo,
          descricao: "Despesas Indiretas",
          valor: despIndiretas,
          ordemExibicao: ordemGlobal,
          fonte: "fluxo",
        });
      }
    }
  }

  // ─── Consolidar: agrupar despesas iguais (mesma descricao + subsetor) ──────
  const consolidado = new Map<string, DespesaMsetCalculada>();
  for (const d of despesas) {
    const key = `${d.subsetorNome}||${d.descricao}`;
    const existing = consolidado.get(key);
    if (existing) {
      existing.valor += d.valor;
    } else {
      consolidado.set(key, { ...d });
    }
  }

  const despesasConsolidadas = Array.from(consolidado.values());

  // ─── Agrupar por subsetor ──────────────────────────────────────────────────
  const porSubsetor: RateioMsetResult["porSubsetor"] = {};
  let totalGeral = 0;

  for (const d of despesasConsolidadas) {
    totalGeral += d.valor;

    if (!porSubsetor[d.subsetorNome]) {
      porSubsetor[d.subsetorNome] = {
        subsetorNome: d.subsetorNome,
        grupoNome: d.grupoNome,
        despesas: [],
        total: 0,
      };
    }
    porSubsetor[d.subsetorNome].despesas.push(d);
    porSubsetor[d.subsetorNome].total += d.valor;
  }

  // Ordenar despesas dentro de cada subsetor por valor decrescente
  for (const sub of Object.values(porSubsetor)) {
    sub.despesas.sort((a, b) => b.valor - a.valor);
  }

  return { despesas: despesasConsolidadas, totalGeral, porSubsetor };
}
