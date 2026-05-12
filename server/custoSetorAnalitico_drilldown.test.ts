import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock do módulo db para evitar conexão real com banco
function createMockChain() {
  const emptyResult: any[] = [];
  const limitResult: any = {
    then: (resolve: any, reject?: any) => Promise.resolve(emptyResult).then(resolve, reject),
  };
  const whereResult: any = {
    orderBy: vi.fn().mockResolvedValue(emptyResult),
    limit: vi.fn().mockReturnValue(limitResult),
    then: (resolve: any, reject?: any) => Promise.resolve(emptyResult).then(resolve, reject),
  };
  const fromResult: any = {
    where: vi.fn().mockReturnValue(whereResult),
    orderBy: vi.fn().mockResolvedValue(emptyResult),
    limit: vi.fn().mockReturnValue(limitResult),
    then: (resolve: any, reject?: any) => Promise.resolve(emptyResult).then(resolve, reject),
  };
  return {
    from: vi.fn().mockReturnValue(fromResult),
  };
}

vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue({
    select: vi.fn().mockImplementation(() => createMockChain()),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue({ rowsAffected: 0 }),
    }),
  }),
}));

function createAuthContext(): TrpcContext {
  const user: NonNullable<TrpcContext["user"]> = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("Drill-down: custoSetorRas.despesasPorDescricao", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna estrutura correta com subsetores e total", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.custoSetorRas.despesasPorDescricao({
      periodoCustoId: 1,
      descricao: "Energia Elétrica",
    });

    expect(result).toHaveProperty("subsetores");
    expect(result).toHaveProperty("total");
    expect(Array.isArray(result.subsetores)).toBe(true);
    expect(typeof result.total).toBe("number");
  });

  it("retorna total 0 e subsetores vazio quando não há dados", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.custoSetorRas.despesasPorDescricao({
      periodoCustoId: 999,
      descricao: "Despesa Inexistente",
    });

    expect(result.total).toBe(0);
    expect(result.subsetores).toHaveLength(0);
  });

  it("aceita diferentes descrições de despesas específicas", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const descricoes = [
      "Energia Elétrica",
      "Despesas Administrativas",
      "Consultorias Especializadas",
      "Equipamentos de Apoio",
      "Outras Despesas de Setores",
    ];

    for (const descricao of descricoes) {
      const result = await caller.custoSetorRas.despesasPorDescricao({
        periodoCustoId: 1,
        descricao,
      });
      expect(result).toHaveProperty("subsetores");
      expect(result).toHaveProperty("total");
    }
  });
});

describe("Drill-down: itensDespesa.listarItensDetalhados", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna array vazio quando não há itens para o equipamento/classificação", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.itensDespesa.listarItensDetalhados({
      periodoCustoId: 1,
      equipamentoTag: "PC300",
      classificacao: "pecas_reposicao",
    });

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });

  it("aceita diferentes classificações de equipamento", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const classificacoes = [
      "combustivel",
      "lubrificantes",
      "pecas_desgaste",
      "pecas_reposicao",
      "outras_despesas",
    ];

    for (const classificacao of classificacoes) {
      const result = await caller.itensDespesa.listarItensDetalhados({
        periodoCustoId: 1,
        equipamentoTag: "944C",
        classificacao,
      });
      expect(Array.isArray(result)).toBe(true);
    }
  });
});

describe("Drill-down: mapeamento CAMPO_PARA_CLASSIFICACAO", () => {
  it("mapeia corretamente os campos de equipamento para classificações", () => {
    // Estes mapeamentos são usados no frontend para converter o campo
    // do equipamento (ex: "pecasReposicao") para a classificação do
    // itemDespesaImportado (ex: "pecas_reposicao")
    const CAMPO_PARA_CLASSIFICACAO: Record<string, string> = {
      combustivel: "combustivel",
      lubrificantes: "lubrificantes",
      pecasDesgaste: "pecas_desgaste",
      pecasReposicao: "pecas_reposicao",
      outrasDespesas: "outras_despesas",
    };

    expect(CAMPO_PARA_CLASSIFICACAO.combustivel).toBe("combustivel");
    expect(CAMPO_PARA_CLASSIFICACAO.lubrificantes).toBe("lubrificantes");
    expect(CAMPO_PARA_CLASSIFICACAO.pecasDesgaste).toBe("pecas_desgaste");
    expect(CAMPO_PARA_CLASSIFICACAO.pecasReposicao).toBe("pecas_reposicao");
    expect(CAMPO_PARA_CLASSIFICACAO.outrasDespesas).toBe("outras_despesas");
  });

  it("extrai corretamente a tag do nome do equipamento", () => {
    // Função usada no frontend para extrair a TAG do nome
    function extrairTag(equipamentoNome: string): string {
      const idx = equipamentoNome.indexOf(" - ");
      if (idx > 0) return equipamentoNome.substring(0, idx).trim();
      return equipamentoNome.trim();
    }

    expect(extrairTag("PC300 - ESCAVADEIRA HIDRÁULICA KOMATSU PC300")).toBe("PC300");
    expect(extrairTag("944C - ESCAVADEIRA HIDRÁULICA LIEBHERR 944C")).toBe("944C");
    expect(extrairTag("HZK7665 - CAMINHÃO BASCULANTE HZK-7665")).toBe("HZK7665");
    expect(extrairTag("DRAGA D'AGUA A DIESEL - DRAGA D'AGUA A DIESEL")).toBe("DRAGA D'AGUA A DIESEL");
    expect(extrairTag("MOTOR BOMBA")).toBe("MOTOR BOMBA");
  });
});

describe("Drill-down: CONTA_CAMPO_LABEL (labels legíveis)", () => {
  it("contém todos os campos esperados com labels em português", () => {
    const CONTA_CAMPO_LABEL: Record<string, string> = {
      salOperEncOper: "Sal.Oper./Enc. Oper.",
      depreciacao: "Depreciação",
      combustivel: "Combustível",
      lubrificantes: "Lubrificantes",
      pecasDesgaste: "Peças de Desgaste",
      pecasReposicao: "Peças de Reposição / Itens de Consumo",
      outrasDespesas: "Outras Despesas",
    };

    // Verifica que todos os campos esperados existem
    const camposEsperados = [
      "salOperEncOper", "depreciacao", "combustivel",
      "lubrificantes", "pecasDesgaste", "pecasReposicao", "outrasDespesas",
    ];
    for (const campo of camposEsperados) {
      expect(CONTA_CAMPO_LABEL).toHaveProperty(campo);
      expect(typeof CONTA_CAMPO_LABEL[campo]).toBe("string");
      expect(CONTA_CAMPO_LABEL[campo].length).toBeGreaterThan(0);
    }
  });
});
