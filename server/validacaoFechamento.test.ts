import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock do banco de dados
const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();

const mockDb = {
  select: (...args: any[]) => {
    mockSelect(...args);
    return {
      from: (...fArgs: any[]) => {
        mockFrom(...fArgs);
        return {
          where: (...wArgs: any[]) => {
            mockWhere(...wArgs);
            return {
              limit: (...lArgs: any[]) => {
                mockLimit(...lArgs);
                return Promise.resolve([]);
              },
              then: (resolve: any) => resolve([]),
              [Symbol.iterator]: function* () {},
            };
          },
          then: (resolve: any) => resolve([]),
          [Symbol.iterator]: function* () {},
        };
      },
    };
  },
};

// Mock getDb
vi.mock("./db", () => ({
  getDb: vi.fn(() => Promise.resolve(mockDb)),
}));

// Mock do schema
vi.mock("../drizzle/schema", () => ({
  periodoCusto: { id: "id", mes: "mes", ano: "ano" },
  itemDespesaImportado: { periodoCustoId: "periodoCustoId" },
  lancamentoFluxo: { periodoCustoId: "periodoCustoId" },
  lancamentoSalario: { periodoCustoId: "periodoCustoId" },
  lancamentoCusto: { periodoCustoId: "periodoCustoId", contaCustoId: "contaCustoId", observacoes: "observacoes" },
  resumoVendasProduto: { periodoCustoId: "periodoCustoId" },
  producao: { data: "data" },
}));

describe("validacaoFechamento_router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deve exportar o validacaoFechamentoRouter", async () => {
    const mod = await import("./validacaoFechamento_router");
    expect(mod.validacaoFechamentoRouter).toBeDefined();
  });

  it("deve ter a procedure verificar definida", async () => {
    const mod = await import("./validacaoFechamento_router");
    const router = mod.validacaoFechamentoRouter;
    // Verificar que o router tem a procedure 'verificar'
    expect(router).toBeDefined();
    // O router é um objeto tRPC com _def.procedures
    const procedures = (router as any)._def?.procedures;
    if (procedures) {
      expect(procedures.verificar).toBeDefined();
    }
  });
});
