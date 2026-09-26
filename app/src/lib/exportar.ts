/**
 * Geração de CSV e XLSX para as exportações do app. Funções puras: quem monta
 * a resposta HTTP são as rotas em `src/app/api/**\/exportar`.
 */

export interface ColunaExportacao<T> {
  cabecalho: string;
  valor: (linha: T) => string | number | null | undefined;
  /** Largura sugerida da coluna no XLSX (em caracteres). */
  largura?: number;
}

type Celula = string | number | null | undefined;

/** Aba já materializada: assim abas de tipos de linha diferentes cabem na mesma pasta. */
export interface AbaExportacao {
  nome: string;
  colunas: { cabecalho: string; largura?: number }[];
  linhas: Celula[][];
}

export function criarAba<T>(nome: string, linhas: T[], colunas: ColunaExportacao<T>[]): AbaExportacao {
  return {
    nome,
    colunas: colunas.map(({ cabecalho, largura }) => ({ cabecalho, largura })),
    linhas: linhas.map((linha) => colunas.map((c) => c.valor(linha))),
  };
}

/** BOM UTF-8: sem ele o Excel em pt-BR abre o CSV com os acentos quebrados. */
const BOM = "﻿";
const SEPARADOR = ";";

/**
 * Texto de mensagem é dado de terceiros: uma célula que começa com `=`, `+`, `-`
 * ou `@` (ou com tab/CR, que o Excel também trata como início de fórmula) vira
 * fórmula ao abrir o CSV. O apóstrofo inicial força texto. Só vale para string:
 * número negativo continua número.
 */
function neutralizarFormula(valor: string | number | null | undefined): string {
  if (valor === null || valor === undefined) return "";
  if (typeof valor === "number") return String(valor);
  return /^[=+\-@\t\r]/.test(valor) ? `'${valor}` : valor;
}

function escaparCampoCsv(valor: string | number | null | undefined): string {
  const texto = neutralizarFormula(valor);
  // Aspas, separador e quebra de linha exigem envolver o campo em aspas
  // (duplicando as internas), senão a linha "quebra" em colunas erradas.
  return /["\n\r;]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

export function gerarCsv<T>(linhas: T[], colunas: ColunaExportacao<T>[]): string {
  const cabecalho = colunas.map((c) => escaparCampoCsv(c.cabecalho)).join(SEPARADOR);
  const corpo = linhas.map((linha) => colunas.map((c) => escaparCampoCsv(c.valor(linha))).join(SEPARADOR));
  return BOM + [cabecalho, ...corpo].join("\r\n");
}

/**
 * Gera o XLSX. O import do exceljs é dinâmico porque a biblioteca é grande e só
 * é necessária quando alguém exporta. Texto começando com `=` é gravado como
 * string (não como fórmula), então aqui não há neutralização a fazer.
 */
export async function gerarXlsx(abas: AbaExportacao[]): Promise<Buffer> {
  const ExcelJS = (await import("exceljs")).default;
  const pasta = new ExcelJS.Workbook();
  pasta.created = new Date();

  for (const { nome, linhas, colunas } of abas) {
    const aba = pasta.addWorksheet(nome);
    aba.columns = colunas.map((c) => ({
      header: c.cabecalho,
      key: c.cabecalho,
      width: c.largura ?? Math.max(12, c.cabecalho.length + 2),
    }));
    for (const linha of linhas) aba.addRow(linha.map((v) => v ?? ""));
    aba.getRow(1).font = { bold: true };
    aba.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: colunas.length } };
    aba.views = [{ state: "frozen", ySplit: 1 }];
  }

  return Buffer.from(await pasta.xlsx.writeBuffer());
}
