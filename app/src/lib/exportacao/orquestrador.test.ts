import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { aplicarEsquema } from "@/lib/db/migracoes";
import { consultarMensagens, listarGrupos, obterExportacao } from "@/lib/db/repositorio";
import type { ConfigExportacao } from "./config";
import { cancelarExportacao, iniciarExportacao } from "./orquestrador";

const FAKE = path.resolve(import.meta.dirname, "__fixtures__", "fake-teams.mjs");

let db: DatabaseSync;
let tmp: string;
let config: ConfigExportacao;

beforeEach(() => {
  db = new DatabaseSync(":memory:");
  aplicarEsquema(db);
  tmp = mkdtempSync(path.join(tmpdir(), "extrator-"));
  config = { python: process.execPath, script: FAKE, cwd: tmp, exportsDir: tmp, timeoutMs: 20_000 };
});

afterEach(() => {
  delete process.env.FAKE_MODO;
  rmSync(tmp, { recursive: true, force: true });
});

async function aguardar(condicao: () => boolean, ms = 15_000): Promise<void> {
  const fim = Date.now() + ms;
  while (!condicao()) {
    if (Date.now() > fim) throw new Error("tempo esgotado esperando a condição do teste");
    await new Promise((r) => setTimeout(r, 50));
  }
}

const terminou = (id: number) => obterExportacao(db, id)!.status !== "em_andamento";

function iniciar(grupo: unknown) {
  const r = iniciarExportacao({ db, config }, grupo);
  if (!r.ok) throw new Error(`não iniciou: ${r.mensagem}`);
  return r.id;
}

describe("iniciarExportacao", () => {
  it("sucesso: acompanha o progresso e importa as mensagens", async () => {
    const id = iniciar("Grupo X");
    await aguardar(() => terminou(id));

    const e = obterExportacao(db, id)!;
    expect(e).toMatchObject({
      status: "concluida",
      etapa: "salvando",
      grupo: "Grupo X",
      grupoAberto: "Grupo XAna, Bruno, +2",
      contador: 2,
      totalMensagens: 2,
      arquivoTxt: "C:\\fake\\arquivo.txt",
      erroMsg: null,
    });
    expect(e.finalizadaEm).not.toBeNull();
    expect(e.logTail).toContain("Pronto! Arquivo salvo em");

    const grupo = listarGrupos(db).find((g) => g.nome === "Grupo X")!;
    expect(consultarMensagens(db, { grupoId: grupo.id }, 1, 50).itens.map((m) => m.texto)).toEqual([
      "Primeira",
      "Segunda",
    ]);
  });

  it("erro do script: status erro com código e última linha", async () => {
    process.env.FAKE_MODO = "erro";
    const id = iniciar("Grupo X");
    await aguardar(() => terminou(id));

    const e = obterExportacao(db, id)!;
    expect(e.status).toBe("erro");
    expect(e.erroMsg).toContain("código 1");
    expect(e.erroMsg).toContain("RuntimeError");
    expect(e.logTail).toContain("RuntimeError");
    expect(listarGrupos(db).find((g) => g.nome === "Grupo X")!.total).toBe(0);
  });

  it("recusa a segunda exportação enquanto a primeira roda (EM_ANDAMENTO)", async () => {
    process.env.FAKE_MODO = "lento";
    const id = iniciar("Grupo A");
    const segunda = iniciarExportacao({ db, config }, "Grupo B");
    expect(segunda).toMatchObject({ ok: false, codigo: "EM_ANDAMENTO" });

    cancelarExportacao(id);
    await aguardar(() => terminou(id));
  }, 20_000);

  it("cancelar encerra o processo e marca cancelada, sem importar nada", async () => {
    process.env.FAKE_MODO = "lento";
    const id = iniciar("Grupo A");
    await aguardar(() => obterExportacao(db, id)!.etapa === "lendo_historico");

    expect(cancelarExportacao(id)).toBe(true);
    await aguardar(() => terminou(id));

    expect(obterExportacao(db, id)!.status).toBe("cancelada");
    expect(listarGrupos(db).find((g) => g.nome === "Grupo A")!.total).toBe(0);
    expect(cancelarExportacao(id)).toBe(false);
  }, 20_000);

  it("estourar o tempo limite encerra e marca erro", async () => {
    process.env.FAKE_MODO = "lento";
    config = { ...config, timeoutMs: 800 };
    const id = iniciar("Grupo A");
    await aguardar(() => terminou(id));

    const e = obterExportacao(db, id)!;
    expect(e.status).toBe("erro");
    expect(e.erroMsg).toMatch(/Tempo esgotado/);
  }, 20_000);

  it("Python ou script ausente: PYTHON_AUSENTE, sem criar execução", () => {
    const r = iniciarExportacao({ db, config: { ...config, python: path.join(tmp, "nao-existe.exe") } }, "G");
    expect(r).toMatchObject({ ok: false, codigo: "PYTHON_AUSENTE" });
    expect(obterExportacao(db, 1)).toBeNull();
  });

  it("nome de grupo inválido: GRUPO_INVALIDO", () => {
    expect(iniciarExportacao({ db, config }, "")).toMatchObject({ ok: false, codigo: "GRUPO_INVALIDO" });
    expect(iniciarExportacao({ db, config }, "a\nb")).toMatchObject({ ok: false, codigo: "GRUPO_INVALIDO" });
  });
});
