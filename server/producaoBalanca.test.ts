import { describe, it, expect } from 'vitest';

/**
 * Testa a lógica de cálculo da Produção Balança e a verificação
 * de grupos de equipamentos (britadores e transportadoras de correia).
 */

// Simula a lógica de verificação de grupo isBritadorTransportadora
function isBritadorTransportadora(nomeGrupo: string): boolean {
  if (!nomeGrupo) return false;
  const nome = nomeGrupo.toUpperCase();
  return (
    (nome.includes("BRITADOR") && (nome.includes("MANDÍBULA") || nome.includes("MANDIBULA") || nome.includes("CÔNICO") || nome.includes("CONICO") || nome.includes("IMPACTO"))) ||
    (nome.includes("TRANSPORTADORA") && nome.includes("CORREIA"))
  );
}

// Simula a lógica de cálculo de Produção Balança
function calcularProducaoBalanca(leituraInicial: string, leituraFinal: string): string | null {
  const inicial = leituraInicial ? parseFloat(leituraInicial) : 0;
  const final_ = leituraFinal ? parseFloat(leituraFinal) : 0;
  if (final_ > 0 && inicial >= 0) {
    return (final_ - inicial).toString();
  }
  return null;
}

describe('Verificação de grupo isBritadorTransportadora', () => {
  it('deve retornar true para BRITADORES MANDÍBULA', () => {
    expect(isBritadorTransportadora('BRITADORES MANDÍBULA')).toBe(true);
  });

  it('deve retornar true para BRITADORES CÔNICOS', () => {
    expect(isBritadorTransportadora('BRITADORES CÔNICOS')).toBe(true);
  });

  it('deve retornar true para BRITADORES IMPACTO', () => {
    expect(isBritadorTransportadora('BRITADORES IMPACTO')).toBe(true);
  });

  it('deve retornar true para TRANSPORTADORAS DE CORREIA', () => {
    expect(isBritadorTransportadora('TRANSPORTADORAS DE CORREIA')).toBe(true);
  });

  it('deve retornar false para CAMINHÕES ENTREGA', () => {
    expect(isBritadorTransportadora('CAMINHÕES ENTREGA')).toBe(false);
  });

  it('deve retornar false para PERFURATRIZES HIDRÁULICAS', () => {
    expect(isBritadorTransportadora('PERFURATRIZES HIDRÁULICAS')).toBe(false);
  });

  it('deve retornar false para ESCAVADEIRAS', () => {
    expect(isBritadorTransportadora('ESCAVADEIRAS')).toBe(false);
  });

  it('deve retornar false para string vazia', () => {
    expect(isBritadorTransportadora('')).toBe(false);
  });

  it('deve funcionar com variações de acentuação (MANDIBULA sem acento)', () => {
    expect(isBritadorTransportadora('BRITADORES MANDIBULA')).toBe(true);
  });

  it('deve funcionar com variações de acentuação (CONICO sem acento)', () => {
    expect(isBritadorTransportadora('BRITADORES CONICO')).toBe(true);
  });
});

describe('Cálculo de Produção Balança', () => {
  it('deve calcular corretamente a diferença entre leituras', () => {
    expect(calcularProducaoBalanca('1000', '1500')).toBe('500');
  });

  it('deve calcular com valores decimais', () => {
    expect(calcularProducaoBalanca('1234.50', '1567.75')).toBe('333.25');
  });

  it('deve funcionar quando leitura inicial é zero', () => {
    expect(calcularProducaoBalanca('0', '500')).toBe('500');
  });

  it('deve retornar null quando leitura final é zero', () => {
    expect(calcularProducaoBalanca('100', '0')).toBeNull();
  });

  it('deve retornar null quando ambas as leituras são vazias', () => {
    expect(calcularProducaoBalanca('', '')).toBeNull();
  });

  it('deve calcular valores grandes corretamente', () => {
    expect(calcularProducaoBalanca('50000', '75000')).toBe('25000');
  });

  it('deve lidar com leitura final menor que inicial (resultado negativo)', () => {
    // Quando a leitura final é menor que a inicial, o cálculo retorna negativo
    // mas o sistema ainda calcula (pode ser reset de balança)
    const resultado = calcularProducaoBalanca('1500', '1000');
    expect(resultado).toBe('-500');
  });
});
