import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { NextRequest } from "next/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// `conexao` importa `server-only`, que lança fora do bundler do Next.
vi.mock("server-only", () => ({}));

let tmp: string;
let exportsDir: string;
let fora: string;
let DELETE: (request: NextRequest, contexto: { params: Promise<{ id: string }> }) => Promise<Response>;
let obterBanco: typeof import("@/lib/db/conexao").obterBanco;
let repositorio: typeof import("@/lib/db/repositorio");
let caminhoDb: string;

beforeAll(async () => {
  caminhoDb = path.join(os.tmpdir(), `extrator-rota-exportacao-id-${process.pid}-${Date.now()}.db`);
  process.env.EXTRATOR_DB = caminhoDb;
  ({ obterBanco } = await import("@/lib/db/conexao"));
  repositorio = await import("@/lib/db/repositorio");
  ({ DELETE } = await import("./route"));
});

afterAll(() => {
  const g = globalThis as unknown as { __extratorBanco?: { close(): void } };
  g.__extratorBanco?.close();
  delete (g as { __extratorBanco?: unknown }).__extratorBanco;
  for (const sufixo of ["", "-wal", "-shm"]) {
    if (existsSync(caminhoDb + sufixo)) rmSync(caminhoDb + sufixo, { force: true });
  }
});

beforeEach(() => {
  tmp = mkdtempSync(path.join(os.tmpdir(), "extrator-excluir-"));
  exportsDir = path.join(tmp, "exports");
  fora = path.join(tmp, "fora");
  mkdirSync(path.join(tmp, "app"), { recursive: true });
  mkdirSync(exportsDir);
  mkdirSync(fora);
  // As rotas resolvem a pasta de exportações a partir de process.cwd(): sem isto, apontariam para o
  // exports/ real do projeto.
  vi.spyOn(process, "cwd").mockReturnValue(path.join(tmp, "app"));
});

afterEach(() => {
  vi.restoreAllMocks();
  rmSync(tmp, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});

/** Cria uma exportação concluída com os arquivos e mensagens dados (só uma pode estar em andamento por vez). */
function criarExportacaoConcluida(opts: { arquivoTxt?: string | null; arquivoJson?: string | null } = {}): number {
  const db = obterBanco();
  const id = repositorio.tentarCriarExportacao(db, "Grupo Excluir", new Date().toISOString());
  if (id === null) throw new Error("já havia uma exportação em andamento");
  repositorio.atualizarExportacao(db, id, {
    status: "concluida",
    arquivoTxt: opts.arquivoTxt ?? null,
    arquivoJson: opts.arquivoJson ?? null,
  });
  const grupoId = repositorio.obterOuCriarGrupo(db, "Grupo Excluir");
  repositorio.inserirMensagens(db, grupoId, id, [
    { autor: "Ana", dataHora: "2026-09-21T10:00", dataHoraOriginal: "orig", texto: "mensagem desta execução" },
  ]);
  return id;
}

async function excluir(id: number | string) {
  const resposta = await DELETE(null as unknown as NextRequest, { params: Promise.resolve({ id: String(id) }) });
  return { resposta, corpo: await resposta.json() };
}

describe("DELETE /api/exportacoes/[id]", () => {
  it("apaga a linha, as mensagens dela e o .txt/.json em exports/", async () => {
    const arquivoTxt = path.join(exportsDir, "a.txt");
    const arquivoJson = path.join(exportsDir, "a.json");
    writeFileSync(arquivoTxt, "conteudo");
    writeFileSync(arquivoJson, "{}");
    const id = criarExportacaoConcluida({ arquivoTxt, arquivoJson });

    const { resposta, corpo } = await excluir(id);

    expect(resposta.status).toBe(200);
    expect(corpo).toEqual({ ok: true, mensagensRemovidas: 1 });
    expect(repositorio.obterExportacao(obterBanco(), id)).toBeNull();
    expect(existsSync(arquivoTxt)).toBe(false);
    expect(existsSync(arquivoJson)).toBe(false);
  });

  it("é bem-sucedida mesmo quando os arquivos já não existem", async () => {
    const id = criarExportacaoConcluida({ arquivoTxt: path.join(exportsDir, "sumiu.txt") });
    const { resposta, corpo } = await excluir(id);
    expect(resposta.status).toBe(200);
    expect(corpo).toEqual({ ok: true, mensagensRemovidas: 1 });
  });

  it("nunca apaga um arquivo fora de exports/, mesmo com um registro adulterado", async () => {
    const segredo = path.join(fora, "segredo.txt");
    writeFileSync(segredo, "nao apague");
    const id = criarExportacaoConcluida({ arquivoTxt: segredo });

    const { resposta, corpo } = await excluir(id);

    expect(resposta.status).toBe(200);
    expect(corpo).toEqual({ ok: true, mensagensRemovidas: 1 });
    expect(existsSync(segredo)).toBe(true);
  });

  it("uma junction dentro de exports/ apontando para fora não apaga o alvo", async () => {
    const alvo = path.join(fora, "alvo.txt");
    writeFileSync(alvo, "nao apague");
    const link = path.join(exportsDir, "atalho");
    symlinkSync(fora, link, "junction");
    const id = criarExportacaoConcluida({ arquivoTxt: path.join(link, "alvo.txt") });

    const { resposta } = await excluir(id);

    expect(resposta.status).toBe(200);
    expect(existsSync(alvo)).toBe(true);
  });

  it("recusa uma execução em andamento com 409, sem apagar nada", async () => {
    const db = obterBanco();
    const id = repositorio.tentarCriarExportacao(db, "Grupo Em Andamento", new Date().toISOString())!;
    try {
      const { resposta, corpo } = await excluir(id);
      expect(resposta.status).toBe(409);
      expect(corpo).toMatchObject({ error: { code: "EM_ANDAMENTO" } });
      expect(repositorio.obterExportacao(db, id)).not.toBeNull();
    } finally {
      // Libera o lock de "uma exportação por vez" para os próximos testes deste arquivo.
      repositorio.atualizarExportacao(db, id, { status: "cancelada" });
    }
  });

  it("id que não existe dá 404", async () => {
    const { resposta, corpo } = await excluir(999_999);
    expect(resposta.status).toBe(404);
    expect(corpo).toMatchObject({ error: { code: "NAO_ENCONTRADA" } });
  });

  it.each(["abc", "1.5", "-1"])("%j dá 400 ID_INVALIDO", async (id) => {
    const { resposta, corpo } = await excluir(id);
    expect(resposta.status).toBe(400);
    expect(corpo).toMatchObject({ error: { code: "ID_INVALIDO" } });
  });

  it("a resposta nunca é cacheável", async () => {
    const { resposta } = await excluir(criarExportacaoConcluida());
    expect(resposta.headers.get("cache-control")).toBe("private, no-store");
  });
});
