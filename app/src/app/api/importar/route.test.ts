import { existsSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// `conexao` importa `server-only`, que lança fora do bundler do Next.
vi.mock("server-only", () => ({}));

const caminhoDb = path.join(os.tmpdir(), `extrator-rota-importar-${process.pid}-${Date.now()}.db`);
const MB = 1024 * 1024;

let POST: (request: NextRequest) => Promise<Response>;

beforeAll(async () => {
  process.env.EXTRATOR_DB = caminhoDb;
  ({ POST } = await import("./route"));
});

afterAll(() => {
  const g = globalThis as unknown as { __extratorBanco?: { close(): void } };
  g.__extratorBanco?.close();
  delete (g as { __extratorBanco?: unknown }).__extratorBanco;
  for (const sufixo of ["", "-wal", "-shm"]) {
    if (existsSync(caminhoDb + sufixo)) rmSync(caminhoDb + sufixo, { force: true });
  }
});

const TXT = [
  "Histórico do chat: Grupo Rota",
  "Exportado em: 21/09/2026 09:23",
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

function requisicao(campos: Record<string, string | File>, cabecalhos: Record<string, string> = {}) {
  const form = new FormData();
  for (const [nome, valor] of Object.entries(campos)) form.append(nome, valor);
  return new NextRequest("http://127.0.0.1:51794/api/importar", { method: "POST", body: form, headers: cabecalhos });
}

const txt = (nome: string, conteudo: string | Uint8Array) => new File([conteudo as BlobPart], nome, { type: "text/plain" });

describe("POST /api/importar", () => {
  it("responde 413 pelo Content-Length, sem ler o corpo", async () => {
    const request = requisicao({ arquivo: txt("a.txt", TXT) }, { "content-length": String(22 * MB) });
    const formData = vi.spyOn(request, "formData").mockRejectedValue(new Error("o corpo não deveria ser lido"));

    const resposta = await POST(request);

    expect(resposta.status).toBe(413);
    expect(await resposta.json()).toMatchObject({ error: { code: "ARQUIVO_GRANDE" } });
    expect(formData).not.toHaveBeenCalled();
  });

  it("responde 413 para arquivo de 20 MB + 1 byte sem Content-Length", async () => {
    const request = requisicao({ arquivo: txt("grande.txt", new Uint8Array(20 * MB + 1)) });
    expect(request.headers.get("content-length")).toBeNull();

    const resposta = await POST(request);

    expect(resposta.status).toBe(413);
    expect(await resposta.json()).toMatchObject({ error: { code: "ARQUIVO_GRANDE" } });
  });

  it("importa um .txt e é idempotente ao reenviar o mesmo arquivo", async () => {
    const primeira = await POST(requisicao({ arquivo: txt("chat.txt", TXT) }));
    expect(primeira.status).toBe(200);
    expect(await primeira.json()).toMatchObject({ grupo: "Grupo Rota", lidas: 2, novas: 2 });

    const segunda = await POST(requisicao({ arquivo: txt("chat.txt", TXT) }));
    expect(segunda.status).toBe(200);
    expect(await segunda.json()).toMatchObject({ grupo: "Grupo Rota", lidas: 2, novas: 0 });
  });

  it("recusa nome que não é .txt, campo ausente e .txt sem cabeçalho nem grupo", async () => {
    const tipo = await POST(requisicao({ arquivo: txt("chat.json", TXT) }));
    expect(tipo.status).toBe(400);
    expect(await tipo.json()).toMatchObject({ error: { code: "TIPO_INVALIDO" } });

    const sem = await POST(requisicao({ grupo: "Qualquer" }));
    expect(sem.status).toBe(400);
    expect(await sem.json()).toMatchObject({ error: { code: "SEM_ARQUIVO" } });

    const invalida = await POST(requisicao({ arquivo: txt("solto.txt", "texto sem cabeçalho nenhum\n") }));
    expect(invalida.status).toBe(400);
    expect(await invalida.json()).toMatchObject({ error: { code: "IMPORTACAO_INVALIDA" } });
  });
});
