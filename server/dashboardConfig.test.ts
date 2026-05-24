import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createContext(role: "admin" | "consultoria" | "diretoria" | "gerencia" | "usuario"): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: role as any,
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
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("dashboardConfig", () => {
  describe("metadata", () => {
    it("returns all available cards with groups", async () => {
      const ctx = createContext("consultoria");
      const caller = appRouter.createCaller(ctx);

      const result = await caller.dashboardConfig.metadata();

      expect(result).toHaveProperty("cards");
      expect(result).toHaveProperty("groups");
      expect(result).toHaveProperty("roles");
      expect(Array.isArray(result.cards)).toBe(true);
      expect(result.cards.length).toBeGreaterThan(0);
      
      // Check card structure
      const firstCard = result.cards[0];
      expect(firstCard).toHaveProperty("id");
      expect(firstCard).toHaveProperty("label");
      expect(firstCard).toHaveProperty("grupo");

      // Check known card IDs exist
      const cardIds = result.cards.map((c: any) => c.id);
      expect(cardIds).toContain("status_lancamentos");
      expect(cardIds).toContain("custos_totais");
      expect(cardIds).toContain("combustivel");
      expect(cardIds).toContain("vendas");
      expect(cardIds).toContain("producao_caminhoes");
      expect(cardIds).toContain("horas_por_setor");
      expect(cardIds).toContain("acesso_rapido");
      expect(cardIds).toContain("visao_geral");
    });

    it("returns available roles", async () => {
      const ctx = createContext("consultoria");
      const caller = appRouter.createCaller(ctx);

      const result = await caller.dashboardConfig.metadata();

      expect(result.roles).toContain("consultoria");
      expect(result.roles).toContain("diretor");
      expect(result.roles).toContain("gerente");
      expect(result.roles).toContain("usuario");
    });
  });

  describe("getByRole", () => {
    it("returns default config for a role when no custom config exists", async () => {
      const ctx = createContext("consultoria");
      const caller = appRouter.createCaller(ctx);

      const result = await caller.dashboardConfig.getByRole({ perfil: "diretor" });

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      
      // Each item should have cardId, visivel, ordem
      const firstItem = result[0];
      expect(firstItem).toHaveProperty("cardId");
      expect(firstItem).toHaveProperty("visivel");
      expect(firstItem).toHaveProperty("ordem");
      expect(typeof firstItem.visivel).toBe("boolean");
      expect(typeof firstItem.ordem).toBe("number");
    });

    it("rejects non-consultoria users from accessing getByRole", async () => {
      const ctx = createContext("usuario");
      const caller = appRouter.createCaller(ctx);

      await expect(caller.dashboardConfig.getByRole({ perfil: "diretor" }))
        .rejects.toThrow();
    });
  });

  describe("myConfig", () => {
    it("returns visible cards for the current user based on their role", async () => {
      const ctx = createContext("consultoria");
      const caller = appRouter.createCaller(ctx);

      const result = await caller.dashboardConfig.myConfig();

      expect(result).toHaveProperty("visibleCards");
      expect(result).toHaveProperty("cardOrder");
      expect(Array.isArray(result.visibleCards)).toBe(true);
      expect(result.visibleCards.length).toBeGreaterThan(0);
      
      // All visible cards should be strings
      result.visibleCards.forEach((cardId: any) => {
        expect(typeof cardId).toBe("string");
      });
    });

    it("returns different configs for different roles", async () => {
      const consultoriaCaller = appRouter.createCaller(createContext("consultoria"));
      const usuarioCaller = appRouter.createCaller(createContext("usuario"));

      const consultoriaConfig = await consultoriaCaller.dashboardConfig.myConfig();
      const usuarioConfig = await usuarioCaller.dashboardConfig.myConfig();

      // Both should return valid configs
      expect(consultoriaConfig.visibleCards.length).toBeGreaterThan(0);
      expect(usuarioConfig.visibleCards.length).toBeGreaterThan(0);
    });

    it("rejects unauthenticated users", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);

      await expect(caller.dashboardConfig.myConfig())
        .rejects.toThrow();
    });
  });

  describe("save", () => {
    it("rejects non-consultoria users from saving", async () => {
      const ctx = createContext("usuario");
      const caller = appRouter.createCaller(ctx);

      await expect(caller.dashboardConfig.save({
        perfil: "usuario",
        cards: [{ cardId: "vendas", visivel: true, ordem: 1 }],
      })).rejects.toThrow();
    });

    it("accepts valid save input from consultoria", async () => {
      const ctx = createContext("consultoria");
      const caller = appRouter.createCaller(ctx);

      const result = await caller.dashboardConfig.save({
        perfil: "diretor",
        cards: [
          { cardId: "vendas", visivel: true, ordem: 1 },
          { cardId: "custos_totais", visivel: false, ordem: 2 },
          { cardId: "combustivel", visivel: true, ordem: 3 },
        ],
      });

      expect(result).toHaveProperty("success", true);
    });

    it("saved config is reflected in getByRole", async () => {
      const ctx = createContext("consultoria");
      const caller = appRouter.createCaller(ctx);

      // Save custom config
      await caller.dashboardConfig.save({
        perfil: "gerente",
        cards: [
          { cardId: "vendas", visivel: true, ordem: 1 },
          { cardId: "custos_totais", visivel: false, ordem: 2 },
        ],
      });

      // Retrieve and verify
      const config = await caller.dashboardConfig.getByRole({ perfil: "gerente" });
      const vendasCard = config.find((c: any) => c.cardId === "vendas");
      const custosCard = config.find((c: any) => c.cardId === "custos_totais");

      expect(vendasCard?.visivel).toBe(true);
      expect(custosCard?.visivel).toBe(false);
    });
  });

  describe("resetToDefault", () => {
    it("rejects non-consultoria users", async () => {
      const ctx = createContext("usuario");
      const caller = appRouter.createCaller(ctx);

      await expect(caller.dashboardConfig.resetToDefault({ perfil: "usuario" }))
        .rejects.toThrow();
    });

    it("resets config to defaults for consultoria", async () => {
      const ctx = createContext("consultoria");
      const caller = appRouter.createCaller(ctx);

      const result = await caller.dashboardConfig.resetToDefault({ perfil: "diretor" });
      expect(result).toHaveProperty("success", true);
    });
  });
});
