import { existsSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// `conexao` importa `server-only`, que lança fora do bundler do Next.
vi.mock("server-only", () => ({}));

const caminhoDb = path.join(os.tmpdir(), `extrator-rota-exportar-${process.pid}-${Date.now()}.db`);

let GET: (request: NextRequest) => Promise<Response>;

const TXT = [
  "Histórico do chat: Grupo | Exportação",
  "Total de mensagens: 5",
  "============================================================",
  "",
  "[segunda-feira, 7 de setembro de 2026 10:00] Ana Teste:",
  "=HYPERLINK(\"http://x\")",
  "",
  "[terça-feira, 8 de setembro de 2026 11:09] Bruno Teste:",
  "Segunda; com ponto e vírgula",
  "",
  "[quarta-feira, 9 de setembro de 2026 08:30] Ana Teste:",
  "Terceira",
  "",
  "[quarta-feira, 9 de setembro de 2026 09:00] Maria Aparecida da Silva Santos de Oliveira Pereira Costa:",
  "Autora de nome comprido",
  "",
  "[quarta-feira, 9 de setembro de 2026 09:30] Carlos Teste:",
  "Mensagem de teste com um texto bem comprido para verificar se a busca corta corretamente no nome do arquivo",
  "",
].join("\n");

beforeAll(async () => {
  process.env.EXTRATOR_DB = caminhoDb;
  const { obterBanco } = await import("@/lib/db/conexao");
  const { importarTxt } = await import("@/lib/importacao");
  importarTxt(obterBanco(), TXT);
  ({ GET } = await import("./route"));
});

afterAll(() => {
  const g = globalThis as unknown as { __extratorBanco?: { close(): void } };
  g.__extratorBanco?.close();
  delete (g as { __extratorBanco?: unknown }).__extratorBanco;
  for (const sufixo of ["", "-wal", "-shm"]) {
    if (existsSync(caminhoDb + sufixo)) rmSync(caminhoDb + sufixo, { force: true });
  }
});

const pedir = (query: string) => GET(new NextRequest(`http://127.0.0.1:51794/api/mensagens/exportar${query}`));

describe("GET /api/mensagens/exportar", () => {
  it("baixa a conversa inteira em CSV, sem paginar, com o nome do grupo higienizado", async () => {
    const resposta = await pedir("?grupoId=1&formato=csv");
    expect(resposta.status).toBe(200);
    expect(resposta.headers.get("content-type")).toContain("text/csv");
    expect(resposta.headers.get("content-disposition")).toMatch(
      /^attachment; filename="Grupo-Exportacao-\d{4}-\d{2}-\d{2}\.csv"$/
    );
    expect(resposta.headers.get("cache-control")).toBe("private, no-store");
    expect(resposta.headers.get("x-content-type-options")).toBe("nosniff");

    // `Response.text()` descarta o BOM, então os bytes iniciais são conferidos à parte (EF BB BF).
    const bytes = new Uint8Array(await resposta.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const linhas = new TextDecoder().decode(bytes.slice(3)).split("\r\n");
    expect(linhas[0]).toBe("Data e hora;Autor;Mensagem");
    expect(linhas).toHaveLength(6);
    expect(linhas[1]).toBe("07/09/2026 10:00;Ana Teste;\"'=HYPERLINK(\"\"http://x\"\")\"");
    expect(linhas[2]).toBe('08/09/2026 11:09;Bruno Teste;"Segunda; com ponto e vírgula"');
  });

  it("respeita os filtros da tela (autor e período)", async () => {
    const porAutor = (await (await pedir("?grupoId=1&formato=csv&autor=Ana%20Teste")).text()).split("\r\n");
    expect(porAutor).toHaveLength(3);
    const porPeriodo = (await (await pedir("?grupoId=1&formato=csv&de=2026-09-08&ate=2026-09-08")).text()).split(
      "\r\n"
    );
    expect(porPeriodo).toHaveLength(2);
    expect(porPeriodo[1]).toContain("Bruno Teste");
  });

  it("gera um .xlsx de verdade (zip) com o tipo certo", async () => {
    const resposta = await pedir("?grupoId=1&formato=xlsx");
    expect(resposta.status).toBe(200);
    expect(resposta.headers.get("content-type")).toContain("spreadsheetml.sheet");
    expect(resposta.headers.get("content-disposition")).toMatch(/\.xlsx"$/);
    const bytes = new Uint8Array(await resposta.arrayBuffer());
    expect([bytes[0], bytes[1]]).toEqual([0x50, 0x4b]); // "PK"
  });

  it("recusa formato ausente ou desconhecido e grupoId inválido com 400", async () => {
    for (const query of ["?grupoId=1", "?grupoId=1&formato=pdf", "?formato=csv", "?grupoId=abc&formato=csv"]) {
      const resposta = await pedir(query);
      expect(resposta.status).toBe(400);
      expect(await resposta.json()).toMatchObject({ error: { code: "PARAMETRO_INVALIDO" } });
    }
  });

  it("devolve 404 para grupo que não existe", async () => {
    const resposta = await pedir("?grupoId=999&formato=csv");
    expect(resposta.status).toBe(404);
    expect(await resposta.json()).toMatchObject({ error: { code: "NAO_ENCONTRADO" } });
  });

  it("escreve o recorte (autor, período e busca) no nome do arquivo", async () => {
    const resposta = await pedir("?grupoId=1&formato=csv&autor=Ana%20Teste&de=2026-09-07&ate=2026-09-09&q=http");
    expect(resposta.status).toBe(200);
    expect(resposta.headers.get("content-disposition")).toMatch(
      /^attachment; filename="Grupo-Exportacao-autor-Ana-Teste-de-07-09-2026-ate-09-09-2026-busca-http-\d{4}-\d{2}-\d{2}\.csv"$/
    );
  });

  it("autor comprido não faz o período sumir do nome do arquivo", async () => {
    const autor = encodeURIComponent("Maria Aparecida da Silva Santos de Oliveira Pereira Costa");
    const resposta = await pedir(`?grupoId=1&formato=csv&autor=${autor}&de=2026-09-07&ate=2026-09-09`);
    expect(resposta.status).toBe(200);
    expect(resposta.headers.get("content-disposition")).toMatch(/-de-07-09-2026-ate-09-09-2026-\d{4}-\d{2}-\d{2}\.csv"$/);
  });

  it("busca comprida não faz o período sumir do nome do arquivo", async () => {
    const busca = "Mensagem de teste com um texto bem comprido";
    const resposta = await pedir(`?grupoId=1&formato=csv&q=${encodeURIComponent(busca)}&de=2026-09-07&ate=2026-09-09`);
    expect(resposta.status).toBe(200);
    expect(resposta.headers.get("content-disposition")).toContain("-de-07-09-2026-ate-09-09-2026-");
  });

  it.each([
    ["período sem mensagens", "?grupoId=1&formato=csv&de=2027-01-01&ate=2027-01-31"],
    ["autor inexistente", "?grupoId=1&formato=xlsx&autor=Ninguem"],
  ])("recusa o recorte vazio (%s) com 404 SEM_MENSAGENS, sem gerar arquivo", async (_nome, query) => {
    const resposta = await pedir(query);
    expect(resposta.status).toBe(404);
    expect(await resposta.json()).toMatchObject({ error: { code: "SEM_MENSAGENS" } });
  });
});
