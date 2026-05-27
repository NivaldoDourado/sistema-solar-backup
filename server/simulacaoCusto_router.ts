import { z } from "zod";
import { eq, and, desc, gte, lte, sql, asc } from "drizzle-orm";
import { router, protectedProcedure, requirePermission } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import {
  periodoCusto,
  custoSetor,
  abastecimento,
  parteDiaria,
  parteDiariaItens,
  servicos,
  lancamentoCusto,
  lancamentoSalario,
  contaCusto,
  metaCustoTonelada,
  producao,
  simulacaoDespesaParcial,
  simulacaoFluxoParcial,
} from "../drizzle/schema";

// Data de corte para Método Caminhões (igual ao periodoCusto_router)
const CORTE_ANO = 2026;
const CORTE_MES = 4; // Abril

// Helper para calcular primeiro e último dia do mês
function getMesDates(mes: number, ano: number) {
  const dataInicio = `${ano}-${String(mes).padStart(2, "0")}-01`;
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const dataFim = `${ano}-${String(mes).padStart(2, "0")}-${String(ultimoDia).padStart(2, "0")}`;
  return { dataInicio, dataFim, diasNoMes: ultimoDia };
}

// Retorna mês/ano anterior
function mesAnterior(mes: number, ano: number): { mes: number; ano: number } {
  if (mes === 1) return { mes: 12, ano: ano - 1 };
  return { mes: mes - 1, ano };
}

export const simulacaoCustoRouter = router({
  // ========================================================
  // META DE CUSTO POR TONELADA
  // ========================================================
  getMeta: protectedProcedure
    .use(requirePermission("custos", "view"))
    .query(async () => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const [meta] = await db.select().from(metaCustoTonelada).orderBy(desc(metaCustoTonelada.updatedAt)).limit(1);
      return meta ? { valor: parseFloat(String(meta.valor)) } : null;
    }),

  setMeta: protectedProcedure
    .use(requirePermission("custos", "edit"))
    .input(z.object({ valor: z.number().min(0) }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      // Buscar meta existente
      const [existente] = await db.select().from(metaCustoTonelada).orderBy(desc(metaCustoTonelada.updatedAt)).limit(1);
      if (existente) {
        await db.update(metaCustoTonelada)
          .set({ valor: String(input.valor), userId: ctx.user.id })
          .where(eq(metaCustoTonelada.id, existente.id));
      } else {
        await db.insert(metaCustoTonelada).values({
          valor: String(input.valor),
          userId: ctx.user.id,
        });
      }
      return { success: true };
    }),

  // Simulação principal: projeção do custo do mês corrente
  simular: protectedProcedure
    .use(requirePermission("custos", "view"))
    .input(z.object({
      mes: z.number().min(1).max(12),
      ano: z.number().min(2020),
      // Data final do período parcial (default: hoje)
      dataCorte: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const { dataInicio, dataFim, diasNoMes } = getMesDates(input.mes, input.ano);
      
      // Data de corte: se não informada, usa hoje ou último dia do mês (o que for menor)
      const hoje = new Date().toISOString().split("T")[0];
      const corte = input.dataCorte || (hoje < dataFim ? hoje : dataFim);
      
      // Calcular dias transcorridos
      const dtInicio = new Date(dataInicio);
      const dtCorte = new Date(corte);
      const diasTranscorridos = Math.max(1, Math.floor((dtCorte.getTime() - dtInicio.getTime()) / (1000 * 60 * 60 * 24)) + 1);
      const fatorProjecao = diasNoMes / diasTranscorridos;

      // ========================================================
      // 1. PRODUÇÃO ACUMULADA NO PERÍODO PARCIAL (Método Caminhões)
      // ========================================================
      const servicosData = await db.select().from(servicos);
      const servicosBritagemFixa = servicosData.filter(s =>
        s.nome.toUpperCase().includes('TRANSPORTE DE PEDRA PARA O BRITADOR') ||
        s.nome.toUpperCase().includes('ALIMENTANDO O BRITADOR PRIMARIO') ||
        s.nome.toUpperCase().includes('TRANSP. PEDRA DO ESTOQUE PARA O BRITADOR')
      ).map(s => s.id);
      const servicosBritagemMovel = servicosData.filter(s =>
        s.nome.toUpperCase().includes('TRANSPORTE DE PEDRA PARA BRITAGEM MOVEL')
      ).map(s => s.id);
      const servicosCaminhoes = [...servicosBritagemFixa, ...servicosBritagemMovel];

      const itensProducao = await db
        .select({
          servicoId: parteDiariaItens.servicoId,
          producao: parteDiariaItens.producao,
          data: parteDiaria.data,
        })
        .from(parteDiariaItens)
        .innerJoin(parteDiaria, eq(parteDiariaItens.parteDiariaId, parteDiaria.id));

      const itensProducaoFiltrados = itensProducao.filter(item => {
        if (!servicosCaminhoes.includes(item.servicoId)) return false;
        const itemDate = item.data instanceof Date ? item.data.toISOString().split('T')[0] : String(item.data).split('T')[0];
        return itemDate >= dataInicio && itemDate <= corte;
      });

      const producaoAcumulada = itensProducaoFiltrados.reduce((acc, item) => acc + parseFloat(item.producao || '0'), 0);
      const producaoProjetada = producaoAcumulada * fatorProjecao;

      // ========================================================
      // 2. COMBUSTÍVEL ACUMULADO NO PERÍODO PARCIAL
      // ========================================================
      const abastecimentosAll = await db.select().from(abastecimento);
      const abastecimentosFiltrados = abastecimentosAll.filter(item => {
        const itemDate = item.data instanceof Date ? item.data.toISOString().split('T')[0] : String(item.data).split('T')[0];
        return itemDate >= dataInicio && itemDate <= corte;
      });
      const combustivelAcumulado = abastecimentosFiltrados.reduce(
        (acc, item) => acc + parseFloat(String(item.valorTotal || '0')), 0
      );
      const combustivelProjetado = combustivelAcumulado * fatorProjecao;

      // ========================================================
      // 2.5 DADOS PARCIAIS IMPORTADOS (Simulação Avançada)
      // ========================================================
      const despesasParciais = await db.select().from(simulacaoDespesaParcial)
        .where(and(
          eq(simulacaoDespesaParcial.mes, input.mes),
          eq(simulacaoDespesaParcial.ano, input.ano),
        ));

      const fluxoParcial = await db.select().from(simulacaoFluxoParcial)
        .where(and(
          eq(simulacaoFluxoParcial.mes, input.mes),
          eq(simulacaoFluxoParcial.ano, input.ano),
        ));

      // Agregar despesas parciais por classificação
      const despesasParcialPorClassificacao: Record<string, number> = {};
      let despesasParcialTotal = 0;
      let despesasParcialDias = 0;
      if (despesasParciais.length > 0) {
        const dtI = new Date(despesasParciais[0].dataInicio);
        const dtF = new Date(despesasParciais[0].dataFim);
        despesasParcialDias = Math.max(1, Math.floor((dtF.getTime() - dtI.getTime()) / (1000 * 60 * 60 * 24)) + 1);
        for (const d of despesasParciais) {
          const val = parseFloat(String(d.custo || '0'));
          despesasParcialPorClassificacao[d.classificacao] = (despesasParcialPorClassificacao[d.classificacao] || 0) + val;
          despesasParcialTotal += val;
        }
      }

      // Agregar fluxo parcial por conta
      const fluxoParcialPorConta: Record<string, number> = {};
      let fluxoParcialTotal = 0;
      let fluxoParcialDias = 0;
      if (fluxoParcial.length > 0) {
        const dtI = new Date(fluxoParcial[0].dataInicio);
        const dtF = new Date(fluxoParcial[0].dataFim);
        fluxoParcialDias = Math.max(1, Math.floor((dtF.getTime() - dtI.getTime()) / (1000 * 60 * 60 * 24)) + 1);
        for (const f of fluxoParcial) {
          const val = parseFloat(String(f.valor || '0'));
          fluxoParcialPorConta[f.contaSistema] = (fluxoParcialPorConta[f.contaSistema] || 0) + val;
          fluxoParcialTotal += val;
        }
      }

      const temDadosParciais = despesasParciais.length > 0 || fluxoParcial.length > 0;

      // ========================================================
      // 3. HISTÓRICO DOS ÚLTIMOS 3 MESES (custos por setor)
      // ========================================================
      const meses3: { mes: number; ano: number }[] = [];
      let m = input.mes, a = input.ano;
      for (let i = 0; i < 3; i++) {
        const prev = mesAnterior(m, a);
        m = prev.mes;
        a = prev.ano;
        meses3.push({ mes: m, ano: a });
      }

      // Buscar períodos dos últimos 3 meses
      const periodosHistoricos = await db.select().from(periodoCusto);
      const periodosUltimos3 = meses3.map(p => 
        periodosHistoricos.find(ph => ph.mes === p.mes && ph.ano === p.ano)
      ).filter(Boolean) as typeof periodosHistoricos;

      // Buscar custos por setor dos últimos 3 meses
      const custoSetorHistorico: Array<{
        mes: number;
        ano: number;
        producaoTotal: number;
        custoTotal: number;
        setores: Array<{ grupoNome: string; totalGeral: number }>;
      }> = [];

      for (const periodo of periodosUltimos3) {
        const setores = await db
          .select()
          .from(custoSetor)
          .where(eq(custoSetor.periodoCustoId, periodo.id));

        // Agrupar por grupoNome
        const gruposMap = new Map<string, number>();
        for (const s of setores) {
          const atual = gruposMap.get(s.grupoNome) || 0;
          gruposMap.set(s.grupoNome, atual + parseFloat(String(s.totalGeral || '0')));
        }

        let custoTotal = Array.from(gruposMap.values()).reduce((a, b) => a + b, 0);

        // Fallback: se custo_setor estiver vazio, usar lancamento_custo + lancamento_salario
        // (mesma lógica da Apuração de Custo via listByPeriodo)
        if (custoTotal === 0) {
          const lancamentos = await db
            .select()
            .from(lancamentoCusto)
            .where(eq(lancamentoCusto.periodoCustoId, periodo.id));
          let custoLancamentos = lancamentos.reduce((acc, l) => acc + parseFloat(String(l.valor || '0')), 0);

          // Adicionar salários agregados (mesma lógica do lancamentoCusto_router.listByPeriodo)
          const salariosAgregados = await db
            .select({
              contaCustoId: lancamentoSalario.contaCustoId,
              totalValor: sql<string>`CAST(SUM(${lancamentoSalario.valor}) AS DECIMAL(14,2))`,
            })
            .from(lancamentoSalario)
            .where(eq(lancamentoSalario.periodoCustoId, periodo.id))
            .groupBy(lancamentoSalario.contaCustoId);
          const totalSalarios = salariosAgregados.reduce((acc, s) => acc + parseFloat(s.totalValor ?? '0'), 0);
          custoTotal = custoLancamentos + totalSalarios;

          // Agrupar lancamentos por conta para setores
          if (custoTotal > 0) {
            const contas = await db.select().from(contaCusto);
            const contasMap = new Map(contas.map(c => [c.id, c]));
            const lancGrupoMap = new Map<string, number>();
            for (const l of lancamentos) {
              const conta = contasMap.get(l.contaCustoId);
              const grupoNome = conta?.classificacao === 'custo_variavel' || conta?.classificacao === 'despesa_variavel' ? 'CUSTO VARIÁVEL' : 'CUSTO FIXO';
              lancGrupoMap.set(grupoNome, (lancGrupoMap.get(grupoNome) || 0) + parseFloat(String(l.valor || '0')));
            }
            // Adicionar salários ao grupo CUSTO VARIÁVEL
            for (const s of salariosAgregados) {
              const val = parseFloat(s.totalValor ?? '0');
              if (val > 0) {
                lancGrupoMap.set('CUSTO VARIÁVEL', (lancGrupoMap.get('CUSTO VARIÁVEL') || 0) + val);
              }
            }
            for (const [gNome, tGeral] of Array.from(lancGrupoMap.entries())) {
              gruposMap.set(gNome, (gruposMap.get(gNome) || 0) + tGeral);
            }
          }
        }

        // Produção: mesma lógica do getProducaoDoModulo (periodoCusto_router)
        // Abril/2026+: Método Caminhões (partes diárias)
        // Antes de abril/2026: tabela producao (legado)
        let producaoHist = 0;
        const usarMetodoCaminhoes = periodo.ano > CORTE_ANO || (periodo.ano === CORTE_ANO && periodo.mes >= CORTE_MES);

        if (usarMetodoCaminhoes) {
          // Método Caminhões: soma de toneladas transportadas
          const { dataInicio: hDataInicio, dataFim: hDataFim } = getMesDates(periodo.mes, periodo.ano);
          const itensHist = itensProducao.filter(item => {
            if (!servicosCaminhoes.includes(item.servicoId)) return false;
            const itemDate = item.data instanceof Date ? item.data.toISOString().split('T')[0] : String(item.data).split('T')[0];
            return itemDate >= hDataInicio && itemDate <= hDataFim;
          });
          producaoHist = itensHist.reduce((acc, item) => acc + parseFloat(item.producao || '0'), 0);
        } else {
          // Legado: tabela producao
          const { dataInicio: hDataInicio, dataFim: hDataFim } = getMesDates(periodo.mes, periodo.ano);
          const dtInicioH = new Date(hDataInicio + "T00:00:00");
          const dtFimH = new Date(hDataFim + "T23:59:59");
          const [resultProd] = await db
            .select({ total: sql<string>`COALESCE(SUM(${producao.quantidade}), 0)` })
            .from(producao)
            .where(and(gte(producao.data, dtInicioH), lte(producao.data, dtFimH)));
          producaoHist = parseFloat(String(resultProd?.total ?? "0"));
        }

        // Fallback: se ainda zero, tentar producaoTotal do período ou quantidadeVendida
        if (producaoHist <= 0) {
          producaoHist = parseFloat(String(periodo.producaoTotal || '0'));
        }
        if (producaoHist <= 0) {
          producaoHist = parseFloat(String(periodo.quantidadeVendida || '0'));
        }

        custoSetorHistorico.push({
          mes: periodo.mes,
          ano: periodo.ano,
          producaoTotal: producaoHist,
          custoTotal,
          setores: Array.from(gruposMap.entries()).map(([grupoNome, totalGeral]) => ({ grupoNome, totalGeral })),
        });
      }

      // ========================================================
      // 4. PROJEÇÃO POR SETOR (média dos últimos 3 meses + proporção)
      // ========================================================
      // Calcular média de custo por setor nos últimos 3 meses
      const todosSetores = new Set<string>();
      custoSetorHistorico.forEach(h => h.setores.forEach(s => todosSetores.add(s.grupoNome)));

      const mediaSetores: Array<{
        grupoNome: string;
        media3Meses: number;
        valores: number[];
        tendencia: "subindo" | "estavel" | "descendo";
      }> = [];

      for (const grupoNome of Array.from(todosSetores)) {
        const valores = custoSetorHistorico.map(h => {
          const setor = h.setores.find(s => s.grupoNome === grupoNome);
          return setor?.totalGeral ?? 0;
        });
        const valoresNaoZero = valores.filter(v => v > 0);
        const media = valoresNaoZero.length > 0
          ? valoresNaoZero.reduce((a, b) => a + b, 0) / valoresNaoZero.length
          : 0;

        // Tendência simples: comparar primeiro e último valor
        let tendencia: "subindo" | "estavel" | "descendo" = "estavel";
        if (valoresNaoZero.length >= 2) {
          const primeiro = valoresNaoZero[valoresNaoZero.length - 1]; // mais antigo
          const ultimo = valoresNaoZero[0]; // mais recente
          const variacao = ((ultimo - primeiro) / primeiro) * 100;
          if (variacao > 5) tendencia = "subindo";
          else if (variacao < -5) tendencia = "descendo";
        }

        mediaSetores.push({ grupoNome, media3Meses: media, valores, tendencia });
      }

      // Custo total médio dos últimos 3 meses
      const custoTotalMedio3Meses = custoSetorHistorico.length > 0
        ? custoSetorHistorico.reduce((acc, h) => acc + h.custoTotal, 0) / custoSetorHistorico.length
        : 0;

      // Produção média dos últimos 3 meses
      const producaoMedia3Meses = custoSetorHistorico.length > 0
        ? custoSetorHistorico.filter(h => h.producaoTotal > 0).reduce((acc, h) => acc + h.producaoTotal, 0) / Math.max(1, custoSetorHistorico.filter(h => h.producaoTotal > 0).length)
        : 0;

      // ========================================================
      // 5. PROJEÇÃO FINAL: combinar dados parciais + média histórica
      // ========================================================
      // Estratégia MELHORADA:
      // Se há dados parciais importados (despesas de equipamentos e/ou fluxo),
      // projetar esses dados reais para o mês inteiro e substituir a média histórica.
      // Caso contrário, manter a lógica original (combustível real + média 3 meses).

      // Verificar se há combustível separado no histórico
      const combustivelHistorico = mediaSetores.find(s => 
        s.grupoNome.toUpperCase().includes('COMBUST')
      );

      let custoTotalProjetado: number;
      let fonteDados: "media_historica" | "parcial_projetado" | "misto" = "media_historica";

      // Dados parciais de despesas projetados para o mês inteiro
      let despesasProjetadas = 0;
      let fluxoProjetado = 0;

      if (temDadosParciais) {
        // MODO AVANÇADO: usar dados parciais reais projetados
        fonteDados = "parcial_projetado";

        if (despesasParciais.length > 0) {
          const fatorDespesas = diasNoMes / despesasParcialDias;
          despesasProjetadas = despesasParcialTotal * fatorDespesas;
        }

        if (fluxoParcial.length > 0) {
          const fatorFluxo = diasNoMes / fluxoParcialDias;
          fluxoProjetado = fluxoParcialTotal * fatorFluxo;
        }

        // Combinar: despesas projetadas + fluxo projetado + combustível real
        // Se não tem despesas parciais, usar média histórica para essa parcela
        // Se não tem fluxo parcial, usar média histórica para essa parcela
        const parcelaDespesas = despesasParciais.length > 0
          ? despesasProjetadas
          : (custoTotalMedio3Meses * 0.4); // Estimativa: despesas equip = ~40% do custo total

        const parcelaFluxo = fluxoParcial.length > 0
          ? fluxoProjetado
          : (custoTotalMedio3Meses * 0.3); // Estimativa: fluxo = ~30% do custo total

        // Combustível: sempre usar dado real se disponível
        const parcelaCombustivel = combustivelAcumulado > 0
          ? combustivelProjetado
          : (custoTotalMedio3Meses * 0.15); // Estimativa: combustível = ~15% do custo total

        // Salários e impostos: usar média histórica (não vem nos parciais)
        // Verificar se fluxo parcial já inclui salários
        const salarioNoFluxo = fluxoParcialPorConta['Salários Operacionais'] ||
          fluxoParcialPorConta['Salários Não Operacionais'] || 0;
        const parcelaResidual = salarioNoFluxo > 0 ? 0 : (custoTotalMedio3Meses * 0.15);

        if (despesasParciais.length > 0 && fluxoParcial.length > 0) {
          // Ambos disponíveis: usar dados reais projetados + combustível real
          custoTotalProjetado = despesasProjetadas + fluxoProjetado + combustivelProjetado;
          fonteDados = "parcial_projetado";
        } else if (despesasParciais.length > 0) {
          // Só despesas: projetar despesas + combustível real + média para fluxo
          custoTotalProjetado = despesasProjetadas + combustivelProjetado + parcelaFluxo + parcelaResidual;
          fonteDados = "misto";
        } else {
          // Só fluxo: projetar fluxo + combustível real + média para despesas
          custoTotalProjetado = fluxoProjetado + combustivelProjetado + parcelaDespesas + parcelaResidual;
          fonteDados = "misto";
        }
      } else if (combustivelHistorico && combustivelAcumulado > 0) {
        // Cenário original com combustível separado: substituir parcela de combustível
        const outrosMedia = mediaSetores.filter(s => 
          !s.grupoNome.toUpperCase().includes('COMBUST')
        );
        const totalOutrosMedia = outrosMedia.reduce((acc, s) => acc + s.media3Meses, 0);
        custoTotalProjetado = combustivelProjetado + totalOutrosMedia;
      } else {
        // Cenário sem dados parciais e sem combustível separado:
        custoTotalProjetado = custoTotalMedio3Meses;
      }

      // Separar para exibição nos setores projetados
      const outrosSetoresMedia = mediaSetores.filter(s => 
        !s.grupoNome.toUpperCase().includes('COMBUST')
      );
      const totalOutrosSetoresMedia = outrosSetoresMedia.reduce((acc, s) => acc + s.media3Meses, 0);
      
      // Custo por tonelada projetado
      const custoTonProjetado = producaoProjetada > 0 ? custoTotalProjetado / producaoProjetada : 0;
      const custoTonMedio3Meses = producaoMedia3Meses > 0 ? custoTotalMedio3Meses / producaoMedia3Meses : 0;

      // Variação em relação à média
      const variacaoCusto = custoTotalMedio3Meses > 0
        ? ((custoTotalProjetado - custoTotalMedio3Meses) / custoTotalMedio3Meses) * 100
        : 0;

      return {
        // Período
        periodo: { mes: input.mes, ano: input.ano, dataInicio, dataFim, corte },
        diasNoMes,
        diasTranscorridos,
        fatorProjecao,

        // Produção
        producaoAcumulada,
        producaoProjetada,
        producaoMedia3Meses,

        // Combustível (dado real parcial)
        combustivelAcumulado,
        combustivelProjetado,

        // Dados parciais importados
        dadosParciais: {
          temDadosParciais,
          fonteDados,
          despesas: despesasParciais.length > 0 ? {
            totalAcumulado: despesasParcialTotal,
            totalProjetado: despesasProjetadas,
            diasAbrangidos: despesasParcialDias,
            porClassificacao: despesasParcialPorClassificacao,
            dataInicio: despesasParciais[0]?.dataInicio || '',
            dataFim: despesasParciais[0]?.dataFim || '',
          } : null,
          fluxo: fluxoParcial.length > 0 ? {
            totalAcumulado: fluxoParcialTotal,
            totalProjetado: fluxoProjetado,
            diasAbrangidos: fluxoParcialDias,
            porConta: fluxoParcialPorConta,
            dataInicio: fluxoParcial[0]?.dataInicio || '',
            dataFim: fluxoParcial[0]?.dataFim || '',
          } : null,
        },

        // Projeção total
        custoTotalProjetado,
        custoTotalMedio3Meses,
        custoTonProjetado,
        custoTonMedio3Meses,
        variacaoCusto,

        // Detalhamento por setor
        setoresProjetados: mediaSetores.map(s => ({
          ...s,
          // Para combustível, usar projeção real; para outros, usar média
          projetado: s.grupoNome.toUpperCase().includes('COMBUST')
            ? combustivelProjetado
            : s.media3Meses,
        })).sort((a, b) => b.projetado - a.projetado),

        // Histórico para gráficos
        historico: custoSetorHistorico.map(h => ({
          mes: h.mes,
          ano: h.ano,
          custoTotal: h.custoTotal,
          producaoTotal: h.producaoTotal,
          custoTon: h.producaoTotal > 0 ? h.custoTotal / h.producaoTotal : 0,
        })),

        // Alertas
        alertas: (() => {
          const alertas: Array<{ tipo: "alerta" | "info" | "sucesso"; mensagem: string }> = [];
          if (variacaoCusto > 10) {
            alertas.push({ tipo: "alerta", mensagem: `Custo projetado ${variacaoCusto.toFixed(1)}% acima da média dos últimos 3 meses` });
          } else if (variacaoCusto < -10) {
            alertas.push({ tipo: "sucesso", mensagem: `Custo projetado ${Math.abs(variacaoCusto).toFixed(1)}% abaixo da média dos últimos 3 meses` });
          }
          if (diasTranscorridos < 10) {
            alertas.push({ tipo: "info", mensagem: `Apenas ${diasTranscorridos} dias transcorridos — projeção pode ter alta variabilidade` });
          }
          if (custoSetorHistorico.length < 3) {
            alertas.push({ tipo: "info", mensagem: `Apenas ${custoSetorHistorico.length} mês(es) de histórico disponível para média` });
          }
          // Alertas por setor com tendência de alta
          mediaSetores.filter(s => s.tendencia === "subindo").forEach(s => {
            alertas.push({ tipo: "alerta", mensagem: `${s.grupoNome}: tendência de alta nos últimos 3 meses` });
          });
          return alertas;
        })(),
      };
    }),

  // ========================================================
  // ANÁLISE DE REQUISITOS PARA ATINGIR A META
  // Calcula produção necessária, vendas necessárias e valor máximo por conta
  // ========================================================
  analiseMeta: protectedProcedure
    .use(requirePermission("custos", "view"))
    .input(z.object({
      mes: z.number().min(1).max(12),
      ano: z.number().min(2020),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // 1. Buscar meta atual
      const [meta] = await db.select().from(metaCustoTonelada).orderBy(desc(metaCustoTonelada.updatedAt)).limit(1);
      if (!meta) return null;
      const metaValor = parseFloat(String(meta.valor));
      if (metaValor <= 0) return null;

      // 2. Buscar últimos 3 meses de histórico
      const meses3: { mes: number; ano: number }[] = [];
      let m = input.mes, a = input.ano;
      for (let i = 0; i < 3; i++) {
        const prev = mesAnterior(m, a);
        m = prev.mes;
        a = prev.ano;
        meses3.push({ mes: m, ano: a });
      }

      const periodosAll = await db.select().from(periodoCusto);
      const periodosHistoricos = meses3
        .map(p => periodosAll.find(ph => ph.mes === p.mes && ph.ano === p.ano))
        .filter(Boolean) as typeof periodosAll;

      if (periodosHistoricos.length === 0) return null;

      // 3. Buscar contas de custo ativas
      const contasAtivas = await db.select().from(contaCusto);
      const contasMap = new Map(contasAtivas.map(c => [c.id, c]));

      // 4. Buscar lançamentos dos períodos históricos
      const periodosIds = periodosHistoricos.map(p => p.id);
      const lancamentos = await db
        .select()
        .from(lancamentoCusto)
        .where(sql`${lancamentoCusto.periodoCustoId} IN (${sql.raw(periodosIds.join(','))})`);

      // 5. Calcular média por conta nos últimos 3 meses
      type ContaHistorico = {
        contaCustoId: number;
        nome: string;
        divisor: string;
        classificacao: string;
        valoresPorPeriodo: number[];
        media: number;
        participacao: number; // % do custo total
      };

      const contaValores = new Map<number, number[]>();
      for (const lc of lancamentos) {
        if (!contaValores.has(lc.contaCustoId)) contaValores.set(lc.contaCustoId, []);
        contaValores.get(lc.contaCustoId)!.push(parseFloat(String(lc.valor || '0')));
      }

      // Agrupar por período para calcular total por período
      const totalPorPeriodo = new Map<number, number>();
      for (const lc of lancamentos) {
        const atual = totalPorPeriodo.get(lc.periodoCustoId) || 0;
        totalPorPeriodo.set(lc.periodoCustoId, atual + parseFloat(String(lc.valor || '0')));
      }

      // Custo total médio dos últimos 3 meses
      const custosTotais = Array.from(totalPorPeriodo.values());
      const custoTotalMedio = custosTotais.length > 0
        ? custosTotais.reduce((a, b) => a + b, 0) / custosTotais.length
        : 0;

      // Produção média (quantidadeVendida como proxy de produção quando producaoTotal é NULL)
      const producoesHistoricas = periodosHistoricos
        .map(p => {
          const prod = parseFloat(String(p.producaoTotal || '0'));
          const vendas = parseFloat(String(p.quantidadeVendida || '0'));
          return prod > 0 ? prod : vendas; // usar vendas como proxy se produção não disponível
        })
        .filter(v => v > 0);
      const producaoMedia = producoesHistoricas.length > 0
        ? producoesHistoricas.reduce((a, b) => a + b, 0) / producoesHistoricas.length
        : 0;

      // Vendas médias (toneladas)
      const vendasHistoricas = periodosHistoricos
        .map(p => parseFloat(String(p.quantidadeVendida || '0')))
        .filter(v => v > 0);
      const vendasMedia = vendasHistoricas.length > 0
        ? vendasHistoricas.reduce((a, b) => a + b, 0) / vendasHistoricas.length
        : 0;

      // Relação vendas/produção (para projetar vendas necessárias)
      const relacaoVendasProducao = producaoMedia > 0 ? vendasMedia / producaoMedia : 1;

      // 6. Calcular participação de cada conta no custo total
      const contasAnalise: ContaHistorico[] = [];
      for (const [contaId, valores] of Array.from(contaValores.entries())) {
        const conta = contasMap.get(contaId);
        if (!conta) continue;
        // Média dos valores lançados para esta conta (soma por período / nº períodos)
        // Agrupar valores por período
        const lancamentosPorPeriodo = new Map<number, number>();
        for (const lc of lancamentos.filter(l => l.contaCustoId === contaId)) {
          const atual = lancamentosPorPeriodo.get(lc.periodoCustoId) || 0;
          lancamentosPorPeriodo.set(lc.periodoCustoId, atual + parseFloat(String(lc.valor || '0')));
        }
        const valoresPeriodo = Array.from(lancamentosPorPeriodo.values());
        const media = valoresPeriodo.length > 0
          ? valoresPeriodo.reduce((a, b) => a + b, 0) / valoresPeriodo.length
          : 0;
        const participacao = custoTotalMedio > 0 ? (media / custoTotalMedio) * 100 : 0;

        contasAnalise.push({
          contaCustoId: contaId,
          nome: conta.nome,
          divisor: conta.divisor || 'producao',
          classificacao: conta.classificacao || 'custo_variavel',
          valoresPorPeriodo: valoresPeriodo,
          media,
          participacao,
        });
      }

      // Ordenar por média decrescente
      contasAnalise.sort((a, b) => b.media - a.media);

      // ========================================================
      // CENÁRIO 1: Produção necessária para atingir a meta
      // Meta = CustoTotal / Produção → Produção = CustoTotal / Meta
      // ========================================================
      const producaoNecessaria = custoTotalMedio / metaValor;
      const aumentoProducao = producaoMedia > 0
        ? ((producaoNecessaria - producaoMedia) / producaoMedia) * 100
        : 0;

      // ========================================================
      // CENÁRIO 2: Custo máximo total mantendo produção atual
      // Meta = CustoTotal / Produção → CustoTotal = Meta × Produção
      // ========================================================
      const custoTotalMaximo = metaValor * producaoMedia;
      const reducaoCustoNecessaria = custoTotalMedio > 0
        ? ((custoTotalMedio - custoTotalMaximo) / custoTotalMedio) * 100
        : 0;

      // Distribuir o custo máximo proporcionalmente por conta
      const contasComMeta = contasAnalise.map(conta => {
        const valorMaximo = custoTotalMaximo * (conta.participacao / 100);
        const reducaoNecessaria = conta.media > 0
          ? ((conta.media - valorMaximo) / conta.media) * 100
          : 0;
        return {
          ...conta,
          valorMaximo: Math.round(valorMaximo * 100) / 100,
          reducaoNecessaria: Math.round(reducaoNecessaria * 100) / 100,
        };
      });

      // ========================================================
      // CENÁRIO 3: Vendas necessárias
      // Baseado na relação histórica vendas/produção
      // ========================================================
      const vendasNecessarias = producaoNecessaria * relacaoVendasProducao;

      // ========================================================
      // CENÁRIO COMBINADO: Sugestão equilibrada
      // Dividir o gap em 50% aumento de produção + 50% redução de custo
      // ========================================================
      const custoTonAtual = producaoMedia > 0 ? custoTotalMedio / producaoMedia : 0;
      const gap = custoTonAtual - metaValor;
      const gapPercentual = custoTonAtual > 0 ? (gap / custoTonAtual) * 100 : 0;

      // Cenário equilibrado: aumentar produção em X% E reduzir custo em Y%
      // Para dividir igualmente: nova_producao * meta = custo_reduzido
      // Se gap = 20%, podemos fazer: +10% produção e -10% custo (aproximação)
      const fatorEquilibrio = Math.sqrt(custoTonAtual / metaValor); // raiz quadrada para distribuir
      const producaoEquilibrada = producaoMedia * fatorEquilibrio;
      const custoEquilibrado = custoTotalMedio / fatorEquilibrio;
      const aumentoProducaoEquilibrado = producaoMedia > 0
        ? ((producaoEquilibrada - producaoMedia) / producaoMedia) * 100
        : 0;
      const reducaoCustoEquilibrada = custoTotalMedio > 0
        ? ((custoTotalMedio - custoEquilibrado) / custoTotalMedio) * 100
        : 0;

      return {
        meta: metaValor,
        situacaoAtual: {
          custoTotalMedio: Math.round(custoTotalMedio * 100) / 100,
          producaoMedia: Math.round(producaoMedia * 100) / 100,
          vendasMedia: Math.round(vendasMedia * 100) / 100,
          custoTonAtual: Math.round(custoTonAtual * 100) / 100,
          desvioPercentual: Math.round(gapPercentual * 100) / 100,
          periodosAnalisados: periodosHistoricos.length,
        },
        cenario1_producao: {
          titulo: "Aumentar Produção (manter custos)",
          producaoNecessaria: Math.round(producaoNecessaria * 100) / 100,
          aumentoPercentual: Math.round(aumentoProducao * 100) / 100,
          vendasNecessarias: Math.round(vendasNecessarias * 100) / 100,
        },
        cenario2_custo: {
          titulo: "Reduzir Custos (manter produção)",
          custoTotalMaximo: Math.round(custoTotalMaximo * 100) / 100,
          reducaoPercentual: Math.round(reducaoCustoNecessaria * 100) / 100,
          contasComMeta: contasComMeta.map(c => ({
            nome: c.nome,
            divisor: c.divisor,
            classificacao: c.classificacao,
            mediaAtual: Math.round(c.media * 100) / 100,
            valorMaximo: c.valorMaximo,
            reducaoNecessaria: c.reducaoNecessaria,
            participacao: Math.round(c.participacao * 100) / 100,
          })),
        },
        cenario3_equilibrado: {
          titulo: "Cenário Equilibrado (produção + custos)",
          producaoSugerida: Math.round(producaoEquilibrada * 100) / 100,
          aumentoProducao: Math.round(aumentoProducaoEquilibrado * 100) / 100,
          custoTotalSugerido: Math.round(custoEquilibrado * 100) / 100,
          reducaoCusto: Math.round(reducaoCustoEquilibrada * 100) / 100,
          vendasSugeridas: Math.round(producaoEquilibrada * relacaoVendasProducao * 100) / 100,
        },
      };
    }),
});
