import { z } from "zod";
import { eq, and, sql } from "drizzle-orm";
import { router, protectedProcedure, requirePermission } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import {
  simulacaoDespesaParcial,
  simulacaoFluxoParcial,
  equipamentos,
  gruposDeEquipamentos,
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
import {
  CONTAS_IMPORTAR,
  CONTAS_EXCLUIR,
  CONTAS_INDIVIDUAIS_EXCLUIR,
  EXCECOES_IMPORTAR,
  extrairCodigoNome,
  detectarNivel,
  getSetorEnergia,
} from "./importFluxo_correspondencias";

// ===== REGRAS DE CLASSIFICAÇÃO (reutilizadas do importDespesas) =====

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
const PECAS_DESGASTE_ESCAVADEIRA = ["unha", "dente", "ponta de unha", "pino trava", "capa de desgaste", "adaptador", "ponteira"];
const PECAS_DESGASTE_PA_CARREGADEIRA = ["protetor de lamina", "protetor de lâmina", "concha", "chapa metalica", "chapa metálica", "chapa lisa", "lamina bico de pato", "lâmina bico de pato", "bico lateral", "lamina usada", "lâmina usada", "b. pato", "bico pato"];
const PECAS_DESGASTE_BRITADOR = ["mandibula", "mandíbula", "revestimento", "cunha", "placa de distribuicao", "placa de distribuição", "anel concavo", "anel côncavo", "manta"];
const PECAS_DESGASTE_PENEIRA = ["tela", "telas"];
const PECAS_DESGASTE_TRANSPORTADORA = ["rolete", "roletes"];
const PECAS_DESGASTE_PERFURATRIZ = ["bit", "punho", "haste", "luva t-38", "luva t38", "coroa de botao", "coroa de botão"];
const PECAS_DESGASTE_CAMINHAO = ["chapa metalica", "chapa metálica", "chapa lisa"];
const COMBUSTIVEL_KEYWORDS = ["oleo diesel", "óleo diesel", "gasolina", "alcool", "álcool", "etanol", "diesel s10", "diesel s500", "diesel s-10", "diesel s-500"];

const GRUPOS_EXCLUIR_DEFAULT = ["SOLOMIN"];
const EQUIPAMENTOS_EXCLUIR_KEYWORDS = [
  "CD MURIBECA", "CD. UMBAUBA", "CD UMBAUBA", "ENSACADEIRA SOLOMIN",
  "ITABLOQUE", "ITABLOCK", "MISTURADOR SOLO",
  "SOLOMIN", "PENEIRA RESERVA", "TRANSPORTADOR RM",
  "CD SERRA DO MACHADO", "QMD 4977", "TOA1F53"
];

function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function classificarDespesa(
  descricaoProduto: string,
  grupoProduto: string,
  nomeEquipamento: string
): "lubrificantes" | "pecas_desgaste" | "outras_despesas" | "pecas_reposicao" | "combustivel" {
  const desc = norm(descricaoProduto);
  const equip = norm(nomeEquipamento);
  const grupo = grupoProduto.toLowerCase();
  if (grupo.includes("combustível") || grupo.includes("combustivel")) return "combustivel";
  if (COMBUSTIVEL_KEYWORDS.some(kw => desc.includes(norm(kw)))) return "combustivel";
  if (grupo === "lubrificantes") return "lubrificantes";
  if (LUBRIFICANTES_KEYWORDS.some(kw => desc.includes(norm(kw)))) return "lubrificantes";
  if (OUTRAS_DESPESAS_KEYWORDS.some(kw => desc.includes(norm(kw)))) return "outras_despesas";
  if (PECAS_DESGASTE_GERAL.some(kw => desc.includes(kw))) return "pecas_desgaste";

  const isEscavadeira = equip.includes("escavadeira") || equip.includes("escav");
  const isPaCarregadeira = equip.includes("pa carreg") || equip.includes("carregadeira");
  const isBritador = equip.includes("britador") || equip.includes("britagem") || equip.includes("cone") || equip.includes("mandibula");
  const isPeneira = equip.includes("peneira");
  const isTransportadora = equip.includes("transp") || equip.includes("correia") || equip.includes("tc");
  const isPerfuratriz = equip.includes("perfuratriz") || equip.includes("perfurat");
  const isCaminhao = equip.includes("caminhao") || equip.includes("basculante") || equip.includes("mb ") || equip.includes("mercedes") || equip.includes("volvo");

  if (isEscavadeira && PECAS_DESGASTE_ESCAVADEIRA.some(kw => desc.includes(norm(kw)))) return "pecas_desgaste";
  if (isPaCarregadeira && PECAS_DESGASTE_PA_CARREGADEIRA.some(kw => desc.includes(norm(kw)))) return "pecas_desgaste";
  if (isBritador && PECAS_DESGASTE_BRITADOR.some(kw => desc.includes(norm(kw)))) return "pecas_desgaste";
  if (isPeneira && PECAS_DESGASTE_PENEIRA.some(kw => desc.includes(norm(kw)))) return "pecas_desgaste";
  if (isTransportadora && PECAS_DESGASTE_TRANSPORTADORA.some(kw => desc.includes(norm(kw)))) return "pecas_desgaste";
  if (isPerfuratriz && PECAS_DESGASTE_PERFURATRIZ.some(kw => desc.includes(norm(kw)))) return "pecas_desgaste";
  if (isCaminhao && PECAS_DESGASTE_CAMINHAO.some(kw => desc.includes(norm(kw)))) return "pecas_desgaste";

  return "pecas_reposicao";
}

function deveExcluirEquipamento(nomeEquipPlanilha: string, grupoPlanilha: string): boolean {
  if (CORRESPONDENCIAS_FORCADAS[nomeEquipPlanilha]) return false;
  if (TAGS_OUTRAS_DESP_SETOR[nomeEquipPlanilha]) return false;
  if (GRUPOS_EXCLUIR_DEFAULT.some(g => grupoPlanilha.toUpperCase().includes(g))) return true;
  if (EQUIPAMENTOS_EXCLUIR_KEYWORDS.some(kw => nomeEquipPlanilha.toUpperCase().includes(kw.toUpperCase()))) return true;
  return false;
}

// ===== PARSER DE DESPESAS (simplificado para simulação) =====

interface DespesaParcialParsed {
  equipamentoTag: string;
  equipamentoDescricao: string;
  classificacao: "lubrificantes" | "pecas_desgaste" | "outras_despesas" | "pecas_reposicao" | "combustivel";
  sequencia: string;
  data: string;
  produto: string;
  grupoProduto: string;
  quantidade: number;
  custo: number;
  centroCusto: string;
}

function parsePlanilhaDespesasParcial(buffer: Buffer): {
  itens: DespesaParcialParsed[];
  totalGeral: number;
  totalPorClassificacao: Record<string, number>;
  equipamentosEncontrados: number;
  dataMinima: string;
  dataMaxima: string;
} {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

  const itens: DespesaParcialParsed[] = [];
  let currentTag = "";
  let currentDescricao = "";
  let currentGrupo = "";
  let skipNextHeader = false;
  const equipamentosSet = new Set<string>();
  let dataMinima = "9999-99-99";
  let dataMaxima = "0000-00-00";

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const col0 = String(row[0] || "").trim();

    // Detectar linha de equipamento
    if (col0.includes("Grupo:") && col0.includes("-")) {
      const grupoMatch = col0.match(/Grupo:\s*(.+)$/i);
      currentGrupo = grupoMatch ? grupoMatch[1].trim() : "";
      const beforeGrupo = col0.replace(/\s*-\s*Grupo:.*$/, "");
      const parts = beforeGrupo.split("-").map((p: string) => p.trim());
      currentTag = (parts[0] || "").replace(/\s+/g, " ").trim();
      currentDescricao = parts.slice(1).join(" - ").trim();

      // Verificar se deve excluir
      if (deveExcluirEquipamento(currentTag, currentGrupo)) {
        currentTag = ""; // Marca para pular
      } else {
        equipamentosSet.add(currentTag);
      }
      skipNextHeader = true;
      continue;
    }

    if (skipNextHeader && (col0 === "Sequên" || col0 === "Sequen")) {
      skipNextHeader = false;
      continue;
    }

    if (!currentTag) continue;
    if (col0 === "" || col0 === "Total Geral:" || col0 === "Emitido em:") continue;

    const seq = Number(col0);
    if (!isNaN(seq) && seq > 0) {
      const dataStr = String(row[3] || "").trim();
      const produto = String(row[8] || "").trim();
      const grupoProduto = String(row[15] || "").trim();
      const quantidade = Number(row[19]) || 0;
      const custo = Number(row[23]) || 0;
      const centroCusto = String(row[26] || "").trim();

      if (custo === 0) continue;

      const classificacao = classificarDespesa(produto, grupoProduto, currentDescricao);

      // Rastrear datas
      if (dataStr) {
        // Converter dd/mm/aa para comparação
        const parts = dataStr.split("/");
        if (parts.length === 3) {
          const isoDate = `20${parts[2]}-${parts[1]}-${parts[0]}`;
          if (isoDate < dataMinima) dataMinima = isoDate;
          if (isoDate > dataMaxima) dataMaxima = isoDate;
        }
      }

      itens.push({
        equipamentoTag: currentTag,
        equipamentoDescricao: currentDescricao,
        classificacao,
        sequencia: col0,
        data: dataStr,
        produto,
        grupoProduto,
        quantidade,
        custo,
        centroCusto,
      });
    }
  }

  const totalGeral = itens.reduce((sum, item) => sum + item.custo, 0);
  const totalPorClassificacao: Record<string, number> = {};
  for (const item of itens) {
    totalPorClassificacao[item.classificacao] = (totalPorClassificacao[item.classificacao] || 0) + item.custo;
  }

  return {
    itens,
    totalGeral,
    totalPorClassificacao,
    equipamentosEncontrados: equipamentosSet.size,
    dataMinima: dataMinima === "9999-99-99" ? "" : dataMinima,
    dataMaxima: dataMaxima === "0000-00-00" ? "" : dataMaxima,
  };
}

// ===== PARSER DE FLUXO (simplificado para simulação) =====

interface FluxoParcialParsed {
  contaPrincipalCodigo: string;
  contaPrincipalNome: string;
  contaSistema: string;
  setor: string;
  contaCodigo: string;
  contaNome: string;
  nivel: number;
  valor: number;
  observacoes: string | null;
}

function parsePlanilhaFluxoParcial(buffer: Buffer, extraExcluidos: string[] = []): {
  itens: FluxoParcialParsed[];
  totalGeral: number;
  totalPorConta: Record<string, number>;
  contasEncontradas: number;
  periodo: string;
} {
  const todasExclusoesIndividuais = [...CONTAS_INDIVIDUAIS_EXCLUIR, ...extraExcluidos];
  const wb = XLSX.read(buffer, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rawData = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

  // Extrair período
  const headerRow = rawData[0] || [];
  const dataInicio = headerRow[4] || 0;
  let periodo = "";
  if (typeof dataInicio === "number" && dataInicio > 0) {
    const d = new Date((dataInicio - 25569) * 86400 * 1000);
    const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    periodo = `${meses[d.getMonth()]}/${d.getFullYear()}`;
  }

  // Parse hierárquico
  interface ContaParsed {
    codigo: string;
    nome: string;
    nivel: number;
    valor: number | null;
    observacoes: string | null;
    contaPrincipalCodigo: string;
    contaPrincipalNome: string;
  }

  const contasParsed: ContaParsed[] = [];
  let contaPrincipalAtual: { codigo: string; nome: string } | null = null;

  for (let i = 1; i < rawData.length; i++) {
    const row = rawData[i];
    if (!row || !row[0]) continue;
    const col0 = String(row[0]);
    const trimmed = col0.trim();

    if (trimmed === "ENTRADAS" || trimmed === "SAIDAS" || trimmed.startsWith("Total") ||
        trimmed.startsWith("Page ") || trimmed === "" || trimmed === "Item") continue;

    const nivel = detectarNivel(col0);
    if (nivel === 0) continue;

    const parsed = extrairCodigoNome(trimmed);
    if (!parsed) continue;

    const valor = typeof row[1] === "number" ? row[1] : null;
    const obs = typeof row[2] === "string" ? row[2].trim() : null;

    if (nivel === 1) {
      contaPrincipalAtual = { codigo: parsed.codigo, nome: parsed.nome };
    }

    if (valor !== null && contaPrincipalAtual) {
      contasParsed.push({
        ...parsed,
        nivel,
        valor,
        observacoes: obs,
        contaPrincipalCodigo: contaPrincipalAtual.codigo,
        contaPrincipalNome: contaPrincipalAtual.nome,
      });
    }
  }

  // Classificar contas
  const itens: FluxoParcialParsed[] = [];
  const contasSet = new Set<string>();

  for (const conta of contasParsed) {
    // Verificar se a conta principal deve ser excluída
    if (CONTAS_EXCLUIR.includes(conta.contaPrincipalCodigo)) {
      // Verificar exceções
      const excecao = EXCECOES_IMPORTAR.find(e => e.codigo === conta.codigo);
      if (!excecao) continue;
      itens.push({
        contaPrincipalCodigo: conta.codigo,
        contaPrincipalNome: conta.nome,
        contaSistema: excecao.contaSistema,
        setor: excecao.setor,
        contaCodigo: conta.codigo,
        contaNome: conta.nome,
        nivel: conta.nivel,
        valor: conta.valor!,
        observacoes: conta.observacoes,
      });
      contasSet.add(excecao.contaSistema);
      continue;
    }

    // Verificar se está na lista de importação
    const config = CONTAS_IMPORTAR.find(c => c.codigo === conta.contaPrincipalCodigo);
    if (!config) continue;

    // Verificar exclusões individuais
    if (todasExclusoesIndividuais.includes(conta.codigo)) continue;

    // Determinar setor (rateio de energia se aplicável)
    let setor = config.setor;
    if (config.rateioEspecial && conta.nivel >= 2) {
      const setorEnergia = getSetorEnergia(conta.codigo);
      if (setorEnergia?.setor) setor = setorEnergia.setor;
    }

    itens.push({
      contaPrincipalCodigo: conta.contaPrincipalCodigo,
      contaPrincipalNome: conta.contaPrincipalNome,
      contaSistema: config.contaSistema,
      setor,
      contaCodigo: conta.codigo,
      contaNome: conta.nome,
      nivel: conta.nivel,
      valor: conta.valor!,
      observacoes: conta.observacoes,
    });
    contasSet.add(config.contaSistema);
  }

  const totalGeral = itens.reduce((sum, item) => sum + item.valor, 0);
  const totalPorConta: Record<string, number> = {};
  for (const item of itens) {
    totalPorConta[item.contaSistema] = (totalPorConta[item.contaSistema] || 0) + item.valor;
  }

  return {
    itens,
    totalGeral,
    totalPorConta,
    contasEncontradas: contasSet.size,
    periodo,
  };
}

// ===== ROUTER =====

export const simulacaoParcialRouter = router({
  // Parse da planilha de despesas de equipamentos (prévia)
  parseDespesas: protectedProcedure
    .use(requirePermission("custos", "edit"))
    .input(z.object({
      fileBase64: z.string(),
      fileName: z.string(),
      mes: z.number().min(1).max(12),
      ano: z.number().min(2025).max(2030),
    }))
    .mutation(async ({ input }) => {
      const buffer = Buffer.from(input.fileBase64, "base64");
      const resultado = parsePlanilhaDespesasParcial(buffer);

      return {
        totalGeral: resultado.totalGeral,
        totalPorClassificacao: resultado.totalPorClassificacao,
        equipamentosEncontrados: resultado.equipamentosEncontrados,
        totalItens: resultado.itens.length,
        dataMinima: resultado.dataMinima,
        dataMaxima: resultado.dataMaxima,
      };
    }),

  // Confirmar importação parcial de despesas
  confirmarDespesas: protectedProcedure
    .use(requirePermission("custos", "edit"))
    .input(z.object({
      fileBase64: z.string(),
      fileName: z.string(),
      mes: z.number().min(1).max(12),
      ano: z.number().min(2025).max(2030),
      dataInicio: z.string(), // YYYY-MM-DD
      dataFim: z.string(),    // YYYY-MM-DD
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const buffer = Buffer.from(input.fileBase64, "base64");
      const resultado = parsePlanilhaDespesasParcial(buffer);

      if (resultado.itens.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Nenhum item encontrado na planilha" });
      }

      // Limpar dados parciais anteriores do mesmo mês/ano
      await db.delete(simulacaoDespesaParcial)
        .where(and(
          eq(simulacaoDespesaParcial.mes, input.mes),
          eq(simulacaoDespesaParcial.ano, input.ano),
        ));

      // Inserir novos dados parciais em lotes
      const batchSize = 100;
      for (let i = 0; i < resultado.itens.length; i += batchSize) {
        const batch = resultado.itens.slice(i, i + batchSize);
        await db.insert(simulacaoDespesaParcial).values(
          batch.map(item => ({
            mes: input.mes,
            ano: input.ano,
            dataInicio: input.dataInicio,
            dataFim: input.dataFim,
            equipamentoTag: item.equipamentoTag,
            equipamentoDescricao: item.equipamentoDescricao,
            equipamentoSistemaId: null,
            classificacao: item.classificacao,
            sequencia: item.sequencia,
            data: item.data,
            produto: item.produto,
            grupoProduto: item.grupoProduto,
            quantidade: String(item.quantidade),
            custo: String(item.custo),
            centroCusto: item.centroCusto,
            observacoes: null,
            userId: ctx.user.id,
          }))
        );
      }

      return {
        success: true,
        totalItens: resultado.itens.length,
        totalGeral: resultado.totalGeral,
        totalPorClassificacao: resultado.totalPorClassificacao,
        dataMinima: resultado.dataMinima,
        dataMaxima: resultado.dataMaxima,
      };
    }),

  // Parse da planilha de fluxo realizado (prévia)
  parseFluxo: protectedProcedure
    .use(requirePermission("custos", "edit"))
    .input(z.object({
      fileBase64: z.string(),
      fileName: z.string(),
      mes: z.number().min(1).max(12),
      ano: z.number().min(2025).max(2030),
    }))
    .mutation(async ({ input }) => {
      const buffer = Buffer.from(input.fileBase64, "base64");
      const resultado = parsePlanilhaFluxoParcial(buffer);

      return {
        totalGeral: resultado.totalGeral,
        totalPorConta: resultado.totalPorConta,
        contasEncontradas: resultado.contasEncontradas,
        totalItens: resultado.itens.length,
        periodo: resultado.periodo,
      };
    }),

  // Confirmar importação parcial de fluxo
  confirmarFluxo: protectedProcedure
    .use(requirePermission("custos", "edit"))
    .input(z.object({
      fileBase64: z.string(),
      fileName: z.string(),
      mes: z.number().min(1).max(12),
      ano: z.number().min(2025).max(2030),
      dataInicio: z.string(),
      dataFim: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const buffer = Buffer.from(input.fileBase64, "base64");
      const resultado = parsePlanilhaFluxoParcial(buffer);

      if (resultado.itens.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Nenhuma conta encontrada na planilha" });
      }

      // Limpar dados parciais anteriores do mesmo mês/ano
      await db.delete(simulacaoFluxoParcial)
        .where(and(
          eq(simulacaoFluxoParcial.mes, input.mes),
          eq(simulacaoFluxoParcial.ano, input.ano),
        ));

      // Inserir novos dados parciais em lotes
      const batchSize = 100;
      for (let i = 0; i < resultado.itens.length; i += batchSize) {
        const batch = resultado.itens.slice(i, i + batchSize);
        await db.insert(simulacaoFluxoParcial).values(
          batch.map(item => ({
            mes: input.mes,
            ano: input.ano,
            dataInicio: input.dataInicio,
            dataFim: input.dataFim,
            contaPrincipalCodigo: item.contaPrincipalCodigo,
            contaPrincipalNome: item.contaPrincipalNome,
            contaSistema: item.contaSistema,
            setor: item.setor,
            contaCodigo: item.contaCodigo,
            contaNome: item.contaNome,
            nivel: item.nivel,
            valor: String(item.valor),
            observacoes: item.observacoes,
            userId: ctx.user.id,
          }))
        );
      }

      return {
        success: true,
        totalItens: resultado.itens.length,
        totalGeral: resultado.totalGeral,
        totalPorConta: resultado.totalPorConta,
      };
    }),

  // Consultar dados parciais existentes para um mês/ano
  getStatus: protectedProcedure
    .use(requirePermission("custos", "view"))
    .input(z.object({
      mes: z.number().min(1).max(12),
      ano: z.number().min(2020),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Buscar despesas parciais
      const despesas = await db.select().from(simulacaoDespesaParcial)
        .where(and(
          eq(simulacaoDespesaParcial.mes, input.mes),
          eq(simulacaoDespesaParcial.ano, input.ano),
        ));

      // Buscar fluxo parcial
      const fluxo = await db.select().from(simulacaoFluxoParcial)
        .where(and(
          eq(simulacaoFluxoParcial.mes, input.mes),
          eq(simulacaoFluxoParcial.ano, input.ano),
        ));

      // Resumo despesas
      let despesasResumo = null;
      if (despesas.length > 0) {
        const totalGeral = despesas.reduce((sum, d) => sum + parseFloat(String(d.custo || '0')), 0);
        const totalPorClassificacao: Record<string, number> = {};
        for (const d of despesas) {
          totalPorClassificacao[d.classificacao] = (totalPorClassificacao[d.classificacao] || 0) + parseFloat(String(d.custo || '0'));
        }
        despesasResumo = {
          totalItens: despesas.length,
          totalGeral,
          totalPorClassificacao,
          dataInicio: despesas[0].dataInicio,
          dataFim: despesas[0].dataFim,
          importadoEm: despesas[0].createdAt,
        };
      }

      // Resumo fluxo
      let fluxoResumo = null;
      if (fluxo.length > 0) {
        const totalGeral = fluxo.reduce((sum, f) => sum + parseFloat(String(f.valor || '0')), 0);
        const totalPorConta: Record<string, number> = {};
        for (const f of fluxo) {
          totalPorConta[f.contaSistema] = (totalPorConta[f.contaSistema] || 0) + parseFloat(String(f.valor || '0'));
        }
        fluxoResumo = {
          totalItens: fluxo.length,
          totalGeral,
          totalPorConta,
          dataInicio: fluxo[0].dataInicio,
          dataFim: fluxo[0].dataFim,
          importadoEm: fluxo[0].createdAt,
        };
      }

      return {
        temDespesasParciais: despesas.length > 0,
        temFluxoParcial: fluxo.length > 0,
        despesas: despesasResumo,
        fluxo: fluxoResumo,
      };
    }),

  // Limpar dados parciais de um mês/ano
  limpar: protectedProcedure
    .use(requirePermission("custos", "edit"))
    .input(z.object({
      mes: z.number().min(1).max(12),
      ano: z.number().min(2020),
      tipo: z.enum(["despesas", "fluxo", "ambos"]),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      if (input.tipo === "despesas" || input.tipo === "ambos") {
        await db.delete(simulacaoDespesaParcial)
          .where(and(
            eq(simulacaoDespesaParcial.mes, input.mes),
            eq(simulacaoDespesaParcial.ano, input.ano),
          ));
      }

      if (input.tipo === "fluxo" || input.tipo === "ambos") {
        await db.delete(simulacaoFluxoParcial)
          .where(and(
            eq(simulacaoFluxoParcial.mes, input.mes),
            eq(simulacaoFluxoParcial.ano, input.ano),
          ));
      }

      return { success: true };
    }),

  // Obter totais parciais agregados por classificação (para uso na simulação)
  getTotaisParciais: protectedProcedure
    .use(requirePermission("custos", "view"))
    .input(z.object({
      mes: z.number().min(1).max(12),
      ano: z.number().min(2020),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Despesas parciais por classificação
      const despesas = await db.select().from(simulacaoDespesaParcial)
        .where(and(
          eq(simulacaoDespesaParcial.mes, input.mes),
          eq(simulacaoDespesaParcial.ano, input.ano),
        ));

      const despesasPorClassificacao: Record<string, number> = {};
      let despesasDataInicio = "";
      let despesasDataFim = "";
      let despesasDiasAbrangidos = 0;

      if (despesas.length > 0) {
        despesasDataInicio = despesas[0].dataInicio;
        despesasDataFim = despesas[0].dataFim;
        const dtI = new Date(despesasDataInicio);
        const dtF = new Date(despesasDataFim);
        despesasDiasAbrangidos = Math.max(1, Math.floor((dtF.getTime() - dtI.getTime()) / (1000 * 60 * 60 * 24)) + 1);

        for (const d of despesas) {
          despesasPorClassificacao[d.classificacao] = (despesasPorClassificacao[d.classificacao] || 0) + parseFloat(String(d.custo || '0'));
        }
      }

      // Fluxo parcial por conta do sistema
      const fluxo = await db.select().from(simulacaoFluxoParcial)
        .where(and(
          eq(simulacaoFluxoParcial.mes, input.mes),
          eq(simulacaoFluxoParcial.ano, input.ano),
        ));

      const fluxoPorConta: Record<string, number> = {};
      let fluxoDataInicio = "";
      let fluxoDataFim = "";
      let fluxoDiasAbrangidos = 0;

      if (fluxo.length > 0) {
        fluxoDataInicio = fluxo[0].dataInicio;
        fluxoDataFim = fluxo[0].dataFim;
        const dtI = new Date(fluxoDataInicio);
        const dtF = new Date(fluxoDataFim);
        fluxoDiasAbrangidos = Math.max(1, Math.floor((dtF.getTime() - dtI.getTime()) / (1000 * 60 * 60 * 24)) + 1);

        for (const f of fluxo) {
          fluxoPorConta[f.contaSistema] = (fluxoPorConta[f.contaSistema] || 0) + parseFloat(String(f.valor || '0'));
        }
      }

      return {
        temDespesas: despesas.length > 0,
        temFluxo: fluxo.length > 0,
        despesas: {
          porClassificacao: despesasPorClassificacao,
          totalGeral: Object.values(despesasPorClassificacao).reduce((a, b) => a + b, 0),
          dataInicio: despesasDataInicio,
          dataFim: despesasDataFim,
          diasAbrangidos: despesasDiasAbrangidos,
        },
        fluxo: {
          porConta: fluxoPorConta,
          totalGeral: Object.values(fluxoPorConta).reduce((a, b) => a + b, 0),
          dataInicio: fluxoDataInicio,
          dataFim: fluxoDataFim,
          diasAbrangidos: fluxoDiasAbrangidos,
        },
      };
    }),
});
