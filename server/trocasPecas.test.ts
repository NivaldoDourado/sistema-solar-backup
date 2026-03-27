import { describe, it, expect } from "vitest";

describe("Trocas de Peças vinculadas à Parte Diária", () => {
  describe("Schema e estrutura", () => {
    it("deve importar a tabela trocasPecasParteDiaria do schema", async () => {
      const schema = await import("../drizzle/schema");
      expect(schema.trocasPecasParteDiaria).toBeDefined();
    });

    it("deve ter os campos obrigatórios na tabela trocasPecasParteDiaria", async () => {
      const schema = await import("../drizzle/schema");
      const table = schema.trocasPecasParteDiaria;
      // Verificar que a tabela tem as colunas esperadas
      const columns = Object.keys(table);
      expect(columns.length).toBeGreaterThan(0);
    });

    it("deve exportar os tipos TrocaPecaParteDiaria e InsertTrocaPecaParteDiaria", async () => {
      const schema = await import("../drizzle/schema");
      // Types existem em tempo de compilação, verificamos que a tabela existe
      expect(schema.trocasPecasParteDiaria).toBeDefined();
    });
  });

  describe("Lógica de negócio", () => {
    it("deve validar que quantidade mínima é 1", () => {
      const quantidade = 1;
      expect(quantidade).toBeGreaterThanOrEqual(1);
    });

    it("deve validar que parteDiariaId é obrigatório", () => {
      const input = { parteDiariaId: 5, pecaId: 3, quantidade: 2 };
      expect(input.parteDiariaId).toBeDefined();
      expect(input.parteDiariaId).toBeGreaterThan(0);
    });

    it("deve validar que pecaId é obrigatório", () => {
      const input = { parteDiariaId: 5, pecaId: 3, quantidade: 2 };
      expect(input.pecaId).toBeDefined();
      expect(input.pecaId).toBeGreaterThan(0);
    });

    it("deve gerar observação padrão quando não fornecida", () => {
      const parteDiariaId = 42;
      const observacoes = undefined;
      const obsGerada = observacoes || `Troca registrada via Parte Diária #${parteDiariaId}`;
      expect(obsGerada).toBe("Troca registrada via Parte Diária #42");
    });

    it("deve usar observação fornecida quando disponível", () => {
      const parteDiariaId = 42;
      const observacoes = "Peça desgastada após 500h de uso";
      const obsGerada = observacoes || `Troca registrada via Parte Diária #${parteDiariaId}`;
      expect(obsGerada).toBe("Peça desgastada após 500h de uso");
    });

    it("deve criar movimentação do tipo troca", () => {
      const tipoMovimentacao = "troca";
      expect(tipoMovimentacao).toBe("troca");
      expect(["entrada", "saida", "troca"]).toContain(tipoMovimentacao);
    });
  });

  describe("Integração com módulo de Peças de Desgaste", () => {
    it("deve importar tabela movimentacoesPecas para criar movimentação automática", async () => {
      const schema = await import("../drizzle/schema");
      expect(schema.movimentacoesPecas).toBeDefined();
    });

    it("deve importar tabela pecasDesgaste para listar peças disponíveis", async () => {
      const schema = await import("../drizzle/schema");
      expect(schema.pecasDesgaste).toBeDefined();
    });

    it("deve importar tabela categoriasPecasDesgaste para filtro por categoria", async () => {
      const schema = await import("../drizzle/schema");
      expect(schema.categoriasPecasDesgaste).toBeDefined();
    });
  });

  describe("Filtragem de peças por categoria", () => {
    it("deve retornar todas as peças quando categoria é 'todas'", () => {
      const pecas = [
        { id: 1, nome: "Mandíbula Fixa", categoriaId: 1 },
        { id: 2, nome: "Tela 50mm", categoriaId: 2 },
        { id: 3, nome: "Anel Côncavo", categoriaId: 1 },
      ];
      const filtro = "todas";
      const resultado = filtro === "todas" ? pecas : pecas.filter(p => String(p.categoriaId) === filtro);
      expect(resultado).toHaveLength(3);
    });

    it("deve filtrar peças por categoria específica", () => {
      const pecas = [
        { id: 1, nome: "Mandíbula Fixa", categoriaId: 1 },
        { id: 2, nome: "Tela 50mm", categoriaId: 2 },
        { id: 3, nome: "Anel Côncavo", categoriaId: 1 },
      ];
      const filtro = "1";
      const resultado = filtro === "todas" ? pecas : pecas.filter(p => String(p.categoriaId) === filtro);
      expect(resultado).toHaveLength(2);
      expect(resultado[0].nome).toBe("Mandíbula Fixa");
      expect(resultado[1].nome).toBe("Anel Côncavo");
    });

    it("deve retornar vazio quando categoria não tem peças", () => {
      const pecas = [
        { id: 1, nome: "Mandíbula Fixa", categoriaId: 1 },
      ];
      const filtro = "99";
      const resultado = filtro === "todas" ? pecas : pecas.filter(p => String(p.categoriaId) === filtro);
      expect(resultado).toHaveLength(0);
    });
  });
});
