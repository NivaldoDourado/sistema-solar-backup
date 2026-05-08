import { describe, it, expect } from "vitest";
import {
  CORRESPONDENCIAS_APROVADAS,
  TAGS_NAO_LANCAR,
  TAGS_OUTRAS_DESP_SETOR,
  TAGS_EXCLUIR,
  CORRESPONDENCIAS_FORCADAS,
  VALOR_CORRECAO_TRANSPORTADORA,
} from "./importDespesas_correspondencias";

describe("importDespesas_correspondencias", () => {
  it("deve ter correspondências aprovadas com IDs válidos", () => {
    expect(Object.keys(CORRESPONDENCIAS_APROVADAS).length).toBeGreaterThan(30);
    // Verificar que todos os valores são números positivos
    Object.values(CORRESPONDENCIAS_APROVADAS).forEach(id => {
      expect(id).toBeGreaterThan(0);
    });
  });

  it("deve ter correspondências corrigidas na revisão", () => {
    // R938-02 deve apontar para ID 93
    expect(CORRESPONDENCIAS_APROVADAS["ESCAVADEIRA R 938 02"]).toBe(93);
    // PERFURATRIZ 01 deve apontar para PW5000-01 (ID 90001)
    expect(CORRESPONDENCIAS_APROVADAS["PERFURATRIZ 01"]).toBe(90001);
  });

  it("deve ter correspondências forçadas para equipamentos existentes", () => {
    expect(CORRESPONDENCIAS_FORCADAS["ALIMENTADOR AVS01"]).toBeDefined();
    expect(CORRESPONDENCIAS_FORCADAS["ALIMENTADOR AVS01"].equipamentoId).toBe(84);
    expect(CORRESPONDENCIAS_FORCADAS["PERFURATRIZ HIDR. 01"]).toBeDefined();
    expect(CORRESPONDENCIAS_FORCADAS["PERFURATRIZ HIDR. 01"].equipamentoId).toBe(48);
  });

  it("deve ter tags para não lançar", () => {
    expect(TAGS_NAO_LANCAR).toContain("HL760 7A 02");
    expect(TAGS_NAO_LANCAR).toContain("PENEIRA 05 OM100");
    expect(TAGS_NAO_LANCAR).toContain("OBRAS");
  });

  it("deve ter tags para lançar como Outras Desp. Setor", () => {
    expect(TAGS_OUTRAS_DESP_SETOR["OUTROS"]).toBe("OUTROS SERVIÇOS");
    expect(TAGS_OUTRAS_DESP_SETOR["SETOR RH"]).toBe("ADMINISTRAÇÃO");
    expect(TAGS_OUTRAS_DESP_SETOR["OFICINA"]).toBe("OFICINA");
    expect(TAGS_OUTRAS_DESP_SETOR["CANTINA"]).toBe("REFEITÓRIO");
  });

  it("deve ter tags para excluir", () => {
    expect(TAGS_EXCLUIR).toContain("CD MURIBECA");
    expect(TAGS_EXCLUIR).toContain("SOLOMIN OUTROS");
    expect(TAGS_EXCLUIR).toContain("BALANÇA");
    expect(TAGS_EXCLUIR.length).toBeGreaterThanOrEqual(13);
  });

  it("deve ter valor de correção da TRANSPORTADORA", () => {
    expect(VALOR_CORRECAO_TRANSPORTADORA).toBe(596.89);
  });

  it("NNT 5E41 e NNT5E41 devem apontar para o mesmo equipamento", () => {
    expect(CORRESPONDENCIAS_APROVADAS["NNT 5E41"]).toBe(79);
    expect(CORRESPONDENCIAS_APROVADAS["NNT5E41"]).toBe(79);
  });

  it("QMD 0H48 e QMD0H48 devem apontar para o mesmo equipamento", () => {
    expect(CORRESPONDENCIAS_APROVADAS["QMD 0H48"]).toBe(97);
    expect(CORRESPONDENCIAS_APROVADAS["QMD0H48"]).toBe(97);
  });
});
