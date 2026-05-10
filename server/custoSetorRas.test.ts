import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock do módulo db para evitar conexão real com banco
// O mock suporta múltiplas chamadas select() retornando arrays vazios
// Chains: select().from().where().orderBy() → []
//         select().from().where() → [] (thenable)
//         select().from() → [] (thenable)
function createMockChain() {
  const emptyResult: any[] = [];
  // Make objects thenable so Promise.all works on chains without orderBy
  const whereResult: any = {
    orderBy: vi.fn().mockResolvedValue(emptyResult),
    then: (resolve: any, reject?: any) => Promise.resolve(emptyResult).then(resolve, reject),
  };
  const fromResult: any = {
    where: vi.fn().mockReturnValue(whereResult),
    orderBy: vi.fn().mockResolvedValue(emptyResult),
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

describe("custoSetorRas router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("listarEquipamentosPorSubsetor retorna array vazio quando não há dados", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.custoSetorRas.listarEquipamentosPorSubsetor({
      periodoCustoId: 1,
      subsetorNome: "DESMONTE PRIMÁRIO",
    });

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });

  it("listarEquipamentosPorPeriodo retorna array vazio quando não há dados", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.custoSetorRas.listarEquipamentosPorPeriodo({
      periodoCustoId: 1,
    });

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });

  it("listarDespesasPorSubsetor retorna array vazio quando não há dados", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.custoSetorRas.listarDespesasPorSubsetor({
      periodoCustoId: 1,
      subsetorNome: "DESMONTE PRIMÁRIO",
    });

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });

  it("listarDespesasPorPeriodo retorna array vazio quando não há dados", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.custoSetorRas.listarDespesasPorPeriodo({
      periodoCustoId: 1,
    });

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });

  it("relatorioAnalitico retorna estrutura correta", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.custoSetorRas.relatorioAnalitico({
      periodoCustoId: 1,
    });

    expect(result).toHaveProperty("grupos");
    expect(result).toHaveProperty("totalGeral");
    expect(Array.isArray(result.grupos)).toBe(true);
    expect(typeof result.totalGeral).toBe("number");
  });

  it("relatorioAnalitico retorna totalGeral = 0 quando não há dados", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.custoSetorRas.relatorioAnalitico({
      periodoCustoId: 999,
    });

    expect(result.totalGeral).toBe(0);
    expect(result.grupos).toHaveLength(0);
  });

  it("deletarPorPeriodo retorna success: true", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.custoSetorRas.deletarPorPeriodo({
      periodoCustoId: 1,
    });

    expect(result).toEqual({ success: true });
  });
});
