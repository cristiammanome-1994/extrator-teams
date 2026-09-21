import { existsSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// `conexao` importa `server-only`, que lança fora do bundler do Next.
vi.mock("server-only", () => ({}));

const caminhoDb = path.join(os.tmpdir(), `extrator-rota-mensagens-${process.pid}-${Date.now()}.db`);

let GET: (request: NextRequest) => Promise<Response>;

const TXT_A = [
  "Histórico do chat: Grupo A",
  "Total de mensagens: 2",
  "============================================================",
  "",
  "[segunda-feira, 7 de setembro de 2026 10:00] Ana Teste:",
  "Primeira",
  "",
  "[terça-feira, 8 de setembro de 2026 11:09] Bruno Teste:",
  "Segunda",
  "",
].join("\n");

const TXT_B = [
  "Histórico do chat: Grupo B",
  "Total de mensagens: 3",
  "============================================================",
  "",
  "[segunda-feira, 7 de setembro de 2026 10:00] Carla Teste:",
  "Um",
  "",
  "[segunda-feira, 7 de setembro de 2026 10:05] Carla Teste:",
  "Dois",
  "",
  "[segunda-feira, 7 de setembro de 2026 10:10] Carla Teste:",
  "Tres",
  "",
].join("\n");

beforeAll(async () => {
  process.env.EXTRATOR_DB = caminhoDb;
  const { obterBanco } = await import("@/lib/db/conexao");
  const { importarTxt } = await import("@/lib/importacao");
  importarTxt(obterBanco(), TXT_A);
  importarTxt(obterBanco(), TXT_B);
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

const pedir = (query: string) => GET(new NextRequest(`http://127.0.0.1:51794/api/mensagens${query}`));

describe("GET /api/mensagens", () => {
  it("devolve o grupoId pedido e mantém o formato anterior", async () => {
    const resposta = await pedir("?grupoId=1");
    expect(resposta.status).toBe(200);
    const json = await resposta.json();
    expect(json.grupoId).toBe(1);
    expect(Object.keys(json).sort()).toEqual(["autores", "grupoId", "itens", "pagina", "porPagina", "total"]);
    expect(json.total).toBe(2);
    expect(json.itens).toHaveLength(2);
    expect(json.pagina).toBe(1);
    expect(json.porPagina).toBe(50);
    expect(json.autores).toEqual(["Ana Teste", "Bruno Teste"]);
  });

  it("devolve o id do segundo grupo para o segundo grupoId", async () => {
    const json = await (await pedir("?grupoId=2")).json();
    expect(json.grupoId).toBe(2);
    expect(json.total).toBe(3);
    expect(json.autores).toEqual(["Carla Teste"]);
  });

  it("recusa grupoId ausente ou inválido com 400 PARAMETRO_INVALIDO", async () => {
    for (const query of ["", "?grupoId=abc", "?grupoId=-1", "?grupoId=1e3"]) {
      const resposta = await pedir(query);
      expect(resposta.status).toBe(400);
      expect(await resposta.json()).toMatchObject({ error: { code: "PARAMETRO_INVALIDO" } });
    }
  });
});
