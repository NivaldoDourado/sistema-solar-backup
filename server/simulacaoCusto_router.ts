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
  contaCusto,
} from "../drizzle/schema";

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

        const custoTotal = Array.from(gruposMap.values()).reduce((a, b) => a + b, 0);
        custoSetorHistorico.push({
          mes: periodo.mes,
          ano: periodo.ano,
          producaoTotal: parseFloat(String(periodo.producaoTotal || '0')),
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
      // Para combustível: usar projeção direta (dados reais do período)
      // Para outros setores: usar média dos últimos 3 meses (pois não temos dados parciais)
      // Custo total projetado = combustível projetado + (média outros setores)
      
      // Separar combustível da média
      const combustivelHistorico = mediaSetores.find(s => 
        s.grupoNome.toUpperCase().includes('COMBUST')
      );
      const outrosSetoresMedia = mediaSetores.filter(s => 
        !s.grupoNome.toUpperCase().includes('COMBUST')
      );
      const totalOutrosSetoresMedia = outrosSetoresMedia.reduce((acc, s) => acc + s.media3Meses, 0);

      // Custo total projetado: combustível real projetado + média dos outros setores
      const custoTotalProjetado = combustivelProjetado + totalOutrosSetoresMedia;
      
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
});
