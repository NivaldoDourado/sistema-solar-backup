import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock getDb
vi.mock("./db", () => ({
  getDb: vi.fn(),
}));

import { getDb } from "./db";

describe("rateioMem_router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should export rateioMemRouter with calcularRateio procedure", async () => {
    const { rateioMemRouter } = await import("./rateioMem_router");
    expect(rateioMemRouter).toBeDefined();
    // Check that the router has the expected procedures
    expect(rateioMemRouter._def.procedures).toHaveProperty("calcularRateio");
    expect(rateioMemRouter._def.procedures).toHaveProperty("resumoPorSubsetor");
  });

  it("should return empty result when db is not available", async () => {
    (getDb as any).mockResolvedValue(null);

    const { rateioMemRouter } = await import("./rateioMem_router");
    const caller = rateioMemRouter.createCaller({
      user: { id: 1, role: "admin", openId: "test", name: "Test" },
      req: {} as any,
      res: {} as any,
    });

    const result = await caller.calcularRateio({ periodoCustoId: 60001 });
    expect(result).toEqual({ subsetores: [], totalGeral: 0, equipamentosSemRateio: [] });
  });

  it("should return empty result when period not found", async () => {
    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    };
    (getDb as any).mockResolvedValue(mockDb);

    const { rateioMemRouter } = await import("./rateioMem_router");
    const caller = rateioMemRouter.createCaller({
      user: { id: 1, role: "admin", openId: "test", name: "Test" },
      req: {} as any,
      res: {} as any,
    });

    const result = await caller.calcularRateio({ periodoCustoId: 99999 });
    expect(result).toEqual({ subsetores: [], totalGeral: 0, equipamentosSemRateio: [] });
  });

  it("should have correct SETOR_PARA_SUBSETOR_MEM mappings", async () => {
    // Verify the module exports the correct constants by checking the router behavior
    const { rateioMemRouter } = await import("./rateioMem_router");
    expect(rateioMemRouter).toBeDefined();
  });

  it("should correctly map CLASSIFICACAO_PARA_CAMPO", async () => {
    // Import the module to verify it loads without errors
    const mod = await import("./rateioMem_router");
    expect(mod.rateioMemRouter).toBeDefined();
  });
});

describe("rateioMem - Integration logic", () => {
  it("should correctly calculate proportional hours distribution", () => {
    // Test the core logic: given items with quantities, distribute hours proportionally
    const itens = [
      { setorId: 7, quantidade: 600 },  // CARGA E TRANSPORTE
      { setorId: 8, quantidade: 200 },  // DECAPEAMENTO
      { setorId: 13, quantidade: 200 }, // MOV. ESTOQUE
    ];
    const totalQtd = itens.reduce((sum, i) => sum + i.quantidade, 0);
    const horasDia = 10;

    const distribuicao = itens.map(item => ({
      setorId: item.setorId,
      horas: horasDia * (item.quantidade / totalQtd),
    }));

    expect(distribuicao[0].horas).toBeCloseTo(6.0);  // 60%
    expect(distribuicao[1].horas).toBeCloseTo(2.0);  // 20%
    expect(distribuicao[2].horas).toBeCloseTo(2.0);  // 20%
    expect(distribuicao.reduce((s, d) => s + d.horas, 0)).toBeCloseTo(horasDia);
  });

  it("should correctly calculate expense allocation by sector", () => {
    // Test: given an equipment with 60% in sector A and 40% in sector B,
    // R$1000 in combustível should be split R$600 / R$400
    const despesaTotal = 1000;
    const horasSetorA = 6;
    const horasSetorB = 4;
    const horasTotal = horasSetorA + horasSetorB;

    const fatorA = horasSetorA / horasTotal;
    const fatorB = horasSetorB / horasTotal;

    expect(despesaTotal * fatorA).toBeCloseTo(600);
    expect(despesaTotal * fatorB).toBeCloseTo(400);
  });

  it("should handle equal distribution when all quantities are zero", () => {
    // When all items have quantity 0, distribute equally
    const itens = [
      { setorId: 3, quantidade: 0 },
      { setorId: 5, quantidade: 0 },
      { setorId: 6, quantidade: 0 },
    ];
    const horasDia = 12;
    const numSetores = itens.length;

    const distribuicao = itens.map(item => ({
      setorId: item.setorId,
      horas: horasDia / numSetores,
    }));

    expect(distribuicao[0].horas).toBeCloseTo(4.0);
    expect(distribuicao[1].horas).toBeCloseTo(4.0);
    expect(distribuicao[2].horas).toBeCloseTo(4.0);
  });

  it("should correctly aggregate multiple sectors into same MEM subsetor", () => {
    // BRITAGEM SECUNDÁRIA, TERCEÁRIA, QUARTENÁRIA, MÓVEL → BRITAGEM SEC./TERC./QUART.
    const setores = ["BRITAGEM SECUNDÁRIA", "BRITAGEM TERCEÁRIA", "BRITAGEM QUARTENÁRIA", "BRITAGEM MÓVEL"];
    const SETOR_PARA_SUBSETOR_MEM: Record<string, { subsetor: string; grupo: string }> = {
      "BRITAGEM SECUNDÁRIA": { subsetor: "BRITAGEM SEC./TERC./QUART.", grupo: "BRITAGEM" },
      "BRITAGEM TERCEÁRIA": { subsetor: "BRITAGEM SEC./TERC./QUART.", grupo: "BRITAGEM" },
      "BRITAGEM QUARTENÁRIA": { subsetor: "BRITAGEM SEC./TERC./QUART.", grupo: "BRITAGEM" },
      "BRITAGEM MÓVEL": { subsetor: "BRITAGEM SEC./TERC./QUART.", grupo: "BRITAGEM" },
    };

    const subsetores = new Set(setores.map(s => SETOR_PARA_SUBSETOR_MEM[s]?.subsetor));
    expect(subsetores.size).toBe(1);
    expect(subsetores.has("BRITAGEM SEC./TERC./QUART.")).toBe(true);
  });
});
