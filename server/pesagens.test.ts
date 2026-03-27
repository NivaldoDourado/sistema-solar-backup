import { describe, it, expect } from "vitest";

/**
 * Testa a lógica de busca de capacidade vigente por data.
 * A função getCapacidadeVigente busca a pesagem com dataVigencia <= data informada (mais recente).
 */

// Simula a lógica de getCapacidadeVigente
function extractDateStr(d: unknown): string {
  if (d instanceof Date) return d.toISOString().split('T')[0];
  const s = String(d);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (s.includes('T')) return s.split('T')[0];
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
  return s;
}

type Pesagem = {
  id: number;
  equipamentoId: number;
  capacidade: string;
  dataVigencia: string;
};

function getCapacidadeVigenteMock(
  pesagens: Pesagem[],
  equipamentoId: number,
  data: string,
  capacidadeFallback: number
): number {
  // Filtrar pesagens do equipamento e ordenar por data decrescente
  const pesagensEquip = pesagens
    .filter(p => p.equipamentoId === equipamentoId)
    .sort((a, b) => b.dataVigencia.localeCompare(a.dataVigencia));

  // Encontrar a pesagem vigente na data
  const vigente = pesagensEquip.find(p => {
    const dv = extractDateStr(p.dataVigencia);
    return dv <= data;
  });

  if (vigente) {
    return parseFloat(vigente.capacidade) || 0;
  }

  return capacidadeFallback;
}

describe("Histórico de Pesagens - Capacidade Vigente", () => {
  const pesagens: Pesagem[] = [
    { id: 1, equipamentoId: 10, capacidade: "44.09", dataVigencia: "2026-02-01" },
    { id: 2, equipamentoId: 10, capacidade: "42.25", dataVigencia: "2026-02-16" },
    { id: 3, equipamentoId: 20, capacidade: "30.00", dataVigencia: "2026-01-01" },
    { id: 4, equipamentoId: 20, capacidade: "32.50", dataVigencia: "2026-02-10" },
  ];

  it("deve retornar a capacidade vigente na data correta (período 01/02 a 15/02)", () => {
    // Em 10/02/2026, a capacidade vigente do equipamento 10 é 44.09 (vigente desde 01/02)
    const cap = getCapacidadeVigenteMock(pesagens, 10, "2026-02-10", 0);
    expect(cap).toBe(44.09);
  });

  it("deve retornar a capacidade vigente na data correta (período 16/02 em diante)", () => {
    // Em 20/02/2026, a capacidade vigente do equipamento 10 é 42.25 (vigente desde 16/02)
    const cap = getCapacidadeVigenteMock(pesagens, 10, "2026-02-20", 0);
    expect(cap).toBe(42.25);
  });

  it("deve retornar a capacidade exata na data de vigência", () => {
    // Em 16/02/2026, a capacidade vigente do equipamento 10 é 42.25 (vigente desde 16/02)
    const cap = getCapacidadeVigenteMock(pesagens, 10, "2026-02-16", 0);
    expect(cap).toBe(42.25);
  });

  it("deve retornar a capacidade exata no último dia antes da mudança", () => {
    // Em 15/02/2026, a capacidade vigente do equipamento 10 ainda é 44.09
    const cap = getCapacidadeVigenteMock(pesagens, 10, "2026-02-15", 0);
    expect(cap).toBe(44.09);
  });

  it("deve retornar fallback quando não há pesagem antes da data", () => {
    // Em 01/01/2026, não há pesagem vigente para equipamento 10 (primeira pesagem é 01/02)
    const cap = getCapacidadeVigenteMock(pesagens, 10, "2026-01-15", 50);
    expect(cap).toBe(50);
  });

  it("deve retornar fallback quando não há pesagens para o equipamento", () => {
    // Equipamento 99 não tem pesagens
    const cap = getCapacidadeVigenteMock(pesagens, 99, "2026-02-10", 25);
    expect(cap).toBe(25);
  });

  it("deve funcionar corretamente com outro equipamento", () => {
    // Equipamento 20: em 05/02, vigente é 30.00 (desde 01/01)
    const cap1 = getCapacidadeVigenteMock(pesagens, 20, "2026-02-05", 0);
    expect(cap1).toBe(30);

    // Equipamento 20: em 15/02, vigente é 32.50 (desde 10/02)
    const cap2 = getCapacidadeVigenteMock(pesagens, 20, "2026-02-15", 0);
    expect(cap2).toBe(32.5);
  });

  it("deve calcular produção corretamente com capacidades diferentes por período", () => {
    // Cenário do usuário: caminhão RUC-4F80 (equipamento 10)
    // 01/02 a 15/02: 100 viagens × 44.09 = 4409 toneladas
    // 16/02 a 28/02: 80 viagens × 42.25 = 3380 toneladas

    const viagensPeriodo1 = 100;
    const capPeriodo1 = getCapacidadeVigenteMock(pesagens, 10, "2026-02-10", 0);
    const producaoPeriodo1 = viagensPeriodo1 * capPeriodo1;
    expect(producaoPeriodo1).toBe(4409);

    const viagensPeriodo2 = 80;
    const capPeriodo2 = getCapacidadeVigenteMock(pesagens, 10, "2026-02-20", 0);
    const producaoPeriodo2 = viagensPeriodo2 * capPeriodo2;
    expect(producaoPeriodo2).toBe(3380);

    // Total correto: 4409 + 3380 = 7789
    expect(producaoPeriodo1 + producaoPeriodo2).toBe(7789);

    // Se usasse apenas a capacidade atual (42.25), o total seria errado:
    const producaoErrada = (viagensPeriodo1 + viagensPeriodo2) * 42.25;
    expect(producaoErrada).toBe(7605); // 180 × 42.25 = 7605 (ERRADO!)
    expect(producaoErrada).not.toBe(7789);
  });

  it("deve lidar com data exatamente na vigência", () => {
    // Em 01/02/2026 (exatamente na data de vigência), deve retornar 44.09
    const cap = getCapacidadeVigenteMock(pesagens, 10, "2026-02-01", 0);
    expect(cap).toBe(44.09);
  });
});
