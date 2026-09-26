import { existsSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// `conexao` importa `server-only`, que lança fora do bundler do Next.
vi.mock("server-only", () => ({}));

const caminhoDb = path.join(os.tmpdir(), `extrator-rota-analise-exportar-${process.pid}-${Date.now()}.db`);

let GET: (request: NextRequest) => Promise<Response>;

const TXT = [
  "Histórico do chat: Grupo | Exportação",
  "Total de mensagens: 3",
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

const pedir = (query: string) => GET(new NextRequest(`http://127.0.0.1:51794/api/analise/exportar${query}`));

describe("GET /api/analise/exportar", () => {
  it("baixa um .xlsx com o nome do grupo e da análise", async () => {
    const resposta = await pedir("?grupoId=1");
    expect(resposta.status).toBe(200);
    expect(resposta.headers.get("content-type")).toContain("spreadsheetml.sheet");
    expect(resposta.headers.get("content-disposition")).toMatch(
      /^attachment; filename="Grupo-Exportacao-analise-\d{4}-\d{2}-\d{2}\.xlsx"$/
    );
    const bytes = new Uint8Array(await resposta.arrayBuffer());
    expect([bytes[0], bytes[1]]).toEqual([0x50, 0x4b]);
  });

  it("traz as abas Por autor e Por dia, já filtradas pelo período", async () => {
    const ExcelJS = (await import("exceljs")).default;
    const resposta = await pedir("?grupoId=1&de=2026-09-08&ate=2026-09-09");
    const pasta = new ExcelJS.Workbook();
    await pasta.xlsx.load((await resposta.arrayBuffer()) as never);
    expect(pasta.worksheets.map((a) => a.name)).toEqual(["Por autor", "Por dia"]);
    const porDia = pasta.getWorksheet("Por dia")!;
    expect(porDia.rowCount).toBe(3); // cabeçalho + 08/09 + 09/09
    expect(porDia.getCell("A2").value).toBe("08/09/2026");
  });

  it("recusa grupoId inválido com 400 e grupo inexistente com 404", async () => {
    expect((await pedir("?grupoId=abc")).status).toBe(400);
    expect((await pedir("?grupoId=999")).status).toBe(404);
  });
});
