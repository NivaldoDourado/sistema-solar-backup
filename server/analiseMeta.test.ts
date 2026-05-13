import { describe, it, expect, vi } from "vitest";

/**
 * Unit tests for simulacaoCusto.analiseMeta procedure logic
 * Tests the mathematical calculations for meta analysis scenarios
 */

describe("analiseMeta - cálculos matemáticos", () => {
  // Helper to simulate the calculation logic
  function calcularAnalise(params: {
    metaValor: number;
    custoTotalMedio: number;
    producaoMedia: number;
    vendasMedia: number;
  }) {
    const { metaValor, custoTotalMedio, producaoMedia, vendasMedia } = params;

    // Cenário 1: Produção necessária
    const producaoNecessaria = custoTotalMedio / metaValor;
    const aumentoProducao = producaoMedia > 0
      ? ((producaoNecessaria - producaoMedia) / producaoMedia) * 100
      : 0;

    // Relação vendas/produção
    const relacaoVendasProducao = producaoMedia > 0 ? vendasMedia / producaoMedia : 1;
    const vendasNecessarias = producaoNecessaria * relacaoVendasProducao;

    // Cenário 2: Custo máximo
    const custoTotalMaximo = metaValor * producaoMedia;
    const reducaoCustoNecessaria = custoTotalMedio > 0
      ? ((custoTotalMedio - custoTotalMaximo) / custoTotalMedio) * 100
      : 0;

    // Cenário 3: Equilibrado (raiz quadrada)
    const custoTonAtual = producaoMedia > 0 ? custoTotalMedio / producaoMedia : 0;
    const fatorEquilibrio = Math.sqrt(custoTonAtual / metaValor);
    const producaoEquilibrada = producaoMedia * fatorEquilibrio;
    const custoEquilibrado = custoTotalMedio / fatorEquilibrio;

    return {
      cenario1: { producaoNecessaria, aumentoProducao, vendasNecessarias },
      cenario2: { custoTotalMaximo, reducaoCustoNecessaria },
      cenario3: { producaoEquilibrada, custoEquilibrado },
      custoTonAtual,
    };
  }

  it("deve calcular produção necessária corretamente (Cenário 1)", () => {
    // Meta R$29/t, custo médio R$2.638.956, produção média 86.878t
    const result = calcularAnalise({
      metaValor: 29,
      custoTotalMedio: 2638956,
      producaoMedia: 86878,
      vendasMedia: 86878,
    });

    // Produção necessária = 2638956 / 29 = ~90998.48t
    expect(result.cenario1.producaoNecessaria).toBeCloseTo(2638956 / 29, 0);
    // Aumento necessário = (91001.93 - 86878) / 86878 * 100 = ~4.75%
    expect(result.cenario1.aumentoProducao).toBeGreaterThan(0);
    expect(result.cenario1.aumentoProducao).toBeLessThan(10);
  });

  it("deve calcular custo máximo corretamente (Cenário 2)", () => {
    const result = calcularAnalise({
      metaValor: 29,
      custoTotalMedio: 2638956,
      producaoMedia: 86878,
      vendasMedia: 86878,
    });

    // Custo máximo = 29 * 86878 = R$2.519.462
    expect(result.cenario2.custoTotalMaximo).toBeCloseTo(2519462, 0);
    // Redução necessária > 0 (pois custo atual > meta)
    expect(result.cenario2.reducaoCustoNecessaria).toBeGreaterThan(0);
    expect(result.cenario2.reducaoCustoNecessaria).toBeLessThan(20);
  });

  it("deve calcular cenário equilibrado com raiz quadrada", () => {
    const result = calcularAnalise({
      metaValor: 29,
      custoTotalMedio: 2638956,
      producaoMedia: 86878,
      vendasMedia: 86878,
    });

    // Custo/t atual = 2638956 / 86878 = ~30.38
    expect(result.custoTonAtual).toBeCloseTo(30.38, 1);

    // Cenário equilibrado: produção sobe E custo desce
    expect(result.cenario3.producaoEquilibrada).toBeGreaterThan(86878);
    expect(result.cenario3.custoEquilibrado).toBeLessThan(2638956);

    // Verificar que o resultado atinge a meta: custoEquilibrado / producaoEquilibrada ≈ 29
    const custoTonEquilibrado = result.cenario3.custoEquilibrado / result.cenario3.producaoEquilibrada;
    expect(custoTonEquilibrado).toBeCloseTo(29, 0);
  });

  it("deve retornar aumento de 0% quando meta já é atingida", () => {
    const result = calcularAnalise({
      metaValor: 35, // Meta mais alta que o custo/t atual
      custoTotalMedio: 2638956,
      producaoMedia: 86878,
      vendasMedia: 86878,
    });

    // Custo/t atual = ~30.38, meta = 35 → já atingida
    // Produção necessária = 2638956 / 35 = 75.398 (menor que a atual)
    expect(result.cenario1.producaoNecessaria).toBeLessThan(86878);
    expect(result.cenario1.aumentoProducao).toBeLessThan(0); // negativo = já atinge
  });

  it("deve calcular vendas proporcionalmente à relação histórica", () => {
    const result = calcularAnalise({
      metaValor: 29,
      custoTotalMedio: 2638956,
      producaoMedia: 90000,
      vendasMedia: 85000, // vendas < produção (relação 0.944)
    });

    const relacao = 85000 / 90000;
    expect(result.cenario1.vendasNecessarias).toBeCloseTo(
      result.cenario1.producaoNecessaria * relacao,
      0
    );
  });

  it("deve distribuir custo máximo proporcionalmente por conta", () => {
    // Simular distribuição proporcional
    const custoTotalMaximo = 2519462;
    const contas = [
      { nome: "Combustível", media: 300000, participacao: 11.37 },
      { nome: "Sal.Adm.", media: 800000, participacao: 30.31 },
      { nome: "Peças", media: 180000, participacao: 6.82 },
    ];

    const totalParticipacao = contas.reduce((acc, c) => acc + c.participacao, 0);
    
    for (const conta of contas) {
      const valorMaximo = custoTotalMaximo * (conta.participacao / 100);
      // O valor máximo deve ser proporcional à participação
      expect(valorMaximo).toBeGreaterThan(0);
      expect(valorMaximo).toBeLessThan(custoTotalMaximo);
      // A redução deve ser a mesma para todas as contas (proporcional)
      const reducao = ((conta.media - valorMaximo) / conta.media) * 100;
      // Todas as contas devem ter a mesma % de redução (pois é proporcional)
      expect(reducao).toBeCloseTo(
        ((contas[0].media - custoTotalMaximo * (contas[0].participacao / 100)) / contas[0].media) * 100,
        1
      );
    }
  });
});
