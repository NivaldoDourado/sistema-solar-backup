import { z } from "zod";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";
import { router, protectedProcedure, requirePermission } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import { clientes, vendas, vendaItens, produtos, unidades, resumoVendasProduto } from "../drizzle/schema";

/** Converte Date para string YYYY-MM-DD */
function toDateStr(d: Date | string): string {
  if (d instanceof Date) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  return String(d).split("T")[0];
}

export const vendasRouter = router({
  // ============================================================================
  // CLIENTES
  // ============================================================================

  clientesList: protectedProcedure
    .use(requirePermission("clientes", "view"))
    .query(async () => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      return await db.select().from(clientes).orderBy(clientes.nome);
    }),

  clienteCreate: protectedProcedure
    .use(requirePermission("clientes", "create"))
    .input(
      z.object({
        nome: z.string().min(1, "Nome é obrigatório"),
        cpfCnpj: z.string().optional(),
        inscricaoEstadual: z.string().optional(),
        telefone: z.string().optional(),
        email: z.string().optional(),
        endereco: z.string().optional(),
        cidade: z.string().optional(),
        estado: z.string().optional(),
        cep: z.string().optional(),
        observacoes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const result = await db.insert(clientes).values({
        nome: input.nome,
        cpfCnpj: input.cpfCnpj || null,
        inscricaoEstadual: input.inscricaoEstadual || null,
        telefone: input.telefone || null,
        email: input.email || null,
        endereco: input.endereco || null,
        cidade: input.cidade || null,
        estado: input.estado || null,
        cep: input.cep || null,
        observacoes: input.observacoes || null,
      });
      return { id: result[0].insertId };
    }),

  clienteUpdate: protectedProcedure
    .use(requirePermission("clientes", "edit"))
    .input(
      z.object({
        id: z.number(),
        nome: z.string().min(1, "Nome é obrigatório"),
        cpfCnpj: z.string().optional(),
        inscricaoEstadual: z.string().optional(),
        telefone: z.string().optional(),
        email: z.string().optional(),
        endereco: z.string().optional(),
        cidade: z.string().optional(),
        estado: z.string().optional(),
        cep: z.string().optional(),
        observacoes: z.string().optional(),
        ativo: z.enum(["sim", "nao"]).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const { id, ...data } = input;
      await db.update(clientes).set({
        nome: data.nome,
        cpfCnpj: data.cpfCnpj || null,
        inscricaoEstadual: data.inscricaoEstadual || null,
        telefone: data.telefone || null,
        email: data.email || null,
        endereco: data.endereco || null,
        cidade: data.cidade || null,
        estado: data.estado || null,
        cep: data.cep || null,
        observacoes: data.observacoes || null,
        ativo: data.ativo || "sim",
      }).where(eq(clientes.id, id));
      return { success: true };
    }),

  clienteDelete: protectedProcedure
    .use(requirePermission("clientes", "delete"))
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      // Verificar se há vendas vinculadas
      const vendasVinculadas = await db.select({ count: sql<number>`count(*)` })
        .from(vendas).where(eq(vendas.clienteId, input.id));
      if (vendasVinculadas[0]?.count > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Não é possível excluir este cliente pois existem vendas vinculadas a ele.",
        });
      }
      
      await db.delete(clientes).where(eq(clientes.id, input.id));
      return { success: true };
    }),

  // ============================================================================
  // VENDAS (NOTAS FISCAIS)
  // ============================================================================

  vendasList: protectedProcedure
    .use(requirePermission("vendas", "view"))
    .input(
      z.object({
        dataInicio: z.date().optional(),
        dataFim: z.date().optional(),
        clienteId: z.number().optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const conditions: any[] = [];
      if (input?.dataInicio) {
        conditions.push(sql`${vendas.data} >= ${toDateStr(input.dataInicio)}`);
      }
      if (input?.dataFim) {
        conditions.push(sql`${vendas.data} <= ${toDateStr(input.dataFim)}`);
      }
      if (input?.clienteId) {
        conditions.push(eq(vendas.clienteId, input.clienteId));
      }

      const vendasList = conditions.length > 0
        ? await db.select().from(vendas).where(and(...conditions)).orderBy(desc(vendas.data), desc(vendas.id))
        : await db.select().from(vendas).orderBy(desc(vendas.data), desc(vendas.id));

      // Buscar clientes e itens para cada venda
      const clientesList = await db.select().from(clientes);
      const clientesMap = new Map(clientesList.map(c => [c.id, c]));

      const allItens = await db.select().from(vendaItens);
      const produtosList = await db.select().from(produtos);
      const unidadesList = await db.select().from(unidades);
      const produtosMap = new Map(produtosList.map(p => [p.id, p]));
      const unidadesMap = new Map(unidadesList.map(u => [u.id, u]));

      return vendasList.map(v => ({
        ...v,
        cliente: clientesMap.get(v.clienteId) || null,
        itens: allItens
          .filter(i => i.vendaId === v.id)
          .map(i => ({
            ...i,
            produto: produtosMap.get(i.produtoId) || null,
            unidade: produtosMap.get(i.produtoId)?.unidadeId
              ? unidadesMap.get(produtosMap.get(i.produtoId)!.unidadeId!) || null
              : null,
          })),
      }));
    }),

  vendaCreate: protectedProcedure
    .use(requirePermission("vendas", "create"))
    .input(
      z.object({
        tipo: z.enum(["venda", "amortizacao", "doacao"]),
        numeroNF: z.string().optional(),
        serieNF: z.string().optional(),
        data: z.date(),
        clienteId: z.number(),
        observacoes: z.string().optional(),
        transportadoraNome: z.string().optional(),
        motoristaNome: z.string().optional(),
        placaVeiculo: z.string().optional(),
        itens: z.array(
          z.object({
            produtoId: z.number(),
            quantidade: z.number().min(0.01, "Quantidade deve ser maior que zero"),
            valorUnitario: z.number().min(0, "Valor unitário deve ser positivo"),
          })
        ).min(1, "O registro deve ter pelo menos um item"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Validar NF obrigatória para tipo "venda"
      if (input.tipo === "venda" && (!input.numeroNF || input.numeroNF.trim() === "")) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Número da Nota Fiscal é obrigatório para vendas." });
      }

      // Calcular totais
      let valorTotal = 0;
      let pesoTotal = 0;
      const itensCalculados = input.itens.map(item => {
        const itemTotal = item.quantidade * item.valorUnitario;
        valorTotal += itemTotal;
        pesoTotal += item.quantidade;
        return { ...item, valorTotal: itemTotal };
      });

      // Inserir venda
      const vendaResult = await db.insert(vendas).values({
        tipo: input.tipo,
        numeroNF: input.numeroNF?.trim() || null,
        serieNF: input.serieNF || null,
        data: new Date(toDateStr(input.data) + "T12:00:00"),
        clienteId: input.clienteId,
        valorTotal: valorTotal.toFixed(2),
        pesoTotal: pesoTotal.toFixed(2),
        observacoes: input.observacoes || null,
        transportadoraNome: input.transportadoraNome || null,
        motoristaNome: input.motoristaNome || null,
        placaVeiculo: input.placaVeiculo || null,
        userId: ctx.user.id,
      });

      const vendaId = vendaResult[0].insertId;

      // Inserir itens
      for (const item of itensCalculados) {
        await db.insert(vendaItens).values({
          vendaId,
          produtoId: item.produtoId,
          quantidade: item.quantidade.toFixed(2),
          valorUnitario: item.valorUnitario.toFixed(2),
          valorTotal: item.valorTotal.toFixed(2),
        });
      }

      return { id: vendaId };
    }),

  vendaUpdate: protectedProcedure
    .use(requirePermission("vendas", "edit"))
    .input(
      z.object({
        id: z.number(),
        tipo: z.enum(["venda", "amortizacao", "doacao"]),
        numeroNF: z.string().optional(),
        serieNF: z.string().optional(),
        data: z.date(),
        clienteId: z.number(),
        observacoes: z.string().optional(),
        transportadoraNome: z.string().optional(),
        motoristaNome: z.string().optional(),
        placaVeiculo: z.string().optional(),
        itens: z.array(
          z.object({
            produtoId: z.number(),
            quantidade: z.number().min(0.01, "Quantidade deve ser maior que zero"),
            valorUnitario: z.number().min(0, "Valor unitário deve ser positivo"),
          })
        ).min(1, "O registro deve ter pelo menos um item"),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Validar NF obrigatória para tipo "venda"
      if (input.tipo === "venda" && (!input.numeroNF || input.numeroNF.trim() === "")) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Número da Nota Fiscal é obrigatório para vendas." });
      }

      // Calcular totais
      let valorTotal = 0;
      let pesoTotal = 0;
      const itensCalculados = input.itens.map(item => {
        const itemTotal = item.quantidade * item.valorUnitario;
        valorTotal += itemTotal;
        pesoTotal += item.quantidade;
        return { ...item, valorTotal: itemTotal };
      });

      // Atualizar venda
      await db.update(vendas).set({
        tipo: input.tipo,
        numeroNF: input.numeroNF?.trim() || null,
        serieNF: input.serieNF || null,
        data: new Date(toDateStr(input.data) + "T12:00:00"),
        clienteId: input.clienteId,
        valorTotal: valorTotal.toFixed(2),
        pesoTotal: pesoTotal.toFixed(2),
        observacoes: input.observacoes || null,
        transportadoraNome: input.transportadoraNome || null,
        motoristaNome: input.motoristaNome || null,
        placaVeiculo: input.placaVeiculo || null,
      }).where(eq(vendas.id, input.id));

      // Remover itens antigos e inserir novos
      await db.delete(vendaItens).where(eq(vendaItens.vendaId, input.id));

      for (const item of itensCalculados) {
        await db.insert(vendaItens).values({
          vendaId: input.id,
          produtoId: item.produtoId,
          quantidade: item.quantidade.toFixed(2),
          valorUnitario: item.valorUnitario.toFixed(2),
          valorTotal: item.valorTotal.toFixed(2),
        });
      }

      return { success: true };
    }),

  vendaDelete: protectedProcedure
    .use(requirePermission("vendas", "delete"))
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Remover itens primeiro
      await db.delete(vendaItens).where(eq(vendaItens.vendaId, input.id));
      // Remover venda
      await db.delete(vendas).where(eq(vendas.id, input.id));

      return { success: true };
    }),

  // Resumo de vendas por período
  vendasResumo: protectedProcedure
    .use(requirePermission("vendas", "view"))
    .input(
      z.object({
        dataInicio: z.union([z.date(), z.string()]),
        dataFim: z.union([z.date(), z.string()]),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const result = await db.select({
        totalVendas: sql<number>`count(*)`,
        valorTotal: sql<string>`COALESCE(SUM(${vendas.valorTotal}), 0)`,
        pesoTotal: sql<string>`COALESCE(SUM(${vendas.pesoTotal}), 0)`,
      })
        .from(vendas)
        .where(
          and(
            sql`${vendas.data} >= ${toDateStr(input.dataInicio)}`,
            sql`${vendas.data} <= ${toDateStr(input.dataFim)}`
          )
        );

      return {
        totalVendas: Number(result[0]?.totalVendas || 0),
        valorTotal: parseFloat(String(result[0]?.valorTotal || "0")),
        pesoTotal: parseFloat(String(result[0]?.pesoTotal || "0")),
      };
    }),

  // Resumo de vendas por tipo (para cards do Dashboard)
  vendasResumoPorTipo: protectedProcedure
    .use(requirePermission("vendas", "view"))
    .input(
      z.object({
        dataInicio: z.union([z.date(), z.string()]),
        dataFim: z.union([z.date(), z.string()]),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const result = await db.select({
        tipo: vendas.tipo,
        quantidade: sql<number>`count(*)`,
        valorTotal: sql<string>`COALESCE(SUM(${vendas.valorTotal}), 0)`,
        pesoTotal: sql<string>`COALESCE(SUM(${vendas.pesoTotal}), 0)`,
      })
        .from(vendas)
        .where(
          and(
            sql`${vendas.data} >= ${toDateStr(input.dataInicio)}`,
            sql`${vendas.data} <= ${toDateStr(input.dataFim)}`
          )
        )
        .groupBy(vendas.tipo);

      const resumo = {
        venda: { quantidade: 0, valorTotal: 0, pesoTotal: 0 },
        amortizacao: { quantidade: 0, valorTotal: 0, pesoTotal: 0 },
        doacao: { quantidade: 0, valorTotal: 0, pesoTotal: 0 },
      };

      for (const row of result) {
        const tipo = row.tipo as keyof typeof resumo;
        if (resumo[tipo]) {
          resumo[tipo].quantidade = Number(row.quantidade || 0);
          resumo[tipo].valorTotal = parseFloat(String(row.valorTotal || "0"));
          resumo[tipo].pesoTotal = parseFloat(String(row.pesoTotal || "0"));
        }
      }

      return resumo;
    }),

  // ============================================================================
  // RESUMO DE VENDAS IMPORTADO DO PDF
  // ============================================================================

  resumoVendasPeriodos: protectedProcedure
    .use(requirePermission("vendas", "view"))
    .query(async () => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const rows = await db
        .selectDistinct({
          periodoInicio: resumoVendasProduto.periodoInicio,
          periodoFim: resumoVendasProduto.periodoFim,
          setor: resumoVendasProduto.setor,
        })
        .from(resumoVendasProduto)
        .orderBy(desc(resumoVendasProduto.periodoInicio));
      return rows;
    }),

  resumoVendasPorPeriodo: protectedProcedure
    .use(requirePermission("vendas", "view"))
    .input(
      z.object({
        periodoInicio: z.string(),
        periodoFim: z.string(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const rows = await db
        .select()
        .from(resumoVendasProduto)
        .where(
          and(
            sql`DATE(${resumoVendasProduto.periodoInicio}) = ${input.periodoInicio}`,
            sql`DATE(${resumoVendasProduto.periodoFim}) = ${input.periodoFim}`
          )
        )
        .orderBy(desc(resumoVendasProduto.valor));
      const totalValor = rows.reduce((s, r) => s + parseFloat(String(r.valor ?? "0")), 0);
      const totalQtd   = rows.reduce((s, r) => s + parseFloat(String(r.quantidade ?? "0")), 0);
      const vlMedioGeral = totalQtd > 0 ? totalValor / totalQtd : 0;
      return { rows, totalValor, totalQtd, vlMedioGeral };
    }),

  resumoVendasDeletar: protectedProcedure
    .use(requirePermission("vendas", "delete"))
    .input(
      z.object({
        periodoInicio: z.string(),
        periodoFim: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      await db.delete(resumoVendasProduto).where(
        and(
          sql`DATE(${resumoVendasProduto.periodoInicio}) = ${input.periodoInicio}`,
          sql`DATE(${resumoVendasProduto.periodoFim}) = ${input.periodoFim}`
        )
      );
      return { success: true };
    }),

  // Resumo de vendas por produto (granulometria) — usado pelo módulo de Custos
  vendasResumoPorProduto: protectedProcedure
    .use(requirePermission("vendas", "view"))
    .input(
      z.object({
        dataInicio: z.union([z.date(), z.string()]),
        dataFim: z.union([z.date(), z.string()]),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const result = await db
        .select({
          produtoId: vendaItens.produtoId,
          produtoNome: produtos.nome,
          quantidadeTotal: sql<string>`COALESCE(SUM(${vendaItens.quantidade}), 0)`,
          valorTotal: sql<string>`COALESCE(SUM(${vendaItens.valorTotal}), 0)`,
        })
        .from(vendaItens)
        .innerJoin(vendas, eq(vendaItens.vendaId, vendas.id))
        .innerJoin(produtos, eq(vendaItens.produtoId, produtos.id))
        .where(
          and(
            eq(vendas.tipo, "venda"),
            sql`${vendas.data} >= ${toDateStr(input.dataInicio)}`,
            sql`${vendas.data} <= ${toDateStr(input.dataFim)}`
          )
        )
        .groupBy(vendaItens.produtoId, produtos.nome)
        .orderBy(produtos.nome);

      const itens = result.map((row) => {
        const quantidade = parseFloat(String(row.quantidadeTotal || "0"));
        const valorTotalNum = parseFloat(String(row.valorTotal || "0"));
        const precoMedio = quantidade > 0 ? valorTotalNum / quantidade : 0;
        return {
          produtoId: row.produtoId,
          produtoNome: row.produtoNome,
          quantidade,
          valorTotal: valorTotalNum,
          precoMedio,
        };
      });

      const totalQuantidade = itens.reduce((s, i) => s + i.quantidade, 0);
      const totalValor = itens.reduce((s, i) => s + i.valorTotal, 0);
      const precoMedioGeral = totalQuantidade > 0 ? totalValor / totalQuantidade : 0;

      return { itens, totalQuantidade, totalValor, precoMedioGeral };
    }),
});
