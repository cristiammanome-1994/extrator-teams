import { describe, expect, it } from "vitest";
import { criarAba, gerarCsv, gerarXlsx, type ColunaExportacao } from "./exportar";
import { nomeArquivoExportacao } from "./nomeArquivo";

interface Linha {
  autor: string;
  texto: string | null;
  n?: number;
}

const colunas: ColunaExportacao<Linha>[] = [
  { cabecalho: "Autor", valor: (l) => l.autor },
  { cabecalho: "Mensagem", valor: (l) => l.texto },
  { cabecalho: "N", valor: (l) => l.n },
];

describe("gerarCsv", () => {
  it("começa com BOM, usa ; e CRLF", () => {
    const csv = gerarCsv([{ autor: "Ana", texto: "Oi", n: 1 }], colunas);
    expect(csv).toBe("﻿Autor;Mensagem;N\r\nAna;Oi;1");
  });

  it("envolve em aspas campo com ;, aspas ou quebra de linha", () => {
    const csv = gerarCsv([{ autor: "Ana", texto: 'diz "oi"; tchau\nfim' }], colunas);
    expect(csv).toContain('Ana;"diz ""oi""; tchau\nfim";');
  });

  it("deixa nulo e indefinido como campo vazio", () => {
    expect(gerarCsv([{ autor: "Ana", texto: null }], colunas)).toContain("\r\nAna;;");
  });

  it("neutraliza texto que o Excel leria como fórmula", () => {
    for (const perigoso of ["=1+1", "+1", "-1", "@SOMA(A1)", "\t=1", "\r=1"]) {
      const csv = gerarCsv([{ autor: "Ana", texto: perigoso }], colunas);
      const campo = csv.split("\r\n").slice(1).join("\r\n").split(";")[1];
      expect(campo.replace(/^"/, "")).toMatch(/^'/);
    }
  });

  it("não mexe em número negativo nem em texto comum", () => {
    const csv = gerarCsv([{ autor: "Ana", texto: "olá - tudo bem", n: -3 }], colunas);
    expect(csv.endsWith("Ana;olá - tudo bem;-3")).toBe(true);
  });
});

describe("nomeArquivoExportacao", () => {
  const dia = new Date(2026, 8, 26);

  it("tira acento, símbolo e separador de caminho", () => {
    expect(nomeArquivoExportacao("Grupo | Exportação", "csv", dia)).toBe("Grupo-Exportacao-2026-09-26.csv");
    expect(nomeArquivoExportacao("Ação/../etc\\passwd", "xlsx", dia)).toBe("Acao-etc-passwd-2026-09-26.xlsx");
  });

  it("não deixa aspas nem quebra de linha passarem (vão para um cabeçalho HTTP)", () => {
    expect(nomeArquivoExportacao('a"b\r\nc', "csv", dia)).toBe("a-b-c-2026-09-26.csv");
  });

  it("usa um nome padrão quando nada sobra e limita o tamanho", () => {
    expect(nomeArquivoExportacao("|||", "csv", dia)).toBe("exportacao-2026-09-26.csv");
    expect(nomeArquivoExportacao("x".repeat(500), "csv", dia).length).toBeLessThan(100);
  });
});

describe("gerarXlsx", () => {
  it("gera abas com cabeçalho e guarda '=' como texto, não como fórmula", async () => {
    const buffer = await gerarXlsx([
      criarAba("Mensagens", [{ autor: "Ana", texto: "=1+1", n: 2 }], colunas),
      criarAba("Outra", [], colunas),
    ]);
    const ExcelJS = (await import("exceljs")).default;
    const pasta = new ExcelJS.Workbook();
    await pasta.xlsx.load(buffer as never);

    expect(pasta.worksheets.map((a) => a.name)).toEqual(["Mensagens", "Outra"]);
    const aba = pasta.getWorksheet("Mensagens")!;
    expect(aba.getRow(1).values).toEqual([undefined, "Autor", "Mensagem", "N"]);
    const celula = aba.getCell("B2");
    expect(celula.type).toBe(ExcelJS.ValueType.String);
    expect(celula.value).toBe("=1+1");
  });
});
