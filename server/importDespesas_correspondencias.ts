/**
 * Mapa de correspondências validadas pelo usuário na revisão de Maio/2026.
 * 
 * Este arquivo contém as regras definitivas de mapeamento entre tags da planilha
 * e equipamentos/destinos no sistema.
 */

// ===== CORRESPONDÊNCIAS APROVADAS (tag planilha → equipamentoId no sistema) =====
export const CORRESPONDENCIAS_APROVADAS: Record<string, number> = {
  "944 C": 19,                    // ESCAVADEIRA LIEBHERR 944C
  "BRITADOR CS440": 92,           // BRITADOR CONICO CS440
  "CAMINHÃO AU5073": 43,          // CAMINHÃO PIPA AUS-5073
  "CAMINHÃO HZK7665": 42,        // CAMINHÃO BASCULANTE HZK-7665
  "CAMINHÃO HZT0105": 39,        // CAMINHÃO PIPA HZT-0105
  "CAMINHÃO NML0188": 41,        // CAMINHÃO BASCULANTE NML-0188
  "COMPRESSOR GA160": 6,          // COMPRESSOR ELÉTRICO ATLAS COPCO GA160
  "ESCAVADEIRA R938": 51,         // ESCAVADEIRA HIDRÁULICA LIEBHERR R938 - 01
  "EXPLOSIVOS": 58,               // EXPLOSIVOS E ACESSÓRIOS
  "H3800 01": 8,                  // BRITADOR HIDROCÔNICO SANDIVIK H3800 01
  "H3800 02": 9,                  // BRITADOR HIDROCÔNICO SANDIVIK H3800 02
  "H380003": 80,                  // BRITADOR HIDROCONICO SANDIVIK H3800 03
  "HL 76003": 82,                 // PÁ CARREGADEIRA HYUNDAI HL760 03
  "HP 200 (METSO)": 90,          // BRITADOR CÔNICO MOVEL METSO NW-200
  "HZH3J61": 50,                  // CAMINHÃO PIPA HZH 3961
  "IXD6D34": 30,                  // CAMINHÃO BASCULANTE MERC. BENS / IXD-6334
  "IXE1F44": 29,                  // CAMINHÃO BASCULANTE MERC. BENS / IXE-1F44
  "JC1200 01": 3,                 // BRITADOR FURLAN JC1200 - 01
  "L 566": 22,                    // PÁ CARREGADEIRA LIEBHERR L566 - 01
  "L566 02": 45,                  // PÁ CARREGADEIRA LIEBHERR L566 - 02
  "NNT 5E41": 79,                 // CAMINHAO NNT-5E41 (MELOZA)
  "NNT5E41": 79,                  // CAMINHAO NNT-5E41 (MELOZA)
  "NVH6212": 38,                  // CAMINHÃO BASCULANTE NVH-6212
  "NVJ7902": 37,                  // CAMINHÃO BASCULANTE NVJ-7902
  "OER1B00": 40,                  // CAMINHÃO BASCULANTE OER1B00
  "OM100": 10,                    // BRITADOR DE IMPACTO FURLAN VSI OM100
  "PC300": 20,                    // ESCAVADEIRA HIDRÁULICA KOMATSU PC300
  "PENEIRA 06 OM100VSI": 78,     // PENEIRA OM100 - PENEIRA 06
  "PENEIRA NW200": 91,            // PENEIRA NW200
  "PIPA HZH 3961": 50,           // CAMINHÃO PIPA HZH 3961
  "PZE8D13": 52,                  // CAMINHÃO BASCULANTE MERC. BENS / PZE 8D13
  "QMD 0H48": 97,                 // CAMINHÃO MUCK MB ACTROS 2426
  "QMD0H48": 97,                  // CAMINHÃO MUCK MB ACTROS 2426
  "QMN1F10": 87,                  // CAMINHAO CAVALINHO MB 2651 QMN-1F10
  "QMO6E54": 86,                  // CAMINHAO CAVALINHO MB 2651 QMO-6E54
  "RRG 6B68": 94,                 // RRG-6B68 (VAN RENAULT)
  "RUC4F80": 88,                  // CAMINHAO BASCULANTE MB/ RUC 4F80
  // Corrigidas na revisão:
  "ESCAVADEIRA R 938 02": 93,     // ESCAVADEIRA HIDRÁULICA LIEBHERR R938 - 02
  "PERFURATRIZ 01": 90001,        // PERFURATRIZ WOLF PW5000 - 01
  // Adicionadas na resolução de tags sem correspondência (Maio/2026):
  "BRITADOR MOVEL METSO": 120060, // BRITADOR MOVEL METSO NW200 HPS (OUY 9579)
  "BRITADOR MOVEL": 120059,       // BRITADOR MOVEL METSO NW 100 (OLC 5612)
  "DRAGA D´ÁGUA A DIESEL": 120006, // DRAGA D'AGUA A DIESEL
  "DRAGA D'ÁGUA A DIESEL": 120006, // DRAGA D'AGUA A DIESEL (variante)
  "HP 200 ( METSO)": 90,          // BRITADOR CÔNICO MOVEL METSO NW-200 (com espaço extra)
  "PÁ CARREG. 966 03": 120017,    // PA CARREGADEIRA CATERPILLER 966C - 03
  "PÁ CARREG. 966R04": 120018,    // PA CARREGADEIRA CATERPILLAR 966R - 04
  "QMK3A00 (RRF 4H99)": 120025,   // RANGER MAX (QMK3A00 / RRF 4H99)
  "TC01 (OM100 RM)": 120036,      // TRANSP CORREIA TC01 (OM-100 RM)
  "TC05 (B.MOVEL)": 120042,       // TRANSP CORREIA TC-05 (B.MOVEL)
};

// ===== CORRESPONDÊNCIAS REJEITADAS - AÇÕES ESPECIAIS =====

// Tags que devem ser mapeadas para equipamentos NOVOS (cadastrados na revisão)
// O matching automático vai encontrar pelo codigoTag
export const TAGS_NOVOS_EQUIPAMENTOS: string[] = [
  // "BRITADOR MOVEL" e "BRITADOR MOVEL METSO" movidos para CORRESPONDENCIAS_APROVADAS
  "RRG5I15",              // → FORD F150 LARIAT RRG5I15 (novo)
  "PENEIRA 05 OM100",     // → PENEIRA 05 OM100 (novo) - mas NÃO LANÇAR despesa
];

// ===== TAGS QUE NÃO DEVEM TER DESPESAS LANÇADAS =====
export const TAGS_NAO_LANCAR: string[] = [
  "HL760 7A 02",          // CD Muribeca - não faz parte do custo
  "PENEIRA 05 OM100",     // Cadastrar equipamento mas não lançar despesa
  "GEORGE MACHADO",       // Não lançar
  // "OBRAS" removido - agora é Outras Desp. Setor / OUTROS SERVIÇOS
  "TC04 (H3800 01 RM)",   // Não lançar
  "TRANSPORTADOR RM",     // Não lançar
];

// ===== TAGS QUE DEVEM SER LANÇADAS COMO "OUTRAS DESPESAS DE SETOR" =====
export const TAGS_OUTRAS_DESP_SETOR: Record<string, string> = {
  "OUTROS": "OUTROS SERVIÇOS",
  "SETOR RH": "ADMINISTRAÇÃO",
  "ALMOXARIFADO": "ALMOXARIFADO",
  "CANTINA": "REFEITÓRIO",
  "CARROS DIVERSOS": "OUTROS SERVIÇOS",
  "FAZENDA": "OUTROS SERVIÇOS",
  "MATERIAL DE CONSUMO": "ADMINISTRAÇÃO",
  "MATERIAL EPI": "OUTROS SERVIÇOS",
  "OBRA ALMOXARIFADO": "ALMOXARIFADO",
  "OBRAS": "OUTROS SERVIÇOS",
  "OFICINA": "OFICINA",
  "OFICINABRITAGEM": "BRITAGEM SECUNDÁRIA",
  "SIST. DESPOEIRAMENTO": "BRITAGEM SECUNDÁRIA",
  "SUBSTAÇÃO": "BRITAGEM SECUNDÁRIA",
  "TORNEARIA": "OUTROS SERVIÇOS",
};

// ===== TAGS A EXCLUIR (não importar, não lançar) =====
export const TAGS_EXCLUIR: string[] = [
  "CD MURIBECA", "CD SERRA DO MACHADO", "ENSACADEIRA SOLOMIN",
  "ITABLOQUE INSTALAÇÃO", "MISTURADOR SOLO BRIT",
  "QMD 4977", "SOLOMIN OUTROS", "TC 07 SOLOMIN", "TC02 SOLOMIN",
  "TC04 SOLOMIN", "TOA1F53",
];

// ===== MAPEAMENTO ESPECIAL: tag → correspondência com equipamento existente =====
// Para tags que o matching automático erra
export const CORRESPONDENCIAS_FORCADAS: Record<string, { equipamentoId: number; motivo: string }> = {
  "ALIMENTADOR AVS01": { equipamentoId: 84, motivo: "ALIMENTADOR VIBRATORIO AV400 120 (já existente)" },
  "PERFURATRIZ HIDR. 01": { equipamentoId: 48, motivo: "PERFURATRIZ HIDRAULICA WOLF FOX8-20 (já existente)" },
  "PRANCHA 3 EIXOS": { equipamentoId: 120064, motivo: "PRANCHA 3 EIXOS REBOQUE CARRIAL HZK8739 (cadastrado)" },
  "BALANÇA": { equipamentoId: 120067, motivo: "LIDER BALANÇA (cadastrado - não confundir com Balança Integradora)" },
};

// ===== NOTA SOBRE TRANSPORTADORA =====
// O valor correto da TRANSPORTADORA é R$ 596,89 (não R$ 1.325.721,52 que era o total geral errado)
export const VALOR_CORRECAO_TRANSPORTADORA = 596.89;
