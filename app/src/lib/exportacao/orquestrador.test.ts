import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

const iniciadas: number[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  // Defesa: nenhuma execução (nem neto) pode sobreviver ao teste, mesmo se a asserção falhar.
  for (const id of iniciadas.splice(0)) cancelarExportacao(id);
  const arquivoPid = path.join(tmp, "neto.pid");
  if (existsSync(arquivoPid)) {
    const pid = readFileSync(arquivoPid, "utf8").trim();
    if (process.platform === "win32") spawnSync("taskkill", ["/PID", pid, "/T", "/F"], { windowsHide: true });
    else {
      try {
        process.kill(Number(pid), "SIGKILL");
      } catch {
        // Já terminou.
      }
    }
  }
  delete process.env.FAKE_MODO;
  delete process.env.FAKE_PID_FILE;
  await new Promise((r) => setTimeout(r, 200));
  rmSync(tmp, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
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
  iniciadas.push(r.id);
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

describe("robustez do lock de execução única", () => {
  it("falha ao preparar a execução: marca erro, repropaga e não trava o lock", async () => {
    const arquivo = path.join(tmp, "eu-sou-um-arquivo");
    writeFileSync(arquivo, "x");

    expect(() => iniciarExportacao({ db, config: { ...config, exportsDir: arquivo } }, "Grupo X")).toThrow();

    const falha = obterExportacao(db, 1)!;
    expect(falha.status).toBe("erro");
    expect(falha.erroMsg).toContain("Falha ao iniciar");
    expect(falha.finalizadaEm).not.toBeNull();

    const id = iniciar("Grupo X");
    await aguardar(() => terminou(id));
    expect(obterExportacao(db, id)!.status).toBe("concluida");
  });

  it("falha ao gravar o estado final: registra o erro, limpa o registro e não gera rejeição", async () => {
    const erroLog = vi.spyOn(console, "error").mockImplementation(() => {});
    let chamadas = 0;
    // A 1ª chamada é a da criação da execução; as seguintes são as de `finalizar`.
    const agora = () => {
      if (++chamadas > 1) throw new Error("disco cheio");
      return new Date();
    };
    const r = iniciarExportacao({ db, config, agora }, "Grupo X");
    if (!r.ok) throw new Error(r.mensagem);
    iniciadas.push(r.id);

    await aguardar(() => erroLog.mock.calls.length > 0);
    expect(cancelarExportacao(r.id)).toBe(false);

    // Com outro banco, uma nova exportação roda normalmente.
    const db2 = new DatabaseSync(":memory:");
    aplicarEsquema(db2);
    const r2 = iniciarExportacao({ db: db2, config }, "Grupo Y");
    if (!r2.ok) throw new Error(r2.mensagem);
    iniciadas.push(r2.id);
    await aguardar(() => obterExportacao(db2, r2.id)!.status !== "em_andamento");
    expect(obterExportacao(db2, r2.id)!.status).toBe("concluida");
  });

  it("neto segurando os pipes, script sai com 0: conclui sem esperar o neto", async () => {
    process.env.FAKE_MODO = "neto-pipe";
    process.env.FAKE_PID_FILE = path.join(tmp, "neto.pid");
    const id = iniciar("Grupo X");
    await aguardar(() => terminou(id), 6_000);

    const e = obterExportacao(db, id)!;
    expect(e.status).toBe("concluida");
    expect(e.totalMensagens).toBe(2);
  }, 20_000);

  it("neto segurando os pipes, script sai com 1: marca erro sem esperar o neto", async () => {
    process.env.FAKE_MODO = "neto-pipe-erro";
    process.env.FAKE_PID_FILE = path.join(tmp, "neto.pid");
    const id = iniciar("Grupo X");
    await aguardar(() => terminou(id), 6_000);

    const e = obterExportacao(db, id)!;
    expect(e.status).toBe("erro");
    expect(e.erroMsg).toContain("código 1");
    expect(e.erroMsg).toContain("RuntimeError");
  }, 20_000);
});
