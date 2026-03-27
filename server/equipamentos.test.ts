import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "consultoria",
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

describe("equipamentos router", () => {
  it("should list equipamentos", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.equipamentos.list();

    expect(Array.isArray(result)).toBe(true);
  });

  it("should create a new equipamento", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const newEquipamento = {
      codigoTag: "TEST-001",
      nomeDoEquipamento: "Equipamento de Teste",
      modelo: "Modelo X",
      ano: "2024",
      ativo: "sim" as const,
    };

    const result = await caller.equipamentos.create(newEquipamento);

    expect(result).toHaveProperty("id");
    expect(result.nomeDoEquipamento).toBe(newEquipamento.nomeDoEquipamento);
    expect(result.codigoTag).toBe(newEquipamento.codigoTag);
  });

  it("should fail to create equipamento without required fields", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.equipamentos.create({
        codigoTag: "TEST-002",
        nomeDoEquipamento: "", // Nome vazio deve falhar
        ativo: "sim",
      })
    ).rejects.toThrow();
  });
});
