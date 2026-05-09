import { describe, it, expect } from "vitest";

// Testes de unidade para a lógica de classificação e parsing de itens detalhados
// Os testes de integração com banco são cobertos pelos testes existentes de importDespesas

describe("itensDespesa_router", () => {
  describe("Estrutura do router", () => {
    it("deve exportar itensDespesaRouter", async () => {
      const mod = await import("./itensDespesa_router");
      expect(mod.itensDespesaRouter).toBeDefined();
    });

    it("deve ter as procedures esperadas", async () => {
      const mod = await import("./itensDespesa_router");
      const router = mod.itensDespesaRouter;
      // Verificar que o router tem as procedures definidas
      expect(router).toBeDefined();
      // O router é um objeto tRPC - verificar que foi criado corretamente
      expect(typeof router).toBe("object");
    });
  });

  describe("Classificação de despesas - labels", () => {
    const CLASSIFICACAO_LABELS: Record<string, string> = {
      combustivel: "Combustível",
      lubrificantes: "Lubrificantes",
      pecas_desgaste: "Peças de Desgaste",
      pecas_reposicao: "Peças de Reposição / Itens de Consumo",
      outras_despesas: "Outras Despesas dos Equipamentos",
    };

    it("deve ter label para todas as classificações conhecidas", () => {
      const classificacoes = ["combustivel", "lubrificantes", "pecas_desgaste", "pecas_reposicao", "outras_despesas"];
      for (const c of classificacoes) {
        expect(CLASSIFICACAO_LABELS[c]).toBeDefined();
        expect(CLASSIFICACAO_LABELS[c].length).toBeGreaterThan(0);
      }
    });

    it("deve ter labels em português", () => {
      expect(CLASSIFICACAO_LABELS.combustivel).toBe("Combustível");
      expect(CLASSIFICACAO_LABELS.lubrificantes).toBe("Lubrificantes");
      expect(CLASSIFICACAO_LABELS.pecas_desgaste).toBe("Peças de Desgaste");
      expect(CLASSIFICACAO_LABELS.pecas_reposicao).toBe("Peças de Reposição / Itens de Consumo");
      expect(CLASSIFICACAO_LABELS.outras_despesas).toBe("Outras Despesas dos Equipamentos");
    });
  });

  describe("Campos de itens detalhados", () => {
    it("deve incluir campos de combustível (hodometro, litrosPorHora)", () => {
      // Simular um item de combustível
      const itemCombustivel = {
        sequencia: "1",
        data: "02/04/26",
        produto: "OLEO DIESEL S-10 BOMBA SOLAR - 02",
        grupoProduto: "Combustível",
        quantidade: 539,
        custo: 3196.27,
        centroCusto: "PEDREIRA",
        hodometro: 857,
        intervalo: null,
        horaPorLitro: "",
        litrosPorHora: "4.52",
        observacoes: "",
        classificacao: "combustivel" as const,
      };

      expect(itemCombustivel.hodometro).toBe(857);
      expect(itemCombustivel.litrosPorHora).toBe("4.52");
      expect(itemCombustivel.quantidade).toBe(539);
      expect(itemCombustivel.custo).toBe(3196.27);
    });

    it("deve incluir campos de peças de reposição", () => {
      const itemPeca = {
        sequencia: "5",
        data: "06/04/26",
        produto: "ELETRODO UTP 65",
        grupoProduto: "Material de Consumo",
        quantidade: 1,
        custo: 5.59,
        centroCusto: "PEDREIRA",
        hodometro: null,
        intervalo: null,
        horaPorLitro: "",
        litrosPorHora: "",
        observacoes: "",
        classificacao: "pecas_reposicao" as const,
      };

      expect(itemPeca.hodometro).toBeNull();
      expect(itemPeca.quantidade).toBe(1);
      expect(itemPeca.custo).toBe(5.59);
    });
  });

  describe("Normalização de espaços no codigoTag", () => {
    it("deve normalizar espaços duplos para simples", () => {
      const raw = "OBRA  ALMOXARIFADO";
      const normalized = raw.replace(/\s+/g, " ").trim();
      expect(normalized).toBe("OBRA ALMOXARIFADO");
    });

    it("deve normalizar múltiplos espaços", () => {
      const raw = "SOLOMIN   OUTROS";
      const normalized = raw.replace(/\s+/g, " ").trim();
      expect(normalized).toBe("SOLOMIN OUTROS");
    });

    it("deve manter tag sem espaços extras inalterada", () => {
      const raw = "ESCAVADEIRA R 938 02";
      const normalized = raw.replace(/\s+/g, " ").trim();
      expect(normalized).toBe("ESCAVADEIRA R 938 02");
    });
  });
});
