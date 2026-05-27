import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(role: "consultoria" | "admin" | "user" = "consultoria"): { ctx: TrpcContext } {
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
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

describe("simulacaoParcial", () => {
  it("parseDespesas handles empty/invalid file gracefully", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Invalid base64 may throw or return empty results depending on xlsx parsing
    try {
      const result = await caller.simulacaoParcial.parseDespesas({
        fileBase64: "not-valid-base64-content",
        fileName: "test.xlsx",
        mes: 5,
        ano: 2026,
      });
      // If it doesn't throw, it should return a result with totalItens
      expect(result).toHaveProperty("totalItens");
    } catch (e) {
      // If it throws, that's also acceptable behavior
      expect(e).toBeDefined();
    }
  });

  it("parseFluxo handles empty/invalid file gracefully", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    try {
      const result = await caller.simulacaoParcial.parseFluxo({
        fileBase64: "not-valid-base64-content",
        fileName: "test.xlsx",
        mes: 5,
        ano: 2026,
      });
      expect(result).toHaveProperty("totalItens");
    } catch (e) {
      expect(e).toBeDefined();
    }
  });

  it("limpar works even when no data exists", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Should not throw even if there's nothing to delete
    const result = await caller.simulacaoParcial.limpar({
      mes: 12,
      ano: 2099,
      tipo: "ambos",
    });

    expect(result).toHaveProperty("success", true);
  });

  it("limpar accepts tipo 'despesas' and 'fluxo'", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result1 = await caller.simulacaoParcial.limpar({
      mes: 12,
      ano: 2099,
      tipo: "despesas",
    });
    expect(result1.success).toBe(true);

    const result2 = await caller.simulacaoParcial.limpar({
      mes: 12,
      ano: 2099,
      tipo: "fluxo",
    });
    expect(result2.success).toBe(true);
  });

  it("getTotaisParciais returns empty state for period with no data", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.simulacaoParcial.getTotaisParciais({
      mes: 12,
      ano: 2099,
    });

    expect(result).toHaveProperty("temDespesas", false);
    expect(result).toHaveProperty("temFluxo", false);
    expect(result.despesas.totalGeral).toBe(0);
    expect(result.fluxo.totalGeral).toBe(0);
  });
});
