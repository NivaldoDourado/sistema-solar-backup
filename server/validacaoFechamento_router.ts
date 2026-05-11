/**
 * Router de Validação de Fechamento de Período
 * 
 * Verifica se todos os lançamentos necessários foram feitos antes de fechar o mês.
 * Checklist: despesas de equipamentos, fluxo realizado, salários, impostos, vendas.
 */

import { z } from "zod";
import { eq, and, like, sql } from "drizzle-orm";
import { router, protectedProcedure } from "./_core/trpc";
import { getDb } from "./db";
import {
  periodoCusto,
  itemDespesaImportado,
  lancamentoFluxo,
  lancamentoSalario,
  lancamentoCusto,
  resumoVendasProduto,
} from "../drizzle/schema";

// Helpers
function getMesDates(mes: number, ano: number) {
  const dataInicio = `${ano}-${String(mes).padStart(2, "0")}-01`;
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const dataFim = `${ano}-${String(mes).padStart(2, "0")}-${String(ultimoDia).padStart(2, "0")}`;
  return { dataInicio, dataFim };
}

export interface ChecklistItem {
  id: string;
  nome: string;
  descricao: string;
  status: "completo" | "pendente" | "parcial";
  detalhes: string;
  valor?: number;
  quantidade?: number;
}

export const validacaoFechamentoRouter = router({
  /**
   * Verifica o status de todos os lançamentos para um período.
   * Retorna um checklist com status de cada item.
   */
  verificar: protectedProcedure
    .input(z.object({
      periodoCustoId: z.number(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { items: [], periodoFechado: false };

      // Buscar período
      const [periodo] = await db
        .select()
        .from(periodoCusto)
        .where(eq(periodoCusto.id, input.periodoCustoId));

      if (!periodo) return { items: [], periodoFechado: false };

      const { dataInicio, dataFim } = getMesDates(periodo.mes, periodo.ano);
      const items: ChecklistItem[] = [];

      // 1. Despesas de Equipamentos (item_despesa_importado)
      const [despesasCount] = await db
        .select({ count: sql<number>`COUNT(*)`, total: sql<string>`COALESCE(SUM(custo), 0)` })
        .from(itemDespesaImportado)
        .where(eq(itemDespesaImportado.periodoCustoId, input.periodoCustoId));

      const qtdDespesas = Number(despesasCount?.count ?? 0);
      const totalDespesas = parseFloat(String(despesasCount?.total ?? '0'));
      items.push({
        id: "despesas_equip",
        nome: "Despesas de Equipamentos",
        descricao: "Importação da planilha de despesas dos equipamentos (DataGold)",
        status: qtdDespesas > 0 ? "completo" : "pendente",
        detalhes: qtdDespesas > 0
          ? `${qtdDespesas} itens importados`
          : "Nenhuma despesa importada",
        valor: totalDespesas,
        quantidade: qtdDespesas,
      });

      // 2. Fluxo Realizado (lancamento_fluxo)
      const [fluxoCount] = await db
        .select({ count: sql<number>`COUNT(*)`, total: sql<string>`COALESCE(SUM(valor), 0)` })
        .from(lancamentoFluxo)
        .where(eq(lancamentoFluxo.periodoCustoId, input.periodoCustoId));

      const qtdFluxo = Number(fluxoCount?.count ?? 0);
      const totalFluxo = parseFloat(String(fluxoCount?.total ?? '0'));
      items.push({
        id: "fluxo_realizado",
        nome: "Fluxo Realizado",
        descricao: "Importação da planilha de fluxo de caixa realizado (DataGold)",
        status: qtdFluxo > 0 ? "completo" : "pendente",
        detalhes: qtdFluxo > 0
          ? `${qtdFluxo} lançamentos importados`
          : "Nenhum lançamento de fluxo importado",
        valor: totalFluxo,
        quantidade: qtdFluxo,
      });

      // 3. Salários Operacionais (lancamento_salario)
      const [salariosCount] = await db
        .select({ count: sql<number>`COUNT(*)`, total: sql<string>`COALESCE(SUM(valor), 0)` })
        .from(lancamentoSalario)
        .where(eq(lancamentoSalario.periodoCustoId, input.periodoCustoId));

      const qtdSalarios = Number(salariosCount?.count ?? 0);
      const totalSalarios = parseFloat(String(salariosCount?.total ?? '0'));
      items.push({
        id: "salarios",
        nome: "Salários Operacionais",
        descricao: "Lançamento manual de salários (Sal.Oper., Sal.Adm., Sal.Diretoria)",
        status: qtdSalarios > 0 ? "completo" : "pendente",
        detalhes: qtdSalarios > 0
          ? `${qtdSalarios} lançamentos`
          : "Nenhum salário lançado",
        valor: totalSalarios,
        quantidade: qtdSalarios,
      });

      // 4. Impostos e Tributos (lancamento_custo com conta 2 e obs [Impostos Manual])
      const [impostosCount] = await db
        .select({ count: sql<number>`COUNT(*)`, total: sql<string>`COALESCE(SUM(valor), 0)` })
        .from(lancamentoCusto)
        .where(and(
          eq(lancamentoCusto.periodoCustoId, input.periodoCustoId),
          eq(lancamentoCusto.contaCustoId, 2),
        ));

      const qtdImpostos = Number(impostosCount?.count ?? 0);
      const totalImpostos = parseFloat(String(impostosCount?.total ?? '0'));
      items.push({
        id: "impostos",
        nome: "Impostos e Tributos",
        descricao: "Lançamento de impostos (manuais + importados do fluxo)",
        status: qtdImpostos > 0 ? "completo" : "pendente",
        detalhes: qtdImpostos > 0
          ? `${qtdImpostos} lançamentos`
          : "Nenhum imposto lançado",
        valor: totalImpostos,
        quantidade: qtdImpostos,
      });

      // 5. Vendas (resumo_vendas_produto para o período)
      const vendasRows = await db
        .select({
          quantidade: resumoVendasProduto.quantidade,
          valor: resumoVendasProduto.valor,
        })
        .from(resumoVendasProduto)
        .where(and(
          sql`${resumoVendasProduto.periodoInicio} >= ${dataInicio}`,
          sql`${resumoVendasProduto.periodoFim} <= ${dataFim}`,
        ));

      const qtdVendas = vendasRows.length;
      const totalVendasQtd = vendasRows.reduce((s, r) => s + parseFloat(String(r.quantidade ?? '0')), 0);
      const totalVendasValor = vendasRows.reduce((s, r) => s + parseFloat(String(r.valor ?? '0')), 0);
      items.push({
        id: "vendas",
        nome: "Vendas (Resumo ERP)",
        descricao: "Importação do resumo de vendas por produto do ERP",
        status: qtdVendas > 0 ? "completo" : "pendente",
        detalhes: qtdVendas > 0
          ? `${qtdVendas} produtos, ${totalVendasQtd.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} t`
          : "Nenhuma venda importada",
        valor: totalVendasValor,
        quantidade: qtdVendas,
      });

      // 6. Produção do período (campo producaoTotal no periodo_custo)
      const producaoTotal = parseFloat(periodo.producaoTotal || '0');
      items.push({
        id: "producao",
        nome: "Produção do Período",
        descricao: "Produção total informada no cadastro do período de custo",
        status: producaoTotal > 0 ? "completo" : "pendente",
        detalhes: producaoTotal > 0
          ? `${producaoTotal.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} t`
          : "Produção não informada",
        valor: producaoTotal,
        quantidade: producaoTotal > 0 ? 1 : 0,
      });

      return {
        items,
        periodoFechado: periodo.fechado === "sim",
        periodoMes: periodo.mes,
        periodoAno: periodo.ano,
      };
    }),
});
