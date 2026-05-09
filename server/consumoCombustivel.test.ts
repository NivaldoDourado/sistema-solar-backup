import { describe, it, expect } from "vitest";
import { calcularConsumoCombustivel } from "./itensDespesa_router";

describe("calcularConsumoCombustivel", () => {
  it("deve calcular consumo lt/hr usando o campo intervalo da planilha", () => {
    const itens = [
      { id: 1, data: "01/04/26", produto: "DIESEL S-10", quantidade: 260, custo: 1540, hodometro: 15615, intervalo: 12, litrosPorHora: "21.67", horaPorLitro: null },
      { id: 2, data: "02/04/26", produto: "DIESEL S-10", quantidade: 302, custo: 1789, hodometro: 15627, intervalo: 7, litrosPorHora: "43.14", horaPorLitro: null },
      { id: 3, data: "06/04/26", produto: "DIESEL S-10", quantidade: 200, custo: 1185, hodometro: 15634, intervalo: 11, litrosPorHora: "18.18", horaPorLitro: null },
    ];

    const result = calcularConsumoCombustivel(itens);

    expect(result.itens).toHaveLength(3);
    // Primeiro item: 260 / 12 = 21.67
    expect(result.itens[0].consumoCalculado).toBeCloseTo(21.67, 1);
    // Segundo item: 302 / 7 = 43.14
    expect(result.itens[1].consumoCalculado).toBeCloseTo(43.14, 1);
    // Terceiro item: 200 / 11 = 18.18
    expect(result.itens[2].consumoCalculado).toBeCloseTo(18.18, 1);

    // Resumo
    expect(result.resumo.totalAbastecimentos).toBe(3);
    expect(result.resumo.abastecimentosComConsumo).toBe(3);
    expect(result.resumo.totalLitros).toBeCloseTo(762, 0);
    expect(result.resumo.horimetroInicial).toBe(15615);
    expect(result.resumo.horimetroFinal).toBe(15634);
    expect(result.resumo.totalHorasTrabalhadas).toBeCloseTo(19, 0);
    expect(result.resumo.consumoMinimo).toBeCloseTo(18.18, 1);
    expect(result.resumo.consumoMaximo).toBeCloseTo(43.14, 1);
  });

  it("deve calcular consumo a partir de horímetros consecutivos quando intervalo é null", () => {
    const itens = [
      { id: 1, data: "01/04/26", produto: "DIESEL", quantidade: 100, custo: 600, hodometro: 1000, intervalo: null, litrosPorHora: null, horaPorLitro: null },
      { id: 2, data: "03/04/26", produto: "DIESEL", quantidade: 150, custo: 900, hodometro: 1010, intervalo: null, litrosPorHora: null, horaPorLitro: null },
      { id: 3, data: "05/04/26", produto: "DIESEL", quantidade: 120, custo: 720, hodometro: 1025, intervalo: null, litrosPorHora: null, horaPorLitro: null },
    ];

    const result = calcularConsumoCombustivel(itens);

    // Primeiro item: sem anterior, não calcula
    expect(result.itens[0].consumoCalculado).toBeNull();
    // Segundo item: 150 / (1010 - 1000) = 15.0
    expect(result.itens[1].consumoCalculado).toBeCloseTo(15.0, 1);
    // Terceiro item: 120 / (1025 - 1010) = 8.0
    expect(result.itens[2].consumoCalculado).toBeCloseTo(8.0, 1);

    expect(result.resumo.abastecimentosComConsumo).toBe(2);
  });

  it("deve lidar com itens sem horímetro", () => {
    const itens = [
      { id: 1, data: "01/04/26", produto: "DIESEL", quantidade: 200, custo: 1200, hodometro: null, intervalo: null, litrosPorHora: null, horaPorLitro: null },
      { id: 2, data: "03/04/26", produto: "DIESEL", quantidade: 150, custo: 900, hodometro: null, intervalo: null, litrosPorHora: null, horaPorLitro: null },
    ];

    const result = calcularConsumoCombustivel(itens);

    expect(result.itens).toHaveLength(2);
    expect(result.itens[0].consumoCalculado).toBeNull();
    expect(result.itens[1].consumoCalculado).toBeNull();
    expect(result.resumo.abastecimentosComConsumo).toBe(0);
    expect(result.resumo.mediaGeral).toBeNull();
    expect(result.resumo.totalLitros).toBeCloseTo(350, 0);
  });

  it("deve filtrar consumo absurdo (> 200 lt/hr)", () => {
    const itens = [
      { id: 1, data: "01/04/26", produto: "DIESEL", quantidade: 100, custo: 600, hodometro: 1000, intervalo: 5, litrosPorHora: "20.00", horaPorLitro: null },
      { id: 2, data: "02/04/26", produto: "DIESEL", quantidade: 500, custo: 3000, hodometro: 1001, intervalo: 1, litrosPorHora: "500.00", horaPorLitro: null },
    ];

    const result = calcularConsumoCombustivel(itens);

    // Primeiro: 100/5 = 20 (normal)
    expect(result.itens[0].consumoCalculado).toBeCloseTo(20, 0);
    // Segundo: 500/1 = 500 (absurdo, deve ser null)
    expect(result.itens[1].consumoCalculado).toBeNull();
    expect(result.resumo.abastecimentosComConsumo).toBe(1);
  });

  it("deve ordenar itens por horímetro crescente", () => {
    const itens = [
      { id: 3, data: "05/04/26", produto: "DIESEL", quantidade: 120, custo: 720, hodometro: 1025, intervalo: 15, litrosPorHora: "8.00", horaPorLitro: null },
      { id: 1, data: "01/04/26", produto: "DIESEL", quantidade: 100, custo: 600, hodometro: 1000, intervalo: 10, litrosPorHora: "10.00", horaPorLitro: null },
      { id: 2, data: "03/04/26", produto: "DIESEL", quantidade: 150, custo: 900, hodometro: 1010, intervalo: 10, litrosPorHora: "15.00", horaPorLitro: null },
    ];

    const result = calcularConsumoCombustivel(itens);

    // Deve estar ordenado por horímetro
    expect(result.itens[0].hodometro).toBe(1000);
    expect(result.itens[1].hodometro).toBe(1010);
    expect(result.itens[2].hodometro).toBe(1025);
  });

  it("deve calcular custo médio por litro e por hora", () => {
    const itens = [
      { id: 1, data: "01/04/26", produto: "DIESEL", quantidade: 200, custo: 1200, hodometro: 1000, intervalo: 10, litrosPorHora: "20.00", horaPorLitro: null },
      { id: 2, data: "05/04/26", produto: "DIESEL", quantidade: 300, custo: 1800, hodometro: 1020, intervalo: 20, litrosPorHora: "15.00", horaPorLitro: null },
    ];

    const result = calcularConsumoCombustivel(itens);

    // Custo médio por litro: 3000 / 500 = 6.00
    expect(result.resumo.custoMedioPorLitro).toBeCloseTo(6.0, 1);
    // Custo médio por hora: 3000 / (1020 - 1000) = 150.00
    expect(result.resumo.custoMedioPorHora).toBeCloseTo(150.0, 0);
  });

  it("deve usar litrosPorHora da planilha como referência (ltHrPlanilha)", () => {
    const itens = [
      { id: 1, data: "01/04/26", produto: "DIESEL", quantidade: 260, custo: 1540, hodometro: 15615, intervalo: 12, litrosPorHora: "21,67", horaPorLitro: null },
    ];

    const result = calcularConsumoCombustivel(itens);

    // Deve parsear o formato brasileiro com vírgula
    expect(result.itens[0].ltHrPlanilha).toBeCloseTo(21.67, 1);
  });

  it("deve retornar array vazio para lista vazia", () => {
    const result = calcularConsumoCombustivel([]);

    expect(result.itens).toHaveLength(0);
    expect(result.resumo.totalAbastecimentos).toBe(0);
    expect(result.resumo.totalLitros).toBe(0);
    expect(result.resumo.mediaGeral).toBeNull();
  });
});
