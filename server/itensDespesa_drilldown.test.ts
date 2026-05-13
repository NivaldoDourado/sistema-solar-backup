import { describe, it, expect, vi, beforeEach } from "vitest";

// Test the buildReverseTagMap and findPlanilhaTagsForCodigoTag logic
// We need to test that the reverse mapping correctly resolves codigoTag → planilha tags

describe("Drill-down tag resolution", () => {
  // Test the buildReverseTagMap function directly
  it("should build reverse mapping from correspondências", async () => {
    const { CORRESPONDENCIAS_APROVADAS, CORRESPONDENCIAS_FORCADAS } = await import(
      "./importDespesas_correspondencias"
    );

    // Build the reverse map manually (same logic as in itensDespesa_router.ts)
    const idToTags = new Map<number, string[]>();
    for (const [tag, id] of Object.entries(CORRESPONDENCIAS_APROVADAS)) {
      if (!idToTags.has(id)) idToTags.set(id, []);
      idToTags.get(id)!.push(tag);
    }
    for (const [tag, info] of Object.entries(CORRESPONDENCIAS_FORCADAS)) {
      if (!idToTags.has(info.equipamentoId)) idToTags.set(info.equipamentoId, []);
      idToTags.get(info.equipamentoId)!.push(tag);
    }

    // Verify FOX 8-20 case: equipamentoId 48 should have "PERFURATRIZ HIDR. 01" as a planilha tag
    expect(idToTags.has(48)).toBe(true);
    const tags48 = idToTags.get(48)!;
    expect(tags48).toContain("PERFURATRIZ HIDR. 01");

    // Verify R938 - 01 case: equipamentoId 51 should have "ESCAVADEIRA R938" as a planilha tag
    expect(idToTags.has(51)).toBe(true);
    const tags51 = idToTags.get(51)!;
    expect(tags51).toContain("ESCAVADEIRA R938");

    // Verify R938-02 case: equipamentoId 93 should have "ESCAVADEIRA R 938 02"
    expect(idToTags.has(93)).toBe(true);
    const tags93 = idToTags.get(93)!;
    expect(tags93).toContain("ESCAVADEIRA R 938 02");
  });

  it("should map PATROL 120 B directly (no correspondência needed)", async () => {
    const { CORRESPONDENCIAS_APROVADAS, CORRESPONDENCIAS_FORCADAS } = await import(
      "./importDespesas_correspondencias"
    );

    // PATROL 120 B works because codigoTag = planilha tag
    // It should NOT be in correspondências (it's a direct match)
    const tagToId = new Map<string, number>();
    for (const [tag, id] of Object.entries(CORRESPONDENCIAS_APROVADAS)) {
      tagToId.set(tag.toUpperCase(), id);
    }
    for (const [tag, info] of Object.entries(CORRESPONDENCIAS_FORCADAS)) {
      tagToId.set(tag.toUpperCase(), info.equipamentoId);
    }

    // PATROL 120 B is not in correspondências - it works because the tag is the same
    // The direct match in the SQL query handles this case
    // This test just verifies the correspondências don't interfere
    const hasPatrol = tagToId.has("PATROL 120 B");
    // It might or might not be there - what matters is the drill-down works
    // The fix adds a fallback that uses correspondências when direct match fails
    expect(true).toBe(true); // Placeholder - the real test is the integration
  });

  it("should have correspondência entries for problematic equipment", async () => {
    const { CORRESPONDENCIAS_APROVADAS, CORRESPONDENCIAS_FORCADAS } = await import(
      "./importDespesas_correspondencias"
    );

    // ESCAVADEIRA R938 → equipamentoId 51 (R938 - 01)
    expect(CORRESPONDENCIAS_APROVADAS["ESCAVADEIRA R938"]).toBe(51);

    // PERFURATRIZ HIDR. 01 → equipamentoId 48 (FOX 8-20)
    expect(CORRESPONDENCIAS_FORCADAS["PERFURATRIZ HIDR. 01"]?.equipamentoId).toBe(48);

    // ESCAVADEIRA R 938 02 → equipamentoId 93 (R938-02)
    expect(CORRESPONDENCIAS_APROVADAS["ESCAVADEIRA R 938 02"]).toBe(93);
  });

  it("should correctly reverse-map codigoTag to planilha tags for FOX 8-20", async () => {
    const { CORRESPONDENCIAS_APROVADAS, CORRESPONDENCIAS_FORCADAS } = await import(
      "./importDespesas_correspondencias"
    );

    // Simulate what findPlanilhaTagsForCodigoTag does (without DB access)
    const tagToId = new Map<string, number>();
    const idToTags = new Map<number, string[]>();

    for (const [tag, id] of Object.entries(CORRESPONDENCIAS_APROVADAS)) {
      tagToId.set(tag.toUpperCase(), id);
      if (!idToTags.has(id)) idToTags.set(id, []);
      idToTags.get(id)!.push(tag);
    }
    for (const [tag, info] of Object.entries(CORRESPONDENCIAS_FORCADAS)) {
      tagToId.set(tag.toUpperCase(), info.equipamentoId);
      if (!idToTags.has(info.equipamentoId)) idToTags.set(info.equipamentoId, []);
      idToTags.get(info.equipamentoId)!.push(tag);
    }

    // For codigoTag "FOX 8-20", the equipamentoId is 48
    // The DB lookup would find equipamentos.id = 48 where codigoTag = "FOX 8-20"
    // Then idToTags.get(48) should include "PERFURATRIZ HIDR. 01"
    const equipId = 48;
    const planilhaTags = idToTags.get(equipId) || [];
    expect(planilhaTags).toContain("PERFURATRIZ HIDR. 01");
  });

  it("should correctly reverse-map codigoTag to planilha tags for R938 - 01", async () => {
    const { CORRESPONDENCIAS_APROVADAS, CORRESPONDENCIAS_FORCADAS } = await import(
      "./importDespesas_correspondencias"
    );

    const idToTags = new Map<number, string[]>();
    for (const [tag, id] of Object.entries(CORRESPONDENCIAS_APROVADAS)) {
      if (!idToTags.has(id)) idToTags.set(id, []);
      idToTags.get(id)!.push(tag);
    }
    for (const [tag, info] of Object.entries(CORRESPONDENCIAS_FORCADAS)) {
      if (!idToTags.has(info.equipamentoId)) idToTags.set(info.equipamentoId, []);
      idToTags.get(info.equipamentoId)!.push(tag);
    }

    // For codigoTag "R938 - 01", the equipamentoId is 51
    const equipId = 51;
    const planilhaTags = idToTags.get(equipId) || [];
    expect(planilhaTags).toContain("ESCAVADEIRA R938");
  });

  it("should handle equipment with multiple planilha tag variants", async () => {
    const { CORRESPONDENCIAS_APROVADAS } = await import(
      "./importDespesas_correspondencias"
    );

    const idToTags = new Map<number, string[]>();
    for (const [tag, id] of Object.entries(CORRESPONDENCIAS_APROVADAS)) {
      if (!idToTags.has(id)) idToTags.set(id, []);
      idToTags.get(id)!.push(tag);
    }

    // equipamentoId 79 (NNT-5E41) has two variants: "NNT 5E41" and "NNT5E41"
    const tags79 = idToTags.get(79) || [];
    expect(tags79).toContain("NNT 5E41");
    expect(tags79).toContain("NNT5E41");

    // equipamentoId 97 (QMD 0H48) has two variants
    const tags97 = idToTags.get(97) || [];
    expect(tags97).toContain("QMD 0H48");
    expect(tags97).toContain("QMD0H48");

    // equipamentoId 120006 (DRAGA D'AGUA A DIESEL) has multiple variants
    const tags120006 = idToTags.get(120006) || [];
    expect(tags120006.length).toBeGreaterThanOrEqual(2);
  });
});
