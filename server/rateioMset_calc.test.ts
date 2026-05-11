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

// Mock do schema (necessário para imports)
vi.mock("../drizzle/schema", () => ({
  lancamentoFluxo: { periodoCustoId: "periodoCustoId" },
  lancamentoSalario: { periodoCustoId: "periodoCustoId" },
  lancamentoCusto: { periodoCustoId: "periodoCustoId", contaCustoId: "contaCustoId" },
  periodoCusto: { id: "id" },
  setores: { id: "id", nome: "nome" },
}));

describe("rateioMset_calc", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deve exportar a função calcularRateioMset", async () => {
    const mod = await import("./rateioMset_calc");
    expect(mod.calcularRateioMset).toBeDefined();
    expect(typeof mod.calcularRateioMset).toBe("function");
  });

  it("deve exportar o mapeamento SETOR_PARA_SUBSETOR_MSET", async () => {
    const mod = await import("./rateioMset_calc");
    expect(mod.SETOR_PARA_SUBSETOR_MSET).toBeDefined();
    expect(mod.SETOR_PARA_SUBSETOR_MSET["ADMINISTRAÇÃO"]).toEqual({
      subsetor: "ADMINISTRAÇÃO",
      grupo: "ADMINISTRAÇÃO",
    });
    expect(mod.SETOR_PARA_SUBSETOR_MSET["BRITAGEM PRIMÁRIA"]).toEqual({
      subsetor: "BRITAGEM PRIMÁRIA",
      grupo: "BRITAGEM",
    });
    expect(mod.SETOR_PARA_SUBSETOR_MSET["DESMONTE PRIMÁRIO"]).toEqual({
      subsetor: "DESMONTE PRIMÁRIO",
      grupo: "DESMONTE DE ROCHA",
    });
    expect(mod.SETOR_PARA_SUBSETOR_MSET["EXPEDIÇÃO"]).toEqual({
      subsetor: "EXPEDIÇÃO",
      grupo: "EXPEDIÇÃO",
    });
  });

  it("deve retornar resultado vazio quando período não existe", async () => {
    const mod = await import("./rateioMset_calc");
    // O mock retorna array vazio para a query do período
    const result = await mod.calcularRateioMset(999);
    expect(result).toEqual({ despesas: [], totalGeral: 0, porSubsetor: {} });
  });

  it("deve ter mapeamentos corretos de setor para subsetor", async () => {
    const mod = await import("./rateioMset_calc");
    const map = mod.SETOR_PARA_SUBSETOR_MSET;

    // Verificar todos os grupos
    const grupos = new Set(Object.values(map).map(v => v.grupo));
    expect(grupos.has("DESMONTE DE ROCHA")).toBe(true);
    expect(grupos.has("BRITAGEM")).toBe(true);
    expect(grupos.has("EXPEDIÇÃO")).toBe(true);
    expect(grupos.has("SERVIÇOS AUXILIARES")).toBe(true);
    expect(grupos.has("ADMINISTRAÇÃO")).toBe(true);
    expect(grupos.has("PEDRA PARA BRITADOR")).toBe(true);

    // Verificar mapeamentos específicos
    expect(map["OFICINA"]).toEqual({ subsetor: "OFICINA E ALMOXARIFADO", grupo: "SERVIÇOS AUXILIARES" });
    expect(map["REFEITÓRIO"]).toEqual({ subsetor: "REFEITÓRIO E LIMPEZA", grupo: "SERVIÇOS AUXILIARES" });
    expect(map["DECAPEAMENTO"]).toEqual({ subsetor: "DECAPEAMENTO", grupo: "DESMONTE DE ROCHA" });
  });
});
