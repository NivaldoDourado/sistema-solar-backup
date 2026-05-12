import { z } from "zod";
import { eq, and, sql } from "drizzle-orm";
import { router, protectedProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import {
  equipamentos,
  gruposDeEquipamentos,
  lancamentoCusto,
  periodoCusto,
  contaCusto,
  itemDespesaImportado,
} from "../drizzle/schema";
import * as XLSX from "xlsx";
import {
  CORRESPONDENCIAS_APROVADAS,
  TAGS_NAO_LANCAR,
  TAGS_OUTRAS_DESP_SETOR,
  TAGS_EXCLUIR,
  CORRESPONDENCIAS_FORCADAS,
  VALOR_CORRECAO_TRANSPORTADORA,
  TAGS_CONTA_EXPLOSIVOS,
} from "./importDespesas_correspondencias";

// ===== REGRAS DE CLASSIFICAÇÃO =====

const LUBRIFICANTES_KEYWORDS = [
  "oleo", "óleo", "graxa", "lubrificante", "lub ", "lub.",
  "graxas", "oleos", "óleos", "fluido hidraulico", "fluído hidráulico",
  "fluido de freio", "fluído de freio", "atf", "sae ", "15w", "20w", "10w",
  "hidraulico", "hidráulico", "transmissao", "transmissão"
];

const OUTRAS_DESPESAS_KEYWORDS = [
  "frete", "conhecimento de frete", "servico", "serviço", "mao de obra",
  "mão de obra", "mao-de-obra", "mão-de-obra", "lavagem", "vale transporte",
  "pintura", "manutencao corretiva", "manutenção corretiva", "despesas com viagem",
  "servico de terceiros", "serviço de terceiros", "ipva", "seguro", "licenciamento",
  "terceirizado", "terceirizada", "aluguel", "locacao", "locação",
  "recapagem", "servicos de pneu", "serviços de pneu"
];

const PECAS_DESGASTE_GERAL = ["pneu", "pneus"];

const PECAS_DESGASTE_ESCAVADEIRA = [
  "unha", "dente", "ponta de unha", "pino trava", "capa de desgaste",
  "adaptador", "ponteira"
];

const PECAS_DESGASTE_PA_CARREGADEIRA = [
  "protetor de lamina", "protetor de lâmina", "concha",
  "chapa metalica", "chapa metálica", "chapa lisa",
  "lamina bico de pato", "lâmina bico de pato", "bico lateral",
  "lamina usada", "lâmina usada", "b. pato", "bico pato"
];

const PECAS_DESGASTE_BRITADOR = [
  "mandibula", "mandíbula", "revestimento", "cunha",
  "placa de distribuicao", "placa de distribuição",
  "anel concavo", "anel côncavo", "manta"
];

const PECAS_DESGASTE_PENEIRA = ["tela", "telas"];
const PECAS_DESGASTE_TRANSPORTADORA = ["rolete", "roletes"];

const PECAS_DESGASTE_PERFURATRIZ = [
  "bit", "punho", "haste", "luva t-38", "luva t38",
  "coroa de botao", "coroa de botão"
];

const PECAS_DESGASTE_CAMINHAO = ["chapa metalica", "chapa metálica", "chapa lisa"];

const GRUPOS_EXCLUIR_DEFAULT = ["SOLOMIN"];

const EQUIPAMENTOS_EXCLUIR_KEYWORDS = [
  "CD MURIBECA", "CD. UMBAUBA", "CD UMBAUBA", "ENSACADEIRA SOLOMIN",
  "ITABLOQUE", "ITABLOCK", "MISTURADOR SOLO",
  "SOLOMIN", "PENEIRA RESERVA", "TRANSPORTADOR RM",
  "CD SERRA DO MACHADO", "QMD 4977",
  "TOA1F53"
];

function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

const COMBUSTIVEL_KEYWORDS = ["oleo diesel", "óleo diesel", "gasolina", "alcool", "álcool", "etanol", "diesel s10", "diesel s500", "diesel s-10", "diesel s-500"];

function classificarDespesa(
  descricaoProduto: string,
  grupoProduto: string,
  nomeEquipamento: string
): "lubrificantes" | "pecas_desgaste" | "outras_despesas" | "pecas_reposicao" | "combustivel" {
  const desc = norm(descricaoProduto);
  const equip = norm(nomeEquipamento);
  const grupo = grupoProduto.toLowerCase();
  // 0. COMBUSTÍVEL
  if (grupo.includes("combustível") || grupo.includes("combustivel")) return "combustivel";
  if (COMBUSTIVEL_KEYWORDS.some(kw => desc.includes(norm(kw)))) return "combustivel";
  // 1. LUBRIFICANTE
  if (grupo === "lubrificantes") return "lubrificantes";
  if (LUBRIFICANTES_KEYWORDS.some(kw => desc.includes(norm(kw)))) return "lubrificantes";

  // 2. OUTRAS DESPESAS
  if (OUTRAS_DESPESAS_KEYWORDS.some(kw => desc.includes(norm(kw)))) return "outras_despesas";

  // 3. PEÇA DE DESGASTE
  if (PECAS_DESGASTE_GERAL.some(kw => desc.includes(kw))) return "pecas_desgaste";

  const isEscavadeira = equip.includes("escavadeira") || equip.includes("escav");
  const isPaCarregadeira = equip.includes("pa carreg") || equip.includes("pa carreg") || equip.includes("carregadeira");
  const isBritador = equip.includes("britador") || equip.includes("britagem") || equip.includes("cone") || equip.includes("mandibula");
  const isPeneira = equip.includes("peneira");
  const isTransportadora = equip.includes("transp") || equip.includes("correia") || equip.includes("tc");
  const isPerfuratriz = equip.includes("perfuratriz") || equip.includes("perfurat");
  const isCaminhao = equip.includes("caminhao") || equip.includes("caminhao") || equip.includes("basculante") || equip.includes("mb ") || equip.includes("mercedes") || equip.includes("volvo");

  if (isEscavadeira && PECAS_DESGASTE_ESCAVADEIRA.some(kw => desc.includes(norm(kw)))) return "pecas_desgaste";
  if (isPaCarregadeira && PECAS_DESGASTE_PA_CARREGADEIRA.some(kw => desc.includes(norm(kw)))) return "pecas_desgaste";
  if (isBritador && PECAS_DESGASTE_BRITADOR.some(kw => desc.includes(norm(kw)))) return "pecas_desgaste";
  if (isPeneira && PECAS_DESGASTE_PENEIRA.some(kw => desc.includes(norm(kw)))) return "pecas_desgaste";
  if (isTransportadora && PECAS_DESGASTE_TRANSPORTADORA.some(kw => desc.includes(norm(kw)))) return "pecas_desgaste";
  if (isPerfuratriz && PECAS_DESGASTE_PERFURATRIZ.some(kw => desc.includes(norm(kw)))) return "pecas_desgaste";
  if (isCaminhao && PECAS_DESGASTE_CAMINHAO.some(kw => desc.includes(norm(kw)))) return "pecas_desgaste";

  // 4. PEÇA DE REPOSIÇÃO (residual)
  return "pecas_reposicao";
}

function deveExcluirEquipamento(nomeEquipPlanilha: string, grupoPlanilha: string): boolean {
  // Não excluir se está em correspondências forçadas ou é despesa de setor
  if (CORRESPONDENCIAS_FORCADAS[nomeEquipPlanilha]) return false;
  if (TAGS_OUTRAS_DESP_SETOR[nomeEquipPlanilha]) return false;
  if (GRUPOS_EXCLUIR_DEFAULT.some(g => grupoPlanilha.toUpperCase().includes(g))) return true;
  if (EQUIPAMENTOS_EXCLUIR_KEYWORDS.some(kw => nomeEquipPlanilha.toUpperCase().includes(kw.toUpperCase()))) return true;
  return false;
}

interface DespesaParsed {
  sequencia: string;
  data: string;
  produto: string;
  grupoProduto: string;
  quantidade: number;
  custo: number;
  centroCusto: string;
  hodometro: number | null;
  intervalo: number | null;
  horaPorLitro: string;
  litrosPorHora: string;
  observacoes: string;
  classificacao: "lubrificantes" | "pecas_desgaste" | "outras_despesas" | "pecas_reposicao" | "combustivel";
}
interface EquipamentoParsed {
  nomeCompleto: string;
  codigoTag: string;
  descricao: string;
  grupoPlanilha: string;
  despesas: DespesaParsed[];
  totalGeral: number;
  totalLubrificantes: number;
  totalPecasDesgaste: number;
  totalOutrasDespesas: number;
  totalPecasReposicao: number;
  totalCombustivel: number;
  excluirDefault: boolean;
}

function parsePlanilhaDespesas(buffer: Buffer): { equipamentos: EquipamentoParsed[]; totalGeral: number } {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

  const resultado: { equipamentos: EquipamentoParsed[]; totalGeral: number } = { equipamentos: [], totalGeral: 0 };
  let currentEquip: EquipamentoParsed | null = null;
  let skipNextHeader = false;

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const col0 = String(row[0] || "").trim();

    // Detectar linha de equipamento (contém "Grupo:")
    if (col0.includes("Grupo:") && col0.includes("-")) {
      if (currentEquip) resultado.equipamentos.push(currentEquip);

      const grupoMatch = col0.match(/Grupo:\s*(.+)$/i);
      const grupoPlanilha = grupoMatch ? grupoMatch[1].trim() : "";
      const beforeGrupo = col0.replace(/\s*-\s*Grupo:.*$/, "");
      const parts = beforeGrupo.split("-").map((p: string) => p.trim());
      const codigoTag = (parts[0] || "").replace(/\s+/g, " ").trim();
      const descricao = parts.slice(1).join(" - ").trim();

      currentEquip = {
        nomeCompleto: col0,
        codigoTag,
        descricao,
        grupoPlanilha,
        despesas: [],
        totalGeral: 0,
        totalLubrificantes: 0,
        totalPecasDesgaste: 0,
        totalOutrasDespesas: 0,
        totalPecasReposicao: 0,
        totalCombustivel: 0,
        excluirDefault: deveExcluirEquipamento(codigoTag, grupoPlanilha),
      };
      skipNextHeader = true;
      continue;
    }

    if (skipNextHeader && (col0 === "Sequên" || col0 === "Sequen")) {
      skipNextHeader = false;
      continue;
    }

    if (!currentEquip) continue;
    if (col0 === "" || col0 === "Total Geral:" || col0 === "Emitido em:") continue;

    const seq = Number(col0);
    if (!isNaN(seq) && seq > 0) {
      const dataStr = String(row[3] || "").trim();
      const produto = String(row[8] || "").trim();
      const grupoProduto = String(row[15] || "").trim();
      const quantidade = Number(row[19]) || 0;
      const custo = Number(row[23]) || 0;
       const centroCusto = String(row[26] || "").trim();
      const hodometroRaw = row[27];
      const hodometro = (hodometroRaw !== "" && hodometroRaw !== undefined && hodometroRaw !== null) ? Number(hodometroRaw) || null : null;
      const intervaloRaw = row[29];
      const intervalo = (intervaloRaw !== "" && intervaloRaw !== undefined && intervaloRaw !== null) ? Number(intervaloRaw) || null : null;
      const horaPorLitro = String(row[33] || "").trim();
      const litrosPorHora = String(row[36] || "").trim();
      const observacoes = String(row[38] || "").trim();
      // Combustível agora é classificado normalmente (não mais ignorado)
      const classificacao = classificarDespesa(produto, grupoProduto, currentEquip.descricao);
      currentEquip.despesas.push({ sequencia: col0, data: dataStr, produto, grupoProduto, quantidade, custo, centroCusto, hodometro, intervalo, horaPorLitro, litrosPorHora, observacoes, classificacao });
      currentEquip.totalGeral += custo;

      switch (classificacao) {
        case "lubrificantes": currentEquip.totalLubrificantes += custo; break;
        case "pecas_desgaste": currentEquip.totalPecasDesgaste += custo; break;
        case "outras_despesas": currentEquip.totalOutrasDespesas += custo; break;
        case "pecas_reposicao": currentEquip.totalPecasReposicao += custo; break;
        case "combustivel": currentEquip.totalCombustivel += custo; break;
      }
    }
  }

  if (currentEquip) resultado.equipamentos.push(currentEquip);
  resultado.totalGeral = resultado.equipamentos.reduce((sum, e) => sum + e.totalGeral, 0);
  return resultado;
}

interface EquipSistema {
  id: number;
  codigoTag: string | null;
  nomeDoEquipamento: string;
  grupoId: number | null;
}

function encontrarCorrespondencia(
  codigoTag: string,
  descricao: string,
  equipamentosSistema: EquipSistema[]
): { id: number; nome: string; score: number } | null {
  // 1. Verificar correspondências forçadas (validadas pelo usuário)
  if (CORRESPONDENCIAS_FORCADAS[codigoTag]) {
    const forcada = CORRESPONDENCIAS_FORCADAS[codigoTag];
    const equip = equipamentosSistema.find(e => e.id === forcada.equipamentoId);
    if (equip) return { id: equip.id, nome: equip.nomeDoEquipamento, score: 100 };
  }

  // 2. Verificar correspondências aprovadas na revisão
  if (CORRESPONDENCIAS_APROVADAS[codigoTag]) {
    const equipId = CORRESPONDENCIAS_APROVADAS[codigoTag];
    const equip = equipamentosSistema.find(e => e.id === equipId);
    if (equip) return { id: equip.id, nome: equip.nomeDoEquipamento, score: 100 };
  }

  // 3. Matching automático (fallback)
  const tagNorm = codigoTag.toUpperCase().replace(/[\s\-_]/g, "");
  const descNorm = descricao.toUpperCase().replace(/[\s\-_]/g, "");

  let bestMatch: { id: number; nome: string; score: number } | null = null;

  for (const equip of equipamentosSistema) {
    const sysTag = (equip.codigoTag || "").toUpperCase().replace(/[\s\-_]/g, "");
    const sysNome = equip.nomeDoEquipamento.toUpperCase().replace(/[\s\-_]/g, "");
    let score = 0;

    if (sysTag && tagNorm && sysTag === tagNorm) score = 100;
    else if (sysTag && tagNorm && (sysTag.includes(tagNorm) || tagNorm.includes(sysTag))) score = 80;
    else if (descNorm && sysNome && (sysNome.includes(descNorm) || descNorm.includes(sysNome))) score = 70;
    else {
      const tagWords = tagNorm.split(/[^A-Z0-9]+/).filter((w: string) => w.length > 2);
      const descWords = descNorm.split(/[^A-Z0-9]+/).filter((w: string) => w.length > 2);
      const sysWords = (sysTag + " " + sysNome).split(/[^A-Z0-9]+/).filter((w: string) => w.length > 2);
      const matchedWords = [...tagWords, ...descWords].filter((w: string) => sysWords.some((sw: string) => sw.includes(w) || w.includes(sw)));
      if (matchedWords.length >= 2) score = 50 + matchedWords.length * 5;
      else if (matchedWords.length === 1 && matchedWords[0].length > 4) score = 40;
    }

    if (score > 0 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { id: equip.id, nome: equip.nomeDoEquipamento, score };
    }
  }

  return bestMatch && bestMatch.score >= 40 ? bestMatch : null;
}

// ===== ROUTER =====

export const importDespesasRouter = router({
  parsePlanilha: protectedProcedure
    .input(z.object({
      fileBase64: z.string(),
      fileName: z.string(),
      mes: z.number().min(1).max(12),
      ano: z.number().min(2025).max(2030),
    }))
    .mutation(async ({ input, ctx }) => {
      const db2 = await getDb();
      if (!db2) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const buffer = Buffer.from(input.fileBase64, "base64");
      const parsed = parsePlanilhaDespesas(buffer);

      const equipSistema = await db2
        .select({ id: equipamentos.id, codigoTag: equipamentos.codigoTag, nomeDoEquipamento: equipamentos.nomeDoEquipamento, grupoId: equipamentos.grupoId })
        .from(equipamentos);


      const gruposSistema = await db2
        .select({ id: gruposDeEquipamentos.id, nome: gruposDeEquipamentos.nome })
        .from(gruposDeEquipamentos);

      const equipamentosComCorrespondencia = parsed.equipamentos.map(ep => {
        // Se é item de Explosivos e Acessórios (conta específica de setor)
        const isExplosivos = TAGS_CONTA_EXPLOSIVOS.some(t => ep.codigoTag.toUpperCase() === t.toUpperCase());
        // Se é item de Outras Desp. Setor, não buscar correspondência com equipamento
        const setorDesp = TAGS_OUTRAS_DESP_SETOR[ep.codigoTag];
        const match = isExplosivos
          ? { id: -2, nome: `Conta Específica → Explosivos e Acessórios`, score: 100 }
          : setorDesp ? { id: -1, nome: `Outras Desp. Setor → ${setorDesp}`, score: 100 } : encontrarCorrespondencia(ep.codigoTag, ep.descricao, equipSistema);
        return {
          ...ep,
          correspondencia: match,
          selecionado: !ep.excluirDefault && ep.despesas.length > 0,
        };
      });

      const equipamentosComDespesas = equipamentosComCorrespondencia.filter(e => e.despesas.length > 0);

      return {
        equipamentos: equipamentosComDespesas.map(e => ({
          nomeCompleto: e.nomeCompleto,
          codigoTag: e.codigoTag,
          descricao: e.descricao,
          grupoPlanilha: e.grupoPlanilha,
          totalGeral: e.totalGeral,
          totalLubrificantes: e.totalLubrificantes,
          totalPecasDesgaste: e.totalPecasDesgaste,
          totalOutrasDespesas: e.totalOutrasDespesas,
          totalPecasReposicao: e.totalPecasReposicao,
          totalCombustivel: e.totalCombustivel,
          qtdDespesas: e.despesas.length,
          correspondencia: e.correspondencia,
          excluirDefault: e.excluirDefault,
          selecionado: e.selecionado,
        })),
        totalGeral: parsed.totalGeral,
        totalEquipamentos: equipamentosComDespesas.length,
        equipamentosSistema: equipSistema.map(e => ({ id: e.id, nome: e.nomeDoEquipamento, tag: e.codigoTag })),
        gruposSistema: gruposSistema.map(g => ({ id: g.id, nome: g.nome })),
      };
    }),

  confirmarImportacao: protectedProcedure
    .input(z.object({
      fileBase64: z.string(),
      fileName: z.string(),
      mes: z.number().min(1).max(12),
      ano: z.number().min(2025).max(2030),
      equipamentosSelecionados: z.array(z.object({
        codigoTag: z.string(),
        equipamentoSistemaId: z.number().optional(),
      })),
    }))
    .mutation(async ({ input, ctx }) => {
      const db2 = await getDb();
      if (!db2) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const buffer = Buffer.from(input.fileBase64, "base64");
      const parsed = parsePlanilhaDespesas(buffer);

      // Buscar ou criar período de custo
      const periodoExistente = await db2
        .select()
        .from(periodoCusto)
        .where(and(eq(periodoCusto.mes, input.mes), eq(periodoCusto.ano, input.ano)))
        .limit(1);

      let periodoId: number;
      if (periodoExistente.length > 0) {
        periodoId = periodoExistente[0].id;
      } else {
        const [newPeriodo] = await db2.insert(periodoCusto).values({
          mes: input.mes,
          ano: input.ano,
          observacoes: `Criado automaticamente pela importação de despesas - ${input.fileName}`,
          userId: ctx.user.id,
        });
        periodoId = newPeriodo.insertId;
      }

      // Mapear contas de custo
      const contas = await db2.select().from(contaCusto);
      const contaLubrificantes = contas.find(c => c.nome.toLowerCase().includes("lubrificante"));
      const contaPecasDesgaste = contas.find(c => c.nome.toLowerCase().includes("peças de desgaste") || c.nome.toLowerCase().includes("pecas de desgaste"));
      const contaPecasReposicao = contas.find(c => c.nome.toLowerCase().includes("peças de reposição") || c.nome.toLowerCase().includes("pecas de reposicao") || c.nome.toLowerCase().includes("itens de consumo"));
      const contaOutrasDespesas = contas.find(c => c.nome.toLowerCase().includes("outras despesas") && c.nome.toLowerCase().includes("equipamento"));

      if (!contaLubrificantes || !contaPecasDesgaste || !contaPecasReposicao || !contaOutrasDespesas) {
        throw new Error("Contas de custo não encontradas. Verifique: Lubrificantes, Peças de Desgaste, Peças de Reposição / Itens de Consumo, Outras Despesas dos Equipamentos");
      }

      // Buscar conta "Combustível" para lançamentos de combustível
      const contaCombustivel = contas.find(c => c.nome.toLowerCase().includes("combustível") || c.nome.toLowerCase().includes("combustivel"));
      // Buscar conta "Outras Despesas de Setores" para lançamentos de setor
      const contaOutrasDesp = contas.find(c => c.nome.toLowerCase().includes("outras despesas de setores") || c.nome.toLowerCase().includes("outras despesas de setor"));

      // Buscar IDs de equipamentos excluídos do custo
      const equipExcluidos = await db2
        .select({ id: equipamentos.id })
        .from(equipamentos)
        .where(sql`${equipamentos.excluidoCusto} = 'sim'`);
      const idsEquipExcluidos = new Set(equipExcluidos.map(e => e.id));

      // Filtrar equipamentos selecionados (excluindo também os marcados como excluidoCusto)
      const selecionadosTags = new Set(input.equipamentosSelecionados.map(e => e.codigoTag));
      const equipamentosParaImportar = parsed.equipamentos.filter(e => {
        // Excluir tags marcadas como EXCLUIR ou NÃO LANÇAR
        if (TAGS_EXCLUIR.some(t => e.codigoTag.toUpperCase().includes(t.toUpperCase()))) return false;
        if (TAGS_NAO_LANCAR.some(t => e.codigoTag.toUpperCase() === t.toUpperCase())) return false;
        // Excluir equipamentos marcados como excluidoCusto no cadastro
        const selecionado = input.equipamentosSelecionados.find(s => s.codigoTag === e.codigoTag);
        if (selecionado?.equipamentoSistemaId && idsEquipExcluidos.has(selecionado.equipamentoSistemaId)) return false;
        return selecionadosTags.has(e.codigoTag);
      });

      const lancamentos: Array<{
        periodoCustoId: number;
        contaCustoId: number;
        valor: string;
        observacoes: string;
        userId: number;
      }> = [];

      let totalImportado = 0;
      let totalLubrificantes = 0;
      let totalPecasDesgaste = 0;
      let totalPecasReposicao = 0;
      let totalOutrasDespesas = 0;

      // Buscar conta "Explosivos e Acessórios" para lançamentos de explosivos
      const contaExplosivos = contas.find(c => c.nome.toLowerCase().includes("explosivos"));

      for (const equip of equipamentosParaImportar) {
        // Verificar se é item de "Explosivos e Acessórios" (conta específica de setor)
        const isExplosivos = TAGS_CONTA_EXPLOSIVOS.some(t => equip.codigoTag.toUpperCase() === t.toUpperCase());
        if (isExplosivos && contaExplosivos) {
          // Lançar como Explosivos e Acessórios (conta específica)
          const totalEquip = equip.despesas.reduce((sum, d) => sum + d.custo, 0);
          if (totalEquip > 0) {
            lancamentos.push({
              periodoCustoId: periodoId,
              contaCustoId: contaExplosivos.id,
              valor: totalEquip.toFixed(2),
              observacoes: `[Import] ${equip.codigoTag} - ${equip.descricao} | Explosivos e Acessórios (Despesa Específica de Setor)`,
              userId: ctx.user.id,
            });
            totalImportado += totalEquip;
          }
          continue;
        }

        // Verificar se é item de "Outras Desp. Setor"
        const setorDestino = TAGS_OUTRAS_DESP_SETOR[equip.codigoTag];
        if (setorDestino && contaOutrasDesp) {
          // Lançar como Outras Despesas de Setor
          const totalEquip = equip.despesas.reduce((sum, d) => sum + d.custo, 0);
          if (totalEquip > 0) {
            lancamentos.push({
              periodoCustoId: periodoId,
              contaCustoId: contaOutrasDesp.id,
              valor: totalEquip.toFixed(2),
              observacoes: `[Import] ${equip.codigoTag} - ${equip.descricao} | Outras Desp. Setor → ${setorDestino}`,
              userId: ctx.user.id,
            });
            totalImportado += totalEquip;
            totalOutrasDespesas += totalEquip;
          }
          continue;
        }

        // Correção de valor da TRANSPORTADORA
        let fatorCorrecao = 1;
        if (equip.codigoTag === "TRANSPORTADORA" && equip.totalGeral > 10000) {
          // Valor correto informado pelo usuário: R$ 596,89
          fatorCorrecao = VALOR_CORRECAO_TRANSPORTADORA / equip.totalGeral;
        }

        const porClassificacao = { lubrificantes: 0, pecas_desgaste: 0, pecas_reposicao: 0, outras_despesas: 0, combustivel: 0 };
        for (const desp of equip.despesas) {
          porClassificacao[desp.classificacao] += desp.custo * fatorCorrecao;
        }

        if (porClassificacao.lubrificantes > 0) {
          lancamentos.push({ periodoCustoId: periodoId, contaCustoId: contaLubrificantes.id, valor: porClassificacao.lubrificantes.toFixed(2), observacoes: `[Import] ${equip.codigoTag} - ${equip.descricao} | Lubrificantes`, userId: ctx.user.id });
          totalLubrificantes += porClassificacao.lubrificantes;
        }
        if (porClassificacao.pecas_desgaste > 0) {
          lancamentos.push({ periodoCustoId: periodoId, contaCustoId: contaPecasDesgaste.id, valor: porClassificacao.pecas_desgaste.toFixed(2), observacoes: `[Import] ${equip.codigoTag} - ${equip.descricao} | Peças de Desgaste`, userId: ctx.user.id });
          totalPecasDesgaste += porClassificacao.pecas_desgaste;
        }
        if (porClassificacao.pecas_reposicao > 0) {
          lancamentos.push({ periodoCustoId: periodoId, contaCustoId: contaPecasReposicao.id, valor: porClassificacao.pecas_reposicao.toFixed(2), observacoes: `[Import] ${equip.codigoTag} - ${equip.descricao} | Peças de Reposição`, userId: ctx.user.id });
          totalPecasReposicao += porClassificacao.pecas_reposicao;
        }
        if (porClassificacao.outras_despesas > 0) {
          lancamentos.push({ periodoCustoId: periodoId, contaCustoId: contaOutrasDespesas.id, valor: porClassificacao.outras_despesas.toFixed(2), observacoes: `[Import] ${equip.codigoTag} - ${equip.descricao} | Outras Despesas`, userId: ctx.user.id });
          totalOutrasDespesas += porClassificacao.outras_despesas;
        }
        if (porClassificacao.combustivel > 0 && contaCombustivel) {
          lancamentos.push({ periodoCustoId: periodoId, contaCustoId: contaCombustivel.id, valor: porClassificacao.combustivel.toFixed(2), observacoes: `[Import] ${equip.codigoTag} - ${equip.descricao} | Combustível`, userId: ctx.user.id });
        }
        totalImportado += equip.totalGeral * fatorCorrecao;
      }

      // Inserir lançamentos em batch
      if (lancamentos.length > 0) {
        for (let i = 0; i < lancamentos.length; i += 100) {
          const batch = lancamentos.slice(i, i + 100);
          await db2.insert(lancamentoCusto).values(batch);
        }
      }

      // ===== GRAVAR ITENS DETALHADOS =====
      // Mapear equipamentosSelecionados para obter o equipamentoSistemaId
      const tagToSistemaId = new Map<string, number | undefined>();
      for (const sel of input.equipamentosSelecionados) {
        tagToSistemaId.set(sel.codigoTag, sel.equipamentoSistemaId);
      }

      const itensDetalhados: Array<{
        periodoCustoId: number;
        equipamentoTag: string;
        equipamentoDescricao: string | null;
        equipamentoSistemaId: number | null;
        classificacao: string;
        sequencia: string | null;
        data: string | null;
        produto: string;
        grupoProduto: string | null;
        quantidade: string;
        custo: string;
        centroCusto: string | null;
        hodometro: string | null;
        intervalo: string | null;
        horaPorLitro: string | null;
        litrosPorHora: string | null;
        observacoes: string | null;
        userId: number;
      }> = [];

      for (const equip of equipamentosParaImportar) {
        const sistemaId = tagToSistemaId.get(equip.codigoTag) || null;
        let fator = 1;
        if (equip.codigoTag === "TRANSPORTADORA" && equip.totalGeral > 10000) {
          fator = VALOR_CORRECAO_TRANSPORTADORA / equip.totalGeral;
        }
        for (const desp of equip.despesas) {
          itensDetalhados.push({
            periodoCustoId: periodoId,
            equipamentoTag: equip.codigoTag,
            equipamentoDescricao: equip.descricao || null,
            equipamentoSistemaId: sistemaId && sistemaId > 0 ? sistemaId : null,
            classificacao: desp.classificacao,
            sequencia: desp.sequencia || null,
            data: desp.data || null,
            produto: desp.produto,
            grupoProduto: desp.grupoProduto || null,
            quantidade: desp.quantidade.toString(),
            custo: (desp.custo * fator).toFixed(2),
            centroCusto: desp.centroCusto || null,
            hodometro: desp.hodometro != null ? desp.hodometro.toString() : null,
            intervalo: desp.intervalo != null ? desp.intervalo.toString() : null,
            horaPorLitro: desp.horaPorLitro || null,
            litrosPorHora: desp.litrosPorHora || null,
            observacoes: desp.observacoes || null,
            userId: ctx.user.id,
          });
        }
      }

      // Inserir itens detalhados em batch
      if (itensDetalhados.length > 0) {
        for (let i = 0; i < itensDetalhados.length; i += 100) {
          const batch = itensDetalhados.slice(i, i + 100);
          await db2.insert(itemDespesaImportado).values(batch);
        }
      }

      return {
        sucesso: true,
        periodoId,
        totalEquipamentos: equipamentosParaImportar.length,
        totalLancamentos: lancamentos.length,
        totalItensDetalhados: itensDetalhados.length,
        totalImportado,
        resumo: { lubrificantes: totalLubrificantes, pecasDesgaste: totalPecasDesgaste, pecasReposicao: totalPecasReposicao, outrasDespesas: totalOutrasDespesas },
      };;
    }),

  salvarRevisaoCorrespondencias: protectedProcedure
    .input(z.object({
      correspondencias: z.array(z.object({
        id: z.number(),
        tag: z.string(),
        matchId: z.number(),
        matchNome: z.string(),
        status: z.string(),
        observacao: z.string(),
      })),
      semMatch: z.array(z.object({
        id: z.number(),
        tag: z.string(),
        desc: z.string(),
        acao: z.string(),
        observacao: z.string(),
      })),
    }))
    .mutation(async ({ input }) => {
      return {
        sucesso: true,
        totalCorrespondencias: input.correspondencias.length,
        aprovadas: input.correspondencias.filter((c: any) => c.status === 'aprovado').length,
        rejeitadas: input.correspondencias.filter((c: any) => c.status === 'rejeitado').length,
        totalSemMatch: input.semMatch.length,
        cadastrar: input.semMatch.filter((s: any) => s.acao === 'CADASTRAR').length,
        excluir: input.semMatch.filter((s: any) => s.acao === 'EXCLUIR').length,
      };
    }),
});
