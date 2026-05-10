import { describe, it, expect } from "vitest";
import { parsePlanilhaFluxo } from "./importFluxo_router";
import * as fs from "fs";
import * as path from "path";

const PLANILHA_PATH = "/home/ubuntu/upload/04ABRILFLUXOREALIZADO.xls";
const planilhaExists = fs.existsSync(PLANILHA_PATH);

describe("parsePlanilhaFluxo", () => {
  it("deve parsear a planilha de fluxo realizado corretamente", () => {
    if (!planilhaExists) return; // Skip se planilha não existe
    const buffer = fs.readFileSync(PLANILHA_PATH);
    const result = parsePlanilhaFluxo(buffer);

    expect(result.periodo).toBeTruthy();
    expect(result.contasImportar.length).toBeGreaterThan(0);
    expect(result.contasExcluir.length).toBeGreaterThan(0);
    expect(result.totalImportar).toBeGreaterThan(0);
    expect(result.totalExcluir).toBeGreaterThan(0);
  });

  it("deve identificar contas a importar com correspondências corretas", () => {
    if (!planilhaExists) return;
    const buffer = fs.readFileSync(PLANILHA_PATH);
    const result = parsePlanilhaFluxo(buffer);

    // Verificar que CONSULTORIA está mapeada
    const consultoria = result.contasImportar.find(c => c.contaPrincipalCodigo === "5537");
    expect(consultoria).toBeDefined();
    expect(consultoria!.contaSistema).toBe("Consultorias Especializadas");
    expect(consultoria!.setor).toBe("ADMINISTRAÇÃO");
    expect(consultoria!.valorTotal).toBeGreaterThan(0);
  });

  it("deve identificar DESPESAS ADMINISTRATIVAS corretamente", () => {
    if (!planilhaExists) return;
    const buffer = fs.readFileSync(PLANILHA_PATH);
    const result = parsePlanilhaFluxo(buffer);

    const despAdmin = result.contasImportar.find(c => c.contaPrincipalCodigo === "2037");
    expect(despAdmin).toBeDefined();
    expect(despAdmin!.contaSistema).toBe("Despesas Administrativas");
    expect(despAdmin!.setor).toBe("ADMINISTRAÇÃO");
    expect(despAdmin!.subcontas.length).toBeGreaterThan(5);
  });

  it("deve aplicar rateio de energia elétrica corretamente", () => {
    if (!planilhaExists) return;
    const buffer = fs.readFileSync(PLANILHA_PATH);
    const result = parsePlanilhaFluxo(buffer);

    const energia = result.contasImportar.find(c => c.contaPrincipalCodigo === "2183");
    expect(energia).toBeDefined();
    expect(energia!.contaSistema).toBe("Energia Elétrica");

    // Verificar que há subcontas com rateio
    const comRateio = energia!.subcontas.filter(s => s.isRateio);
    expect(comRateio.length).toBeGreaterThan(0);

    // Verificar que os setores de rateio estão corretos
    const setoresRateio = comRateio.map(s => s.setor);
    expect(setoresRateio).toContain("DESMONTE PRIMÁRIO");
  });

  it("deve excluir contas de receita, salários, fretes e investimentos", () => {
    if (!planilhaExists) return;
    const buffer = fs.readFileSync(PLANILHA_PATH);
    const result = parsePlanilhaFluxo(buffer);

    const codigosExcluidos = result.contasExcluir.map(c => c.codigo);
    expect(codigosExcluidos).toContain("1005"); // RECEITAS VENDAS
    expect(codigosExcluidos).toContain("2149"); // SALARIO E ENCARGOS
    expect(codigosExcluidos).toContain("2114"); // FRETES
    expect(codigosExcluidos).toContain("2196"); // INVESTIMENTOS
    expect(codigosExcluidos).toContain("2185"); // IMPOSTO
  });

  it("deve identificar COMISSÃO DE VENDAS como conta a importar", () => {
    if (!planilhaExists) return;
    const buffer = fs.readFileSync(PLANILHA_PATH);
    const result = parsePlanilhaFluxo(buffer);

    const comissao = result.contasImportar.find(c => c.contaPrincipalCodigo === "2184");
    expect(comissao).toBeDefined();
    expect(comissao!.contaSistema).toBe("Comissão de Vendas");
    expect(comissao!.setor).toBe("EXPEDIÇÃO");
  });

  it("deve identificar FROTA corretamente", () => {
    if (!planilhaExists) return;
    const buffer = fs.readFileSync(PLANILHA_PATH);
    const result = parsePlanilhaFluxo(buffer);

    const frota = result.contasImportar.find(c => c.contaPrincipalCodigo === "2160");
    expect(frota).toBeDefined();
    expect(frota!.contaSistema).toBe("Frota/Man.Pat./Seg./Out.");
    expect(frota!.setor).toBe("OUTROS SERVIÇOS");
  });

  it("deve identificar DESPESAS INDIRETAS corretamente", () => {
    if (!planilhaExists) return;
    const buffer = fs.readFileSync(PLANILHA_PATH);
    const result = parsePlanilhaFluxo(buffer);

    const indiretas = result.contasImportar.find(c => c.contaPrincipalCodigo === "3006");
    expect(indiretas).toBeDefined();
    expect(indiretas!.contaSistema).toBe("Despesas Indiretas");
    expect(indiretas!.setor).toBe("INDIRETAS");
  });

  it("deve ter totalImportar + totalExcluir coerente", () => {
    if (!planilhaExists) return;
    const buffer = fs.readFileSync(PLANILHA_PATH);
    const result = parsePlanilhaFluxo(buffer);

    // Ambos devem ser positivos
    expect(result.totalImportar).toBeGreaterThan(0);
    expect(result.totalExcluir).toBeGreaterThan(0);
    // Total excluir deve ser maior que importar (receitas são maiores que despesas)
    expect(result.totalExcluir).toBeGreaterThan(result.totalImportar);
  });
});
