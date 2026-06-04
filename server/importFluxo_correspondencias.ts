/**
 * Mapa de correspondências para importação da planilha "Fluxo Realizado" (DataGold)
 * 
 * Estrutura da planilha:
 * - Hierarquia por indentação (5/10/15/20 espaços)
 * - Nível 1 = Conta Principal (5 espaços)
 * - Nível 2 = Conta Agrupada (10 espaços)
 * - Nível 3 = Conta Subagrupada (15 espaços)
 * - Nível 4 = Sub-subagrupada (20 espaços)
 * - Formato: "CÓDIGO-NOME" com valor na col[1]
 */

export interface ContaFluxoConfig {
  /** Código numérico da conta (ex: "5537") */
  codigo: string;
  /** Nome da conta na planilha */
  nome: string;
  /** Conta correspondente no sistema SOLAR */
  contaSistema: string;
  /** Setor destino padrão */
  setor: string;
  /** Se tem rateio especial (ex: energia) */
  rateioEspecial?: RateioEspecial[];
}

export interface RateioEspecial {
  /** Código da subconta que tem rateio */
  codigoSubconta: string;
  /** Nome da subconta */
  nomeSubconta: string;
  /** Setor destino específico (se 100% em um setor) */
  setor?: string;
  /** Percentuais de rateio (se dividido entre setores) */
  rateio?: { setor: string; percentual: number }[];
}

/**
 * CONTAS PRINCIPAIS A IMPORTAR
 * Cada conta principal agrupa suas subcontas (nível 2/3/4) como nível analítico
 */
export const CONTAS_IMPORTAR: ContaFluxoConfig[] = [
  {
    codigo: "5537",
    nome: "CONSULTORIA",
    contaSistema: "Consultorias Especializadas",
    setor: "ADMINISTRAÇÃO",
  },
  {
    codigo: "2037",
    nome: "DESPESAS ADMINISTRATIVAS",
    contaSistema: "Despesas Administrativas",
    setor: "ADMINISTRAÇÃO",
  },
  {
    codigo: "5540",
    nome: "DESPESAS FINANCEIRAS",
    contaSistema: "Impostos, CEFEM e Outras Taxas",
    setor: "EXPEDIÇÃO",
  },
  {
    codigo: "3006",
    nome: "DESPESAS INDIRETAS",
    contaSistema: "Despesas Indiretas",
    setor: "INDIRETAS",
  },
  {
    codigo: "2183",
    nome: "ENERGIA ELÉTRICA",
    contaSistema: "Energia Elétrica",
    setor: "ADMINISTRAÇÃO", // setor padrão, mas tem rateio especial
    rateioEspecial: [
      {
        codigoSubconta: "2145",
        nomeSubconta: "ENERGIA ADM",
        setor: "ADMINISTRAÇÃO",
      },
      {
        codigoSubconta: "2303",
        nomeSubconta: "ENERGIA CASAS ENTORNO PEDREIRA",
        setor: "OUTROS SERVIÇOS",
      },
      {
        codigoSubconta: "2064",
        nomeSubconta: "ENERGIA PRODUÇÃO",
        rateio: [
          { setor: "DESMONTE PRIMÁRIO", percentual: 0.06 },
          { setor: "BRITAGEM PRIMÁRIA", percentual: 0.23 },
          { setor: "BRITAGEM SEC./TERC./QUART.", percentual: 0.71 },
        ],
      },
    ],
  },
  {
    codigo: "2160",
    nome: "FROTA",
    contaSistema: "Frota/Man.Pat./Seg./Out.",
    setor: "OUTROS SERVIÇOS",
  },
  {
    codigo: "5539",
    nome: "LICENÇAS E DOCUMENTOS AMBIENTAIS",
    contaSistema: "Despesas Administrativas",
    setor: "ADMINISTRAÇÃO",
  },
  {
    codigo: "2184",
    nome: "COMISSÃO DE VENDAS",
    contaSistema: "Comissão de Vendas",
    setor: "EXPEDIÇÃO",
  },
  {
    codigo: "2185",
    nome: "IMPOSTO",
    contaSistema: "Imp., Trib., Taxas e CEFEM",
    setor: "EXPEDIÇÃO",
  },
];

/**
 * CONTAS PRINCIPAIS A EXCLUIR (e todas suas subcontas)
 */
export const CONTAS_EXCLUIR: string[] = [
  "2114", // FRETES
  "2196", // INVESTIMENTOS/EMPRESTIMOS
  "2169", // PRODUÇÃO-BRITAGEM / MANUTENÇÃO-OFICINA (já importado pela outra planilha)
  "2149", // SALARIO E ENCARGOS PESSOAL (será lançado manualmente - Passo 2)
  "5513", // RECEITAS DIVERSAS (entrada)
  "1005", // RECEITAS VENDAS (entrada)
];

/**
 * CONTAS INDIVIDUAIS A EXCLUIR (mesmo que estejam dentro de uma conta importada)
 */
export const CONTAS_INDIVIDUAIS_EXCLUIR: string[] = [
  "2304", // PAGAMENTO EMPRESTIMO
  "2081", // GNRE (excluído por decisão da diretoria - mai/26)
];

/**
 * EXCEÇÕES: contas que estão dentro de uma conta excluída mas devem ser importadas
 * Ex: 2184-COMISSÃO DE VENDAS está dentro de 2149-SALARIO E ENCARGOS PESSOAL
 */
export const EXCECOES_IMPORTAR: ContaFluxoConfig[] = [
  {
    codigo: "2184",
    nome: "COMISSÃO DE VENDAS",
    contaSistema: "Comissão de Vendas",
    setor: "EXPEDIÇÃO",
  },
];

/**
 * Extrai código e nome de uma string no formato "CÓDIGO-NOME"
 * Exemplos: "5537-CONSULTORIA", "2005- INFORMATICA / DESP. ADM"
 */
export function extrairCodigoNome(texto: string): { codigo: string; nome: string } | null {
  const trimmed = texto.trim();
  const match = trimmed.match(/^(\d+)\s*-\s*(.+)$/);
  if (!match) return null;
  return {
    codigo: match[1],
    nome: match[2].trim(),
  };
}

/**
 * Determina o nível hierárquico pela indentação (quantidade de espaços no início)
 * - 5 espaços = nível 1 (conta principal)
 * - 10 espaços = nível 2 (agrupada)
 * - 15 espaços = nível 3 (subagrupada)
 * - 20 espaços = nível 4 (sub-subagrupada)
 * - 0 espaços = seção (ENTRADAS, SAIDAS, Total)
 */
export function detectarNivel(texto: string): number {
  const match = texto.match(/^(\s*)/);
  if (!match) return 0;
  const espacos = match[1].length;
  if (espacos >= 20) return 4;
  if (espacos >= 15) return 3;
  if (espacos >= 10) return 2;
  if (espacos >= 5) return 1;
  return 0;
}

/**
 * Verifica se uma conta (pelo código) deve ser importada
 */
export function deveImportarConta(codigo: string): ContaFluxoConfig | null {
  // Verificar se é uma exceção (dentro de conta excluída mas deve importar)
  const excecao = EXCECOES_IMPORTAR.find(c => c.codigo === codigo);
  if (excecao) return excecao;

  // Verificar se está na lista de importação
  const config = CONTAS_IMPORTAR.find(c => c.codigo === codigo);
  return config || null;
}

/**
 * Verifica se uma conta (pelo código) deve ser excluída
 */
export function deveExcluirConta(codigo: string): boolean {
  // Verificar exclusão individual
  if (CONTAS_INDIVIDUAIS_EXCLUIR.includes(codigo)) return true;
  // Verificar exclusão de grupo
  if (CONTAS_EXCLUIR.includes(codigo)) return true;
  return false;
}

/**
 * Determina o setor destino para uma subconta de energia elétrica
 */
export function getSetorEnergia(codigoSubconta: string): { setor?: string; rateio?: { setor: string; percentual: number }[] } | null {
  const energiaConfig = CONTAS_IMPORTAR.find(c => c.codigo === "2183");
  if (!energiaConfig?.rateioEspecial) return null;

  const subconta = energiaConfig.rateioEspecial.find(r => r.codigoSubconta === codigoSubconta);
  if (!subconta) return null;

  if (subconta.setor) return { setor: subconta.setor };
  if (subconta.rateio) return { rateio: subconta.rateio };
  return null;
}
