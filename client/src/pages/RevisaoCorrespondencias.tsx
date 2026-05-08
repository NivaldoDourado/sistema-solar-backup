import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, XCircle, AlertTriangle, HelpCircle, Send, ChevronDown, ChevronUp } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

// Dados das correspondências encontradas pelo algoritmo
const CORRESPONDENCIAS = [
  { id: 1, tag: "944 C", desc: "ESCAVADEIRA LIEBHERR", matchNome: "ESCAVADEIRA HIDRÁULICA LIEBHERR 944C", matchId: 19, tipoMatch: "código exato", total: 117477.91 },
  { id: 2, tag: "BALANÇA", desc: "LIDER BALANÇA", matchNome: "BALANÇA INTEGRADORA PRIMÁRIO", matchId: 60001, tipoMatch: "nome contém tag", total: 1195.00 },
  { id: 3, tag: "BRITADOR CS440", desc: "BRITADOR HYDROCONE S4800", matchNome: "BRITADOR CONICO CS440", matchId: 92, tipoMatch: "palavras parciais", total: 122499.49 },
  { id: 4, tag: "BRITADOR MOVEL", desc: "METSO NW 100 (OLC 5612) CARRETA", matchNome: "BRITADOR CÔNICO MOVEL METSO NW-200", matchId: 90, tipoMatch: "palavras parciais", total: 23868.15, duvida: "É o mesmo equipamento NW-200 (ID:90)? Ou é um equipamento diferente (NW-100)?" },
  { id: 5, tag: "BRITADOR MOVEL METSO", desc: "NW200 HPS (OUY 9579) PENEIRAS/CARRETA", matchNome: "BRITADOR CÔNICO MOVEL METSO NW-200", matchId: 90, tipoMatch: "palavras parciais", total: 1043.20, duvida: "Confirma que é o mesmo NW-200 (ID:90)?" },
  { id: 6, tag: "CAMINHÃO AU5073", desc: "MERCEDEZ 2213", matchNome: "CAMINHÃO PIPA AUS-5073", matchId: 43, tipoMatch: "palavras parciais", total: 6999.14 },
  { id: 7, tag: "CAMINHÃO HZK7665", desc: "FORD CARGO 2422", matchNome: "CAMINHÃO BASCULANTE HZK-7665", matchId: 42, tipoMatch: "palavras parciais", total: 18087.21 },
  { id: 8, tag: "CAMINHÃO HZT0105", desc: "FORD CARGO 1722", matchNome: "CAMINHÃO PIPA HZT-0105", matchId: 39, tipoMatch: "palavras parciais", total: 11135.92 },
  { id: 9, tag: "CAMINHÃO NML0188", desc: "FORD CARGO TRAÇADO 2628", matchNome: "CAMINHÃO BASCULANTE NML-0188", matchId: 41, tipoMatch: "palavras parciais", total: 28953.89 },
  { id: 10, tag: "COMPRESSOR GA160", desc: "COMPRESSOR ATLAS COPCO", matchNome: "COMPRESSOR ELÉTRICO ATLAS COPCO GA160", matchId: 6, tipoMatch: "palavras parciais", total: 414.38 },
  { id: 11, tag: "ESCAVADEIRA R 938 02", desc: "ESCAVADEIRA R 938", matchNome: "ESCAVADEIRA HIDRÁULICA LIEBHERR R938 - 01", matchId: 51, tipoMatch: "palavras parciais", total: 85348.84, duvida: "Esta é a R938-02 (diferente da 01)? Deve ser cadastrada como equipamento separado?" },
  { id: 12, tag: "ESCAVADEIRA R938", desc: "ESCAVADEIRA LIEBHER R938", matchNome: "ESCAVADEIRA HIDRÁULICA LIEBHERR R938 - 01", matchId: 51, tipoMatch: "palavras parciais", total: 129506.89 },
  { id: 13, tag: "EXPLOSIVOS", desc: "DETONA", matchNome: "EXPLOSIVOS E ACESSÓRIOS", matchId: 58, tipoMatch: "nome contém tag", total: 275419.66 },
  { id: 14, tag: "H3800 01", desc: "REBRITADOR HYDROCONE - RM", matchNome: "BRITADOR HIDROCÔNICO SANDIVIK H3800 01", matchId: 8, tipoMatch: "código exato", total: 723.80 },
  { id: 15, tag: "H3800 02", desc: "REBRITADOR HYDROCONE", matchNome: "BRITADOR HIDROCÔNICO SANDIVIK H3800 02", matchId: 9, tipoMatch: "código exato", total: 8259.14 },
  { id: 16, tag: "H380003", desc: "CONE CH430", matchNome: "BRITADOR HIDROCONICO SANDIVIK H3800 03", matchId: 80, tipoMatch: "código exato", total: 8772.00 },
  { id: 17, tag: "HL 76003", desc: "HYUNDAI HL760-9", matchNome: "PÁ CARREGADEIRA HYUNDAI HL760 03", matchId: 82, tipoMatch: "nome contém tag", total: 65146.80 },
  { id: 18, tag: "HL760 7A 02", desc: "PA CARREG. HYUNDAI - MURIBECA", matchNome: "PÁ CARREGADEIRA HYUNDAI HL760 03", matchId: 82, tipoMatch: "palavras parciais", total: 31795.25, duvida: "A 'HL760 7A 02' é o mesmo equipamento que a HL760 03 (ID:82)? Ou é outra pá carregadeira?" },
  { id: 19, tag: "HP 200 (METSO)", desc: "BRITADOR CONE HP 200 (METSO)", matchNome: "BRITADOR CÔNICO MOVEL METSO NW-200", matchId: 90, tipoMatch: "palavras parciais", total: 75333.91, duvida: "O HP 200 é o mesmo que o NW-200 (ID:90)? Ou é um equipamento diferente?" },
  { id: 20, tag: "HZH3J61", desc: "M.BENZ/L 1113 PIPA", matchNome: "CAMINHÃO PIPA HZH 3961", matchId: 50, tipoMatch: "palavras parciais", total: 1531.22 },
  { id: 21, tag: "IXD6D34", desc: "MERCEDES MB ACTOS 4844", matchNome: "CAMINHÃO BASCULANTE MERC. BENS / IXD-6334", matchId: 30, tipoMatch: "palavras parciais", total: 78648.52 },
  { id: 22, tag: "IXE1F44", desc: "MERCEDEZ BENZ ACTROS 4844", matchNome: "CAMINHÃO BASCULANTE MERC. BENS / IXE-1F44", matchId: 29, tipoMatch: "código exato", total: 44889.86 },
  { id: 23, tag: "JC1200 01", desc: "BRITADOR DE MANDIBULAS", matchNome: "BRITADOR FURLAN JC1200 - 01", matchId: 3, tipoMatch: "código exato", total: 89302.94 },
  { id: 24, tag: "L 566", desc: "PA CARREGADEIRA LIEBHER", matchNome: "PÁ CARREGADEIRA LIEBHERR L566 - 01", matchId: 22, tipoMatch: "nome contém tag", total: 82547.00 },
  { id: 25, tag: "L566 02", desc: "PA CARREGADEIRA LIEBHERR", matchNome: "PÁ CARREGADEIRA LIEBHERR L566 - 02", matchId: 45, tipoMatch: "código exato", total: 112338.22 },
  { id: 26, tag: "NNT 5E41", desc: "M.BENZ/ L 1318", matchNome: "CAMINHAO NNT-5E41 (MELOZA)", matchId: 79, tipoMatch: "código exato", total: 4283.35 },
  { id: 27, tag: "NNT5E41", desc: "M.BENZ/L 1318", matchNome: "CAMINHAO NNT-5E41 (MELOZA)", matchId: 79, tipoMatch: "código exato", total: 3163.32 },
  { id: 28, tag: "NVH6212", desc: "FORD CARGO TRAÇADO 2628", matchNome: "CAMINHÃO BASCULANTE NVH-6212", matchId: 38, tipoMatch: "código exato", total: 19756.55 },
  { id: 29, tag: "NVJ7902", desc: "FORD CARGO TRAÇADO", matchNome: "CAMINHÃO BASCULANTE NVJ-7902", matchId: 37, tipoMatch: "código exato", total: 19310.13 },
  { id: 30, tag: "OER1B00", desc: "FORD CARGO", matchNome: "CAMINHÃO BASCULANTE OER1B00", matchId: 40, tipoMatch: "código exato", total: 40329.79 },
  { id: 31, tag: "OM100", desc: "BRITADOR DE IMPACTO", matchNome: "BRITADOR DE IMPACTO FURLAN VSI OM100", matchId: 10, tipoMatch: "código exato", total: 73806.95 },
  { id: 32, tag: "OUTROS", desc: "OUTROS", matchNome: "IMPOSTOS, CEFEM E OUTROS", matchId: 54, tipoMatch: "nome contém tag", total: 48817.41, duvida: "O item 'OUTROS' da planilha corresponde a 'IMPOSTOS, CEFEM E OUTROS' no sistema? Ou deve ir para outro destino?" },
  { id: 33, tag: "PC300", desc: "ESCAVADEIRA KOMATSU", matchNome: "ESCAVADEIRA HIDRÁULICA KOMATSU PC300", matchId: 20, tipoMatch: "código exato", total: 44108.99 },
  { id: 34, tag: "PENEIRA 05 OM100", desc: "PENEIRA VIBRATORIA (H02 E H03) 3,00 X 1,50", matchNome: "PENEIRA OM100 - PENEIRA 06", matchId: 78, tipoMatch: "palavras parciais", total: 1264.56, duvida: "A 'PENEIRA 05 OM100' é a mesma que 'PENEIRA OM100 - PENEIRA 06' (ID:78)? Ou deve ser cadastrada como equipamento separado (PENEIRA 05)?" },
  { id: 35, tag: "PENEIRA 06 OM100VSI", desc: "PENEIRA VIBRATORIA 4,00 X 1,50 (RM)", matchNome: "PENEIRA OM100 - PENEIRA 06", matchId: 78, tipoMatch: "palavras parciais", total: 665.06, duvida: "Confirma que esta é a PENEIRA 06 (ID:78)?" },
  { id: 36, tag: "PENEIRA NW200", desc: "PENEIRA VIBRATORIA NW-200 CBS 5X2", matchNome: "PENEIRA NW200", matchId: 91, tipoMatch: "código exato", total: 333.18 },
  { id: 37, tag: "PERFURATRIZ 01", desc: "CARRETA PERFURATRIZ PW", matchNome: "MARTELO PERFURATRIZ FOX 8-20", matchId: 75, tipoMatch: "palavras parciais", total: 28612.13, duvida: "A 'PERFURATRIZ 01' é o 'MARTELO PERFURATRIZ FOX 8-20' (ID:75)? Ou é a 'PERFURATRIZ WOLF PW5000'?" },
  { id: 38, tag: "PIPA HZH 3961", desc: "MERCEDEZ 1113", matchNome: "CAMINHÃO PIPA HZH 3961", matchId: 50, tipoMatch: "código exato", total: 321.71 },
  { id: 39, tag: "PZE8D13", desc: "MERCEDEZ BENS ACTROS 4844", matchNome: "CAMINHÃO BASCULANTE MERC. BENS / PZE 8D13", matchId: 52, tipoMatch: "código exato", total: 46204.31 },
  { id: 40, tag: "QMD 0H48", desc: "MB ATEGO 2426", matchNome: "CAMINHÃO MUCK MB ACTROS 2426", matchId: 97, tipoMatch: "código exato", total: 25629.86 },
  { id: 41, tag: "QMD0H48", desc: "MERCEDES MUCK", matchNome: "CAMINHÃO MUCK MB ACTROS 2426", matchId: 97, tipoMatch: "código exato", total: 1783.12 },
  { id: 42, tag: "QMN1F10", desc: "MERCEDES BENZ", matchNome: "CAMINHAO CAVALINHO MB 2651 QMN-1F10", matchId: 87, tipoMatch: "código exato", total: 3.30 },
  { id: 43, tag: "QMO6E54", desc: "MERCEDES", matchNome: "CAMINHAO CAVALINHO MB 2651 QMO-6E54", matchId: 86, tipoMatch: "código exato", total: 11600.00 },
  { id: 44, tag: "RRG 6B68", desc: "VAM RENAULT/MASTER MINIBUS L3", matchNome: "RRG-6B68", matchId: 94, tipoMatch: "código exato", total: 5913.02 },
  { id: 45, tag: "RRG5I15", desc: "FORD F150 LARIATC", matchNome: "RRG-6B68", matchId: 94, tipoMatch: "palavras parciais", total: 1000.01, duvida: "O 'RRG5I15' (FORD F150) foi mapeado para 'RRG-6B68' (VAN RENAULT). Isso parece incorreto. Deve ser cadastrado como equipamento separado?" },
  { id: 46, tag: "RUC4F80", desc: "MB AROCS 4851", matchNome: "CAMINHAO BASCULANTE MB/ RUC 4F80", matchId: 88, tipoMatch: "código exato", total: 64741.37 },
  { id: 47, tag: "SETOR RH", desc: "SETOR RECURSOS HUMANOS", matchNome: "OUTRAS DESPESAS DE SETORES", matchId: 59, tipoMatch: "palavras parciais", total: 9051.59, duvida: "O 'SETOR RH' deve ir para 'OUTRAS DESPESAS DE SETORES' (ID:59)? Ou deve ser lançado como 'Outras Desp. Setor → ADMINISTRAÇÃO'?" },
];

// Dados dos equipamentos sem correspondência
const SEM_CORRESPONDENCIA = [
  { id: 1, tag: "ALIMENTADOR AVS01", desc: "ALIMENTADOR AVS 4001200 (01)", setor: "EXTRAÇÃO JAZIDA", total: 30000.00, acaoSugerida: "CADASTRAR" },
  { id: 2, tag: "ALMOXARIFADO", desc: "ALMOXARIFADO", setor: "EXTRAÇÃO JAZIDA", total: 772.64, acaoSugerida: "Outras Desp. Setor → ALMOXARIFADO" },
  { id: 3, tag: "AVS 4001200", desc: "ALIMENTADOR AVS4001200 (02)", setor: "EXTRAÇÃO JAZIDA", total: 929.66, acaoSugerida: "CADASTRAR" },
  { id: 4, tag: "C100", desc: "BRITADOR METSO C100 - PRIMARIO", setor: "EXTRAÇÃO JAZIDA", total: 81603.48, acaoSugerida: "CADASTRAR" },
  { id: 5, tag: "CALHA VIBRATORIA 01", desc: "CALHA VIBRATORIA 01 (CS440)", setor: "EXTRAÇÃO JAZIDA", total: 249.88, acaoSugerida: "CADASTRAR" },
  { id: 6, tag: "CALHA VIBRATORIA 02", desc: "CALHA VIBRATORIA 02 (CS440)", setor: "EXTRAÇÃO JAZIDA", total: 266.59, acaoSugerida: "CADASTRAR" },
  { id: 7, tag: "CALHA VIBRATORIA 03", desc: "CALHA VIBRATORIA 03 (H3800-03)", setor: "EXTRAÇÃO JAZIDA", total: 166.59, acaoSugerida: "CADASTRAR" },
  { id: 8, tag: "CANTINA", desc: "CANTINA", setor: "REFEITÓRIO", total: 2318.00, acaoSugerida: "Outras Desp. Setor → REFEITÓRIO" },
  { id: 9, tag: "CARROS DIVERSOS", desc: "CARROS DIVERSOS", setor: "ADMINISTRAÇÃO", total: 1052.30, acaoSugerida: "CADASTRAR" },
  { id: 10, tag: "CD MURIBECA", desc: "CENTRO DE DESTRIBUIÇÃO DE MURIBECA", setor: "EXTRAÇÃO JAZIDA", total: 59.82, acaoSugerida: "EXCLUIR" },
  { id: 11, tag: "CD SERRA DO MACHADO", desc: "CD SERRA DO MACHADO", setor: "EXTRAÇÃO JAZIDA", total: 59.82, acaoSugerida: "EXCLUIR" },
  { id: 12, tag: "DRAGA D'ÁGUA A DIESEL", desc: "DRAGA D'ÁGUA A DIESEL", setor: "EXTRAÇÃO JAZIDA", total: 21108.77, acaoSugerida: "CADASTRAR" },
  { id: 13, tag: "DRAGA DIESEL 02", desc: "DRAGA DIESEL 02", setor: "EXTRAÇÃO JAZIDA", total: 9995.84, acaoSugerida: "CADASTRAR" },
  { id: 14, tag: "ENSACADEIRA SOLOMIN", desc: "ENSACADEIRA SOLOMIN", setor: "SOLOMIN", total: 18.49, acaoSugerida: "EXCLUIR" },
  { id: 15, tag: "FAZENDA", desc: "FAZENDA BONANZA", setor: "ADMINISTRAÇÃO", total: 268.64, acaoSugerida: "Outras Desp. Setor → OUTROS SERVIÇOS" },
  { id: 16, tag: "GEORGE MACHADO", desc: "GEORGE MACHADO", setor: "ADMINISTRAÇÃO", total: 0.00, acaoSugerida: "CADASTRAR" },
  { id: 17, tag: "HZC4975", desc: "FORD F1000", setor: "FROTA", total: 2666.10, acaoSugerida: "CADASTRAR" },
  { id: 18, tag: "HZU7750", desc: "ESCOLT", setor: "EXTRAÇÃO JAZIDA", total: 876.05, acaoSugerida: "CADASTRAR" },
  { id: 19, tag: "IAD8995", desc: "MOTO RONDA CG 150", setor: "ADMINISTRAÇÃO", total: 188.15, acaoSugerida: "CADASTRAR" },
  { id: 20, tag: "ITABLOQUE INSTALAÇÃO", desc: "ITABLOCK INSTALAÇÃO", setor: "EXTRAÇÃO JAZIDA", total: 48335.93, acaoSugerida: "CADASTRAR", duvida: "É da pedreira? Valor alto (R$ 48.335,93). Deve ser cadastrado ou excluído?" },
  { id: 21, tag: "MAQUINA MIG", desc: "MAQUINA MIG", setor: "MANUTENÇÃO", total: 181.92, acaoSugerida: "CADASTRAR" },
  { id: 22, tag: "MATERIAL DE CONSUMO", desc: "MATERIAL DE CONSUMO", setor: "EXTRAÇÃO JAZIDA", total: 443.16, acaoSugerida: "Outras Desp. Setor → ADMINISTRAÇÃO" },
  { id: 23, tag: "MATERIAL EPI", desc: "EPI", setor: "ADMINISTRAÇÃO", total: 17100.68, acaoSugerida: "Outras Desp. Setor → OUTROS SERVIÇOS" },
  { id: 24, tag: "MELOSA 01 / DIK", desc: "MELOSA 01 DIK", setor: "MANUTENÇÃO", total: 126.02, acaoSugerida: "CADASTRAR" },
  { id: 25, tag: "MELOSA 02 BRIT.NOVA", desc: "MELOSA 02 -BRIT.NOVA - HZL4229", setor: "MANUTENÇÃO", total: 17.20, acaoSugerida: "CADASTRAR" },
  { id: 26, tag: "MISTURADOR SOLO BRIT", desc: "MISTURADOR SOLO BRITA", setor: "EXTRAÇÃO JAZIDA", total: 52.00, acaoSugerida: "CADASTRAR" },
  { id: 27, tag: "MOTO 02 (2003)", desc: "MOTO 02 (2003) ROBINHO", setor: "EXTRAÇÃO JAZIDA", total: 1313.72, acaoSugerida: "CADASTRAR" },
  { id: 28, tag: "MOTOR BOMBA", desc: "MOTOR BOMBA 01 NSB 11", setor: "BRITAGEM", total: 516.66, acaoSugerida: "CADASTRAR" },
  { id: 29, tag: "MOTOR BOMBA 02", desc: "MOTOR BOMBA NSB 90 (02)", setor: "EXTRAÇÃO JAZIDA", total: 162.38, acaoSugerida: "CADASTRAR" },
  { id: 30, tag: "OBRA ALMOXARIFADO", desc: "OBRA SALA ALMOXARIFADO/REUNIAO", setor: "EXTRAÇÃO JAZIDA", total: 8167.88, acaoSugerida: "CADASTRAR", duvida: "Deve ser lançado como 'Outras Desp. Setor → ALMOXARIFADO'? Ou é investimento (não lançar)?" },
  { id: 31, tag: "OBRAS", desc: "OBRAS", setor: "ADMINISTRAÇÃO", total: 91641.26, acaoSugerida: "NÃO LANÇAR" },
  { id: 32, tag: "OFICINA", desc: "OFICINA", setor: "MANUTENÇÃO", total: 45500.10, acaoSugerida: "Outras Desp. Setor → OFICINA" },
  { id: 33, tag: "OFICINABRITAGEM", desc: "OFICINA-BRITAGEM", setor: "BRITAGEM", total: 7516.18, acaoSugerida: "Outras Desp. Setor → OFICINA" },
  { id: 34, tag: "PÁ CARREG. 966 03", desc: "PÁ CARREG. CATERPILLER 966C", setor: "EXTRAÇÃO JAZIDA", total: 13.12, acaoSugerida: "CADASTRAR" },
  { id: 35, tag: "PÁ CARREG. 966R04", desc: "CATERPILLAR 966R", setor: "CARREGAMENTO", total: 32652.67, acaoSugerida: "CADASTRAR" },
  { id: 36, tag: "PATROL 120 B", desc: "PATROL CATERPILLAR 120B", setor: "EXTRAÇÃO JAZIDA", total: 20329.36, acaoSugerida: "CADASTRAR" },
  { id: 37, tag: "PENEIRA 01 CS440", desc: "PENEIRA VIBRATORIA 3,00 X 1,50", setor: "BRITAGEM", total: 2467.02, acaoSugerida: "CADASTRAR" },
  { id: 38, tag: "PENEIRA 02 NOVA H 01", desc: "PENEIRA VIBRATORIA 6,00 X 2,40", setor: "EXTRAÇÃO JAZIDA", total: 7040.40, acaoSugerida: "CADASTRAR" },
  { id: 39, tag: "PENEIRA 03 H3800 02", desc: "PENEIRA VIBRATORIA 6,00 X 2,40", setor: "BRITAGEM", total: 9173.62, acaoSugerida: "CADASTRAR" },
  { id: 40, tag: "PENEIRA NOVA", desc: "PENEIRA NOVA 6,00 X 2,40 PEN. 07", setor: "EXTRAÇÃO JAZIDA", total: 1334.91, acaoSugerida: "CADASTRAR" },
  { id: 41, tag: "PERFURATRIZ HIDR. 01", desc: "PERFURATRIZ HIDRAULICA FOX 8-20 01", setor: "EXTRAÇÃO JAZIDA", total: 151542.30, acaoSugerida: "CADASTRAR" },
  { id: 42, tag: "PIPA ALUGADO KIB9971", desc: "MERCEDEZ", setor: "EXTRAÇÃO JAZIDA", total: 18336.42, acaoSugerida: "CADASTRAR" },
  { id: 43, tag: "PRANCHA 3 EIXOS", desc: "REBOQUE CARRIAL HZK8739", setor: "FROTA", total: 1868.64, acaoSugerida: "EXCLUIR" },
  { id: 44, tag: "QMD 4977", desc: "VOLVO FH540 (QMD4J77)", setor: "FROTA", total: 45000.00, acaoSugerida: "EXCLUIR" },
  { id: 45, tag: "QMK3A00 (RRF 4H99)", desc: "RANGER- MAX (RRF 4H99)", setor: "ADMINISTRAÇÃO", total: 620.07, acaoSugerida: "CADASTRAR" },
  { id: 46, tag: "QUADRICICLO", desc: "QUADRICICLO UTV", setor: "ADMINISTRAÇÃO", total: 11750.01, acaoSugerida: "CADASTRAR" },
  { id: 47, tag: "QUADRICICLO HONDA", desc: "QUADRICICLO HONDA", setor: "EXTRAÇÃO JAZIDA", total: 1716.89, acaoSugerida: "CADASTRAR" },
  { id: 48, tag: "RCR 9H24", desc: "FIAT STRADA", setor: "EXTRAÇÃO JAZIDA", total: 563.16, acaoSugerida: "CADASTRAR" },
  { id: 49, tag: "REDUTORAS", desc: "REDUTORAS", setor: "BRITAGEM", total: 11755.98, acaoSugerida: "CADASTRAR" },
  { id: 50, tag: "RMF 4A64", desc: "FIAT STRADA", setor: "ADMINISTRAÇÃO", total: 5747.84, acaoSugerida: "CADASTRAR" },
  { id: 51, tag: "RRE2C34", desc: "HYUNDAI/CRETA1TA PLTINUM", setor: "ADMINISTRAÇÃO", total: 668.14, acaoSugerida: "CADASTRAR" },
  { id: 52, tag: "RRG 5L15", desc: "CARRO NOEL JUNIOR", setor: "ADMINISTRAÇÃO", total: 1999.97, acaoSugerida: "CADASTRAR" },
  { id: 53, tag: "RRH 9F10", desc: "ford f150 CARRO GUGA", setor: "ADMINISTRAÇÃO", total: 7835.80, acaoSugerida: "CADASTRAR" },
  { id: 54, tag: "SHV 6A57", desc: "FIAT/STRADA ENDURANCE CS", setor: "EXTRAÇÃO JAZIDA", total: 120.00, acaoSugerida: "CADASTRAR" },
  { id: 55, tag: "SIST. DESPOEIRAMENTO", desc: "SISTEMA DESPOEIRAMENTO DA BRITAGEM", setor: "EXTRAÇÃO JAZIDA", total: 4326.81, acaoSugerida: "Outras Desp. Setor → BRITAGEM SECUNDÁRIA" },
  { id: 56, tag: "SOLOMIN OUTROS", desc: "SOLOMIN - OUTROS", setor: "SOLOMIN", total: 11051.64, acaoSugerida: "EXCLUIR" },
  { id: 57, tag: "SUBSTAÇÃO", desc: "SUBSTAÇÃO", setor: "BRITAGEM", total: 6.00, acaoSugerida: "Outras Desp. Setor → BRITAGEM SECUNDÁRIA" },
  { id: 58, tag: "TC 07 SOLOMIN", desc: "TRANSP. MOVEL- TC07 SOLOMIN", setor: "SOLOMIN", total: 187.64, acaoSugerida: "EXCLUIR" },
  { id: 59, tag: "TC01", desc: "TRANSP CORREIA TC-01 (JC1200)", setor: "BRITAGEM", total: 5988.01, acaoSugerida: "CADASTRAR" },
  { id: 60, tag: "TC01 (OM100 RM)", desc: "TRANSP CORREIA TC01 (OM-100 RM)", setor: "BRITAGEM", total: 166.59, acaoSugerida: "CADASTRAR" },
  { id: 61, tag: "TC01 MOVEL", desc: "TRANSP CORREIA TC-01 (MOVEL)", setor: "BRITAGEM", total: 455.76, acaoSugerida: "CADASTRAR" },
  { id: 62, tag: "TC02", desc: "TRANSP CORREIA TC-02 (JC1200)", setor: "EXTRAÇÃO JAZIDA", total: 13481.93, acaoSugerida: "CADASTRAR" },
  { id: 63, tag: "TC02 SOLOMIN", desc: "TRANSPORTADORA SOLOMIN", setor: "SOLOMIN", total: 205.01, acaoSugerida: "EXCLUIR" },
  { id: 64, tag: "TC03", desc: "TRANSP. CORREIA TC-03 (PEN.01- CS440)", setor: "EXTRAÇÃO JAZIDA", total: 5783.75, acaoSugerida: "CADASTRAR" },
  { id: 65, tag: "TC04", desc: "TRANSP. CORREIA TC-04 (PEN.01- CS440)", setor: "EXTRAÇÃO JAZIDA", total: 269.65, acaoSugerida: "CADASTRAR" },
  { id: 66, tag: "TC04 (H3800 01 RM)", desc: "TRANSP CORREIA TC04 (H3800 01 RM)", setor: "BRITAGEM", total: 166.59, acaoSugerida: "CADASTRAR" },
  { id: 67, tag: "TC04 SOLOMIN", desc: "TRANSPORTADORA SOLOMIN", setor: "SOLOMIN", total: 556.64, acaoSugerida: "EXCLUIR" },
  { id: 68, tag: "TC05", desc: "TRANSPORTADOR DE CORREIA TC-05", setor: "EXTRAÇÃO JAZIDA", total: 3230.77, acaoSugerida: "CADASTRAR" },
  { id: 69, tag: "TC05 (B.MOVEL)", desc: "TRANSP CORREIA (B.MOVEL)", setor: "BRITAGEM", total: 291.53, acaoSugerida: "CADASTRAR" },
  { id: 70, tag: "TC06", desc: "TRANSPORTADOR DE CORREIA TC-06", setor: "EXTRAÇÃO JAZIDA", total: 558.97, acaoSugerida: "CADASTRAR" },
  { id: 71, tag: "TC07", desc: "TRANSPORTADOR DE CORREIA TC-07", setor: "EXTRAÇÃO JAZIDA", total: 963.82, acaoSugerida: "CADASTRAR" },
  { id: 72, tag: "TC08", desc: "TRANSPORTADOR DE CORREIA TC-08", setor: "EXTRAÇÃO JAZIDA", total: 2173.30, acaoSugerida: "CADASTRAR" },
  { id: 73, tag: "TC09", desc: "TRANSPORTADOR DE CORREIA TC-09", setor: "EXTRAÇÃO JAZIDA", total: 960.82, acaoSugerida: "CADASTRAR" },
  { id: 74, tag: "TC10", desc: "TRANSPORTADOR DE CORREIA TC-10", setor: "EXTRAÇÃO JAZIDA", total: 168.33, acaoSugerida: "CADASTRAR" },
  { id: 75, tag: "TC11", desc: "TRANSPORTADOR DE CORREIA TC-11", setor: "EXTRAÇÃO JAZIDA", total: 231.14, acaoSugerida: "CADASTRAR" },
  { id: 76, tag: "TC14", desc: "TRANSPORTADOR DE CORREIA TC-14", setor: "EXTRAÇÃO JAZIDA", total: 251.48, acaoSugerida: "CADASTRAR" },
  { id: 77, tag: "TC15", desc: "TRANSPORTADOR DE CORREIA TC-15", setor: "EXTRAÇÃO JAZIDA", total: 268.00, acaoSugerida: "CADASTRAR" },
  { id: 78, tag: "TC16", desc: "TRANSPORTADOR DE CORREIA TC-16", setor: "EXTRAÇÃO JAZIDA", total: 488.12, acaoSugerida: "CADASTRAR" },
  { id: 79, tag: "TC17", desc: "TRANSPORTADOR DE CORREIA TC-17", setor: "EXTRAÇÃO JAZIDA", total: 1349.76, acaoSugerida: "CADASTRAR" },
  { id: 80, tag: "TC20", desc: "TRANSPORTADOR DE CORREIA TC-20", setor: "EXTRAÇÃO JAZIDA", total: 341.30, acaoSugerida: "CADASTRAR" },
  { id: 81, tag: "TNQ 1G00", desc: "CARRO GEO", setor: "ADMINISTRAÇÃO", total: 4391.26, acaoSugerida: "CADASTRAR" },
  { id: 82, tag: "TNV1F49", desc: "JEEP COMPASS MARGARIDA LIS", setor: "ADMINISTRAÇÃO", total: 662.29, acaoSugerida: "CADASTRAR" },
  { id: 83, tag: "TNV9J00", desc: "FIAT STRADA ENDURAN CS13", setor: "FROTA", total: 4465.67, acaoSugerida: "CADASTRAR" },
  { id: 84, tag: "TNW 2I60", desc: "RANGER GUGA", setor: "ADMINISTRAÇÃO", total: 2274.23, acaoSugerida: "CADASTRAR" },
  { id: 85, tag: "TOA1F53", desc: "FOTON SOLOMIN", setor: "SOLOMIN", total: 561.28, acaoSugerida: "EXCLUIR" },
  { id: 86, tag: "TORNEARIA", desc: "TORNEARIA", setor: "MANUTENÇÃO", total: 833.84, acaoSugerida: "CADASTRAR" },
  { id: 87, tag: "TRANSPORTADOR RM", desc: "TRANSPORTADOR CORREIA - RM", setor: "EXTRAÇÃO JAZIDA", total: 2599.48, acaoSugerida: "CADASTRAR" },
  { id: 88, tag: "TRANSPORTADORA", desc: "TRANSPORTE BRITADOR MOVEL METSO", setor: "EXTRAÇÃO JAZIDA", total: 1325721.52, acaoSugerida: "CADASTRAR", duvida: "Valor muito alto (R$ 1.325.721,52). É o transporte do britador móvel Metso? Deve ser cadastrado como equipamento separado ou é despesa de setor?" },
];

type StatusCorrespondencia = "aprovado" | "rejeitado" | "pendente";
type AcaoSemMatch = "CADASTRAR" | "EXCLUIR" | "NÃO LANÇAR" | "SETOR" | "pendente";

export default function RevisaoCorrespondencias() {
  // Estado para correspondências
  const [statusCorr, setStatusCorr] = useState<Record<number, StatusCorrespondencia>>(
    () => CORRESPONDENCIAS.reduce((acc, c) => ({ ...acc, [c.id]: "pendente" }), {} as Record<number, StatusCorrespondencia>)
  );
  const [observacoesCorr, setObservaesCorr] = useState<Record<number, string>>({});
  
  // Estado para sem correspondência
  const [acoesSemMatch, setAcoesSemMatch] = useState<Record<number, AcaoSemMatch>>(
    () => SEM_CORRESPONDENCIA.reduce((acc, s) => {
      let acao: AcaoSemMatch = "pendente";
      if (s.acaoSugerida === "EXCLUIR") acao = "EXCLUIR";
      if (s.acaoSugerida === "NÃO LANÇAR") acao = "NÃO LANÇAR";
      if (s.acaoSugerida === "CADASTRAR") acao = "CADASTRAR";
      if (s.acaoSugerida.startsWith("Outras Desp.")) acao = "SETOR";
      return { ...acc, [s.id]: acao };
    }, {} as Record<number, AcaoSemMatch>)
  );
  const [observacoesSemMatch, setObservacoesSemMatch] = useState<Record<number, string>>({});
  
  // Seções colapsáveis
  const [secaoAberta, setSecaoAberta] = useState<"correspondencias" | "sem_match" | "duvidas">("duvidas");

  // Filtros
  const [filtroCorr, setFiltroCorr] = useState<"todos" | "pendente" | "duvida">("todos");

  // Itens com dúvida
  const itensDuvida = useMemo(() => [
    ...CORRESPONDENCIAS.filter(c => c.duvida).map(c => ({ ...c, tipo: "correspondencia" as const })),
    ...SEM_CORRESPONDENCIA.filter(s => s.duvida).map(s => ({ ...s, tipo: "sem_match" as const })),
  ], []);

  // Contadores
  const totalCorr = CORRESPONDENCIAS.length;
  const aprovados = Object.values(statusCorr).filter(s => s === "aprovado").length;
  const rejeitados = Object.values(statusCorr).filter(s => s === "rejeitado").length;
  const pendentesCorr = totalCorr - aprovados - rejeitados;

  const totalSemMatch = SEM_CORRESPONDENCIA.length;
  const definidos = Object.values(acoesSemMatch).filter(a => a !== "pendente").length;

  // Salvar revisão
  const salvarRevisao = trpc.importDespesas.salvarRevisaoCorrespondencias.useMutation({
    onSuccess: () => toast.success("Revisão salva com sucesso!"),
    onError: (err: any) => toast.error(`Erro: ${err.message}`),
  });

  const handleSalvar = () => {
    const correspondenciasRevisadas = CORRESPONDENCIAS.map(c => ({
      id: c.id,
      tag: c.tag,
      matchId: c.matchId,
      matchNome: c.matchNome,
      status: statusCorr[c.id],
      observacao: observacoesCorr[c.id] || "",
    }));
    const semMatchRevisados = SEM_CORRESPONDENCIA.map(s => ({
      id: s.id,
      tag: s.tag,
      desc: s.desc,
      acao: acoesSemMatch[s.id],
      observacao: observacoesSemMatch[s.id] || "",
    }));
    salvarRevisao.mutate({ correspondencias: correspondenciasRevisadas, semMatch: semMatchRevisados });
  };

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const corrFiltradas = useMemo(() => {
    if (filtroCorr === "pendente") return CORRESPONDENCIAS.filter(c => statusCorr[c.id] === "pendente");
    if (filtroCorr === "duvida") return CORRESPONDENCIAS.filter(c => c.duvida);
    return CORRESPONDENCIAS;
  }, [filtroCorr, statusCorr]);

  return (
    <div className="space-y-6 p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Revisão de Correspondências</h1>
          <p className="text-muted-foreground">Planilha de Despesas - Abril/2026</p>
        </div>
        <Button onClick={handleSalvar} disabled={salvarRevisao.isPending} size="lg">
          <Send className="w-4 h-4 mr-2" />
          {salvarRevisao.isPending ? "Salvando..." : "Salvar Revisão"}
        </Button>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold text-green-600">{aprovados}</div>
            <div className="text-sm text-muted-foreground">Aprovados</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold text-red-600">{rejeitados}</div>
            <div className="text-sm text-muted-foreground">Rejeitados</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold text-amber-600">{pendentesCorr}</div>
            <div className="text-sm text-muted-foreground">Pendentes</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{definidos}/{totalSemMatch}</div>
            <div className="text-sm text-muted-foreground">Sem Match Definidos</div>
          </CardContent>
        </Card>
      </div>

      {/* SEÇÃO 1: DÚVIDAS PRIORITÁRIAS */}
      <Card className="border-amber-300 bg-amber-50/50">
        <CardHeader className="cursor-pointer" onClick={() => setSecaoAberta(secaoAberta === "duvidas" ? "correspondencias" : "duvidas")}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-amber-600" />
              <CardTitle className="text-lg">Dúvidas Prioritárias ({itensDuvida.length})</CardTitle>
            </div>
            {secaoAberta === "duvidas" ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </div>
          <CardDescription>Itens que precisam de sua orientação antes de prosseguir</CardDescription>
        </CardHeader>
        {secaoAberta === "duvidas" && (
          <CardContent className="space-y-4">
            {itensDuvida.map((item, idx) => (
              <div key={`duvida-${idx}`} className="border rounded-lg p-4 bg-white space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs">
                        {item.tipo === "correspondencia" ? "CORRESPONDÊNCIA" : "SEM MATCH"}
                      </Badge>
                      <span className="font-semibold">{item.tag}</span>
                      <span className="text-muted-foreground">— {item.desc}</span>
                    </div>
                    {item.tipo === "correspondencia" && "matchNome" in item && (
                      <div className="text-sm text-muted-foreground mb-2">
                        Mapeado para: <span className="font-medium text-foreground">{item.matchNome}</span> (ID:{item.matchId})
                      </div>
                    )}
                    <div className="bg-amber-100 border border-amber-200 rounded p-2 text-sm">
                      <AlertTriangle className="w-4 h-4 inline text-amber-600 mr-1" />
                      {item.duvida}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Valor: <span className="font-medium">{fmt(item.total)}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 min-w-[140px]">
                    {item.tipo === "correspondencia" ? (
                      <>
                        <Button
                          size="sm"
                          variant={statusCorr[(item as any).id] === "aprovado" ? "default" : "outline"}
                          className="w-full"
                          onClick={() => setStatusCorr(prev => ({ ...prev, [(item as any).id]: "aprovado" }))}
                        >
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Correto
                        </Button>
                        <Button
                          size="sm"
                          variant={statusCorr[(item as any).id] === "rejeitado" ? "destructive" : "outline"}
                          className="w-full"
                          onClick={() => setStatusCorr(prev => ({ ...prev, [(item as any).id]: "rejeitado" }))}
                        >
                          <XCircle className="w-3 h-3 mr-1" /> Incorreto
                        </Button>
                      </>
                    ) : (
                      <Select
                        value={acoesSemMatch[(item as any).id]}
                        onValueChange={(v) => setAcoesSemMatch(prev => ({ ...prev, [(item as any).id]: v as AcaoSemMatch }))}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CADASTRAR">Cadastrar</SelectItem>
                          <SelectItem value="EXCLUIR">Excluir</SelectItem>
                          <SelectItem value="NÃO LANÇAR">Não Lançar</SelectItem>
                          <SelectItem value="SETOR">Desp. Setor</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
                <Textarea
                  placeholder="Sua resposta / observação..."
                  value={item.tipo === "correspondencia" ? (observacoesCorr[(item as any).id] || "") : (observacoesSemMatch[(item as any).id] || "")}
                  onChange={(e) => {
                    if (item.tipo === "correspondencia") {
                      setObservaesCorr(prev => ({ ...prev, [(item as any).id]: e.target.value }));
                    } else {
                      setObservacoesSemMatch(prev => ({ ...prev, [(item as any).id]: e.target.value }));
                    }
                  }}
                  className="h-16"
                />
              </div>
            ))}
          </CardContent>
        )}
      </Card>

      {/* SEÇÃO 2: CORRESPONDÊNCIAS */}
      <Card>
        <CardHeader className="cursor-pointer" onClick={() => setSecaoAberta(secaoAberta === "correspondencias" ? "duvidas" : "correspondencias")}>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Correspondências Encontradas ({totalCorr})</CardTitle>
            {secaoAberta === "correspondencias" ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </div>
          <CardDescription>Equipamentos da planilha que foram mapeados automaticamente para o sistema</CardDescription>
        </CardHeader>
        {secaoAberta === "correspondencias" && (
          <CardContent className="space-y-3">
            {/* Filtros */}
            <div className="flex gap-2 mb-4">
              <Button size="sm" variant={filtroCorr === "todos" ? "default" : "outline"} onClick={() => setFiltroCorr("todos")}>
                Todos ({totalCorr})
              </Button>
              <Button size="sm" variant={filtroCorr === "pendente" ? "default" : "outline"} onClick={() => setFiltroCorr("pendente")}>
                Pendentes ({pendentesCorr})
              </Button>
              <Button size="sm" variant={filtroCorr === "duvida" ? "default" : "outline"} onClick={() => setFiltroCorr("duvida")}>
                Com Dúvida ({CORRESPONDENCIAS.filter(c => c.duvida).length})
              </Button>
              <div className="ml-auto flex gap-2">
                <Button size="sm" variant="outline" onClick={() => {
                  const newStatus = { ...statusCorr };
                  corrFiltradas.forEach(c => { if (newStatus[c.id] === "pendente") newStatus[c.id] = "aprovado"; });
                  setStatusCorr(newStatus);
                }}>
                  <CheckCircle2 className="w-3 h-3 mr-1" /> Aprovar Todos Pendentes
                </Button>
              </div>
            </div>

            {corrFiltradas.map(c => (
              <div key={c.id} className={`border rounded-lg p-3 flex items-center gap-3 ${
                statusCorr[c.id] === "aprovado" ? "bg-green-50 border-green-200" :
                statusCorr[c.id] === "rejeitado" ? "bg-red-50 border-red-200" : "bg-white"
              }`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-semibold text-sm">{c.tag}</span>
                    <span className="text-muted-foreground text-sm">({c.desc})</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="font-medium text-sm text-blue-700">{c.matchNome}</span>
                    <Badge variant="secondary" className="text-xs">{c.tipoMatch}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{fmt(c.total)}</div>
                  {c.duvida && (
                    <div className="text-xs text-amber-700 mt-1 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> {c.duvida}
                    </div>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button
                    size="icon"
                    variant={statusCorr[c.id] === "aprovado" ? "default" : "ghost"}
                    className="h-8 w-8"
                    onClick={() => setStatusCorr(prev => ({ ...prev, [c.id]: "aprovado" }))}
                    title="Correto"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant={statusCorr[c.id] === "rejeitado" ? "destructive" : "ghost"}
                    className="h-8 w-8"
                    onClick={() => setStatusCorr(prev => ({ ...prev, [c.id]: "rejeitado" }))}
                    title="Incorreto"
                  >
                    <XCircle className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        )}
      </Card>

      {/* SEÇÃO 3: SEM CORRESPONDÊNCIA */}
      <Card>
        <CardHeader className="cursor-pointer" onClick={() => setSecaoAberta(secaoAberta === "sem_match" ? "duvidas" : "sem_match")}>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Sem Correspondência ({totalSemMatch})</CardTitle>
            {secaoAberta === "sem_match" ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </div>
          <CardDescription>Equipamentos da planilha que não foram encontrados no sistema — defina a ação para cada um</CardDescription>
        </CardHeader>
        {secaoAberta === "sem_match" && (
          <CardContent className="space-y-3">
            {SEM_CORRESPONDENCIA.map(s => (
              <div key={s.id} className={`border rounded-lg p-3 space-y-2 ${
                acoesSemMatch[s.id] === "EXCLUIR" ? "bg-red-50 border-red-200 opacity-60" :
                acoesSemMatch[s.id] === "NÃO LANÇAR" ? "bg-gray-50 border-gray-200 opacity-60" :
                acoesSemMatch[s.id] === "SETOR" ? "bg-purple-50 border-purple-200" :
                acoesSemMatch[s.id] === "CADASTRAR" ? "bg-blue-50 border-blue-200" : "bg-white"
              }`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-semibold text-sm">{s.tag}</span>
                      <span className="text-muted-foreground text-sm">— {s.desc}</span>
                      <Badge variant="outline" className="text-xs">{s.setor}</Badge>
                      <span className="text-xs font-medium">{fmt(s.total)}</span>
                    </div>
                    {s.duvida && (
                      <div className="text-xs text-amber-700 mt-1 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> {s.duvida}
                      </div>
                    )}
                    {s.acaoSugerida.startsWith("Outras Desp.") && (
                      <div className="text-xs text-purple-700 mt-1">Sugestão: {s.acaoSugerida}</div>
                    )}
                  </div>
                  <Select
                    value={acoesSemMatch[s.id]}
                    onValueChange={(v) => setAcoesSemMatch(prev => ({ ...prev, [s.id]: v as AcaoSemMatch }))}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CADASTRAR">Cadastrar</SelectItem>
                      <SelectItem value="EXCLUIR">Excluir</SelectItem>
                      <SelectItem value="NÃO LANÇAR">Não Lançar</SelectItem>
                      <SelectItem value="SETOR">Desp. Setor</SelectItem>
                      <SelectItem value="pendente">Pendente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {(acoesSemMatch[s.id] === "CADASTRAR" || acoesSemMatch[s.id] === "SETOR" || s.duvida) && (
                  <Textarea
                    placeholder={acoesSemMatch[s.id] === "SETOR" ? "Qual setor? (ex: ADMINISTRAÇÃO, OFICINA...)" : "Observação (opcional)..."}
                    value={observacoesSemMatch[s.id] || ""}
                    onChange={(e) => setObservacoesSemMatch(prev => ({ ...prev, [s.id]: e.target.value }))}
                    className="h-12 text-sm"
                  />
                )}
              </div>
            ))}
          </CardContent>
        )}
      </Card>

      {/* Botão final */}
      <div className="flex justify-end">
        <Button onClick={handleSalvar} disabled={salvarRevisao.isPending} size="lg">
          <Send className="w-4 h-4 mr-2" />
          {salvarRevisao.isPending ? "Salvando..." : "Salvar Revisão Completa"}
        </Button>
      </div>
    </div>
  );
}
