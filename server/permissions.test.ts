import { describe, expect, it } from "vitest";
import { hasPermission, hasModuleAccess, canCreate, canEdit, canDelete, canView } from "./permissions";

describe("Sistema de Permissões", () => {
  describe("Admin e Diretor - Acesso total", () => {
    it("admin pode visualizar todos os módulos", () => {
      expect(canView("admin", "equipamentos")).toBe(true);
      expect(canView("admin", "custos")).toBe(true);
      expect(canView("admin", "manutencao")).toBe(true);
    });

    it("admin pode criar, editar e excluir em todos os módulos", () => {
      expect(canCreate("admin", "equipamentos")).toBe(true);
      expect(canEdit("admin", "equipamentos")).toBe(true);
      expect(canDelete("admin", "equipamentos")).toBe(true);
    });

    it("diretor pode visualizar todos os módulos", () => {
      expect(canView("diretor", "equipamentos")).toBe(true);
      expect(canView("diretor", "custos")).toBe(true);
      expect(canView("diretor", "manutencao")).toBe(true);
    });

    it("diretor pode criar, editar e excluir em todos os módulos", () => {
      // Diretor foi alterado para ter acesso total conforme solicitação do usuário
      expect(canCreate("diretor", "equipamentos")).toBe(true);
      expect(canEdit("diretor", "equipamentos")).toBe(true);
      expect(canDelete("diretor", "equipamentos")).toBe(true);
    });
  });

  describe("Gerente - Apenas visualização", () => {
    it("gerente pode visualizar todos os módulos", () => {
      expect(canView("gerente", "equipamentos")).toBe(true);
      expect(canView("gerente", "custos")).toBe(true);
    });

    it("gerente NÃO pode criar, editar ou excluir", () => {
      expect(canCreate("gerente", "equipamentos")).toBe(false);
      expect(canEdit("gerente", "equipamentos")).toBe(false);
      expect(canDelete("gerente", "equipamentos")).toBe(false);
    });
  });

  describe("Consultoria - Acesso total", () => {
    it("consultoria tem acesso completo a todos os módulos", () => {
      expect(canView("consultoria", "equipamentos")).toBe(true);
      expect(canCreate("consultoria", "equipamentos")).toBe(true);
      expect(canEdit("consultoria", "equipamentos")).toBe(true);
      expect(canDelete("consultoria", "equipamentos")).toBe(true);
    });

    it("consultoria pode acessar custos", () => {
      expect(hasModuleAccess("consultoria", "custos")).toBe(true);
      expect(canView("consultoria", "custos")).toBe(true);
      expect(canCreate("consultoria", "custos")).toBe(true);
      expect(canEdit("consultoria", "custos")).toBe(true);
      expect(canDelete("consultoria", "custos")).toBe(true);
    });
  });

  describe("Coordenador, Usuário, Controle - Sem acesso a Custos", () => {
    it("coordenador NÃO pode acessar custos", () => {
      expect(hasModuleAccess("coordenador", "custos")).toBe(false);
      expect(canView("coordenador", "custos")).toBe(false);
    });

    it("coordenador pode criar/editar/excluir em outros módulos", () => {
      expect(canView("coordenador", "equipamentos")).toBe(true);
      expect(canCreate("coordenador", "equipamentos")).toBe(true);
      expect(canEdit("coordenador", "equipamentos")).toBe(true);
      expect(canDelete("coordenador", "equipamentos")).toBe(true);
    });

    it("usuario NÃO pode acessar custos", () => {
      expect(hasModuleAccess("usuario", "custos")).toBe(false);
    });

    it("usuario pode criar/editar/excluir em outros módulos", () => {
      expect(canCreate("usuario", "parteDiaria")).toBe(true);
      expect(canEdit("usuario", "abastecimento")).toBe(true);
      expect(canDelete("usuario", "producao")).toBe(true);
    });

    it("controle NÃO pode acessar custos", () => {
      expect(hasModuleAccess("controle", "custos")).toBe(false);
    });

    it("controle pode criar/editar/excluir em outros módulos", () => {
      expect(canCreate("controle", "equipamentos")).toBe(true);
      expect(canEdit("controle", "manutencao")).toBe(true);
      expect(canDelete("controle", "producao")).toBe(true);
    });
  });

  describe("Operador - Sem acesso a Custos e sem permissão de excluir", () => {
    it("operador NÃO pode acessar custos", () => {
      expect(hasModuleAccess("operador", "custos")).toBe(false);
    });

    it("operador pode visualizar, criar e editar outros módulos", () => {
      expect(canView("operador", "equipamentos")).toBe(true);
      expect(canCreate("operador", "parteDiaria")).toBe(true);
      expect(canEdit("operador", "abastecimento")).toBe(true);
    });

    it("operador NÃO pode excluir em nenhum módulo", () => {
      expect(canDelete("operador", "equipamentos")).toBe(false);
      expect(canDelete("operador", "parteDiaria")).toBe(false);
      expect(canDelete("operador", "abastecimento")).toBe(false);
      expect(canDelete("operador", "producao")).toBe(false);
      expect(canDelete("operador", "manutencao")).toBe(false);
    });
  });

  describe("Testes de permissões específicas", () => {
    it("hasPermission funciona corretamente", () => {
      expect(hasPermission("consultoria", "equipamentos", "create")).toBe(true);
      expect(hasPermission("diretor", "equipamentos", "create")).toBe(true); // Diretor agora tem acesso total
      expect(hasPermission("operador", "equipamentos", "delete")).toBe(false);
    });

    it("hasModuleAccess funciona corretamente", () => {
      expect(hasModuleAccess("diretor", "equipamentos")).toBe(true);
      expect(hasModuleAccess("coordenador", "custos")).toBe(false);
      expect(hasModuleAccess("consultoria", "custos")).toBe(true);
    });
  });
});
