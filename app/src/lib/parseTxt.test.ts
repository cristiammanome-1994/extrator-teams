import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseTxt } from "./parseTxt";

const CABECALHO = [
  "Histórico do chat: Grupo de Teste",
  "Exportado em: 21/09/2026 09:23",
  "Total de mensagens: 3",
  "============================================================",
  "",
].join("\n");

const CORPO = [
  "[segunda-feira, 7 de setembro de 2026 10:00] Ana Teste:",
  "Primeira mensagem",
  "",
  "[terça-feira, 8 de setembro de 2026 11:09] Bruno Teste:",
  "Linha um",
  "",
  "Linha três depois de uma linha em branco",
  "",
  "[terça-feira, 8 de setembro de 2026 11:10] Ana Teste:",
  "Termina com reação. 1 Curtir reação.",
  "",
].join("\n");

describe("parseTxt", () => {
  it("lê cabeçalho e mensagens", () => {
    const r = parseTxt(CABECALHO + "\n" + CORPO);
    expect(r.grupo).toBe("Grupo de Teste");
    expect(r.totalDeclarado).toBe(3);
    expect(r.mensagens).toHaveLength(3);
    expect(r.mensagens[0]).toEqual({
      autor: "Ana Teste",
      dataHoraOriginal: "segunda-feira, 7 de setembro de 2026 10:00",
      texto: "Primeira mensagem",
    });
  });

  it("preserva linhas em branco dentro de uma mensagem", () => {
    const r = parseTxt(CABECALHO + "\n" + CORPO);
    expect(r.mensagens[1].texto).toBe("Linha um\n\nLinha três depois de uma linha em branco");
  });

  it("aceita CRLF (o Python no Windows grava assim) e BOM", () => {
    const crlf = "\uFEFF" + (CABECALHO + "\n" + CORPO).replace(/\n/g, "\r\n");
    const r = parseTxt(crlf);
    expect(r.grupo).toBe("Grupo de Teste");
    expect(r.mensagens).toHaveLength(3);
    expect(r.mensagens[1].texto).toBe("Linha um\n\nLinha três depois de uma linha em branco");
  });

  it("sem cabeçalho de arquivo, devolve grupo nulo", () => {
    const r = parseTxt(CORPO);
    expect(r.grupo).toBeNull();
    expect(r.totalDeclarado).toBeNull();
    expect(r.mensagens).toHaveLength(3);
  });

  it("texto sem nenhuma mensagem devolve lista vazia", () => {
    expect(parseTxt("qualquer coisa\noutra linha").mensagens).toEqual([]);
  });
});

// Validação com dado real: só roda se existir um export do CAPAG em ../exports
// (a pasta é ignorada pelo git — o conteúdo nunca vai para o repositório).
const pastaExports = path.resolve(process.cwd(), "..", "exports");
const arquivoReal = existsSync(pastaExports)
  ? readdirSync(pastaExports).find((n) => n.startsWith("Projetos_CAPAG") && n.endsWith(".txt"))
  : undefined;

describe.skipIf(!arquivoReal)("parseTxt com o export real do CAPAG", () => {
  it("lê exatamente o total declarado no cabeçalho", () => {
    const r = parseTxt(readFileSync(path.join(pastaExports, arquivoReal!), "utf8"));
    expect(r.totalDeclarado).not.toBeNull();
    expect(r.mensagens.length).toBe(r.totalDeclarado);
  });
});
