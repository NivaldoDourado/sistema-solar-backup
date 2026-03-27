import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(role: string = "consultoria"): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };

  return { ctx };
}

describe("operadoresMotoristas router", () => {
  it("should list operadores/motoristas", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.operadoresMotoristas.list();

    expect(Array.isArray(result)).toBe(true);
  });

  it("should create a new operador/motorista", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const newOperador = {
      nome: "João da Silva - Teste",
      funcao: "operador" as const,
      matricula: "MAT-TEST-001",
      telefone: "(11) 99999-0000",
      ativo: "sim" as const,
    };

    const result = await caller.operadoresMotoristas.create(newOperador);

    expect(result).toHaveProperty("id");
    expect(result.nome).toBe(newOperador.nome);
    expect(result.funcao).toBe("operador");
  });

  it("should create operador/motorista with funcao ambos", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const newOperador = {
      nome: "Maria Santos - Teste",
      funcao: "ambos" as const,
      ativo: "sim" as const,
    };

    const result = await caller.operadoresMotoristas.create(newOperador);

    expect(result).toHaveProperty("id");
    expect(result.funcao).toBe("ambos");
  });

  it("should fail to create operador/motorista without nome", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.operadoresMotoristas.create({
        nome: "", // Nome vazio deve falhar
        funcao: "operador",
        ativo: "sim",
      })
    ).rejects.toThrow();
  });

  it("should update an operador/motorista", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Primeiro listar para pegar um ID existente
    const list = await caller.operadoresMotoristas.list();
    const testItem = list.find(item => item.nome.includes("Teste"));

    if (testItem) {
      const result = await caller.operadoresMotoristas.update({
        id: testItem.id,
        nome: "João da Silva Atualizado - Teste",
        funcao: "motorista",
        matricula: "MAT-TEST-002",
        ativo: "sim",
      });

      expect(result.success).toBe(true);
    }
  });

  it("should delete an operador/motorista", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Listar para encontrar itens de teste
    const list = await caller.operadoresMotoristas.list();
    const testItems = list.filter(item => item.nome.includes("Teste"));

    for (const item of testItems) {
      const result = await caller.operadoresMotoristas.delete({ id: item.id });
      expect(result.success).toBe(true);
    }
  });
});
