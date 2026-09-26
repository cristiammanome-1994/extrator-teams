import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// `conexao` importa `server-only`, que lança fora do bundler do Next.
vi.mock("server-only", () => ({}));

const FAKE = path.resolve(import.meta.dirname, "..", "..", "..", "lib", "exportacao", "__fixtures__", "fake-teams.mjs");
const CONTEXTO = (id: number | string) => ({ params: Promise.resolve({ id: String(id) }) });

type Contexto = ReturnType<typeof CONTEXTO>;
let listar: () => Promise<Response>;
let iniciar: (request: NextRequest) => Promise<Response>;
let obter: (request: NextRequest, contexto: Contexto) => Promise<Response>;
let cancelar: (request: NextRequest, contexto: Contexto) => Promise<Response>;
let listarGrupos: () => Promise<Response>;

let tmp: string;
let exportsDir: string;
let arquivoPid: string;
let caminhoDb: string;
const ambiente = ["EXTRATOR_DB", "TEAMS_PYTHON", "TEAMS_SCRIPT", "FAKE_MODO", "FAKE_PID_FILE"] as const;
const ambienteOriginal = Object.fromEntries(ambiente.map((n) => [n, process.env[n]]));

type Banco = { close(): void };
const globalBanco = () => globalThis as unknown as { __extratorBanco?: Banco };

function fecharBanco() {
  globalBanco().__extratorBanco?.close();
  delete globalBanco().__extratorBanco;
  for (const sufixo of ["", "-wal", "-shm"]) {
    if (existsSync(caminhoDb + sufixo)) rmSync(caminhoDb + sufixo, { force: true });
  }
}

beforeAll(async () => {
  // O caminho do banco é lido a cada obterBanco(); cada teste aponta EXTRATOR_DB para o seu tmp.
  ({ GET: listar, POST: iniciar } = await import("./route"));
  ({ GET: obter } = await import("./[id]/route"));
  ({ POST: cancelar } = await import("./[id]/cancelar/route"));
  ({ GET: listarGrupos } = await import("../grupos/route"));
});

beforeEach(() => {
  tmp = mkdtempSync(path.join(os.tmpdir(), "extrator-api-"));
  exportsDir = path.join(tmp, "exports");
  arquivoPid = path.join(tmp, "fake.pid");
  mkdirSync(path.join(tmp, "app"));
  mkdirSync(exportsDir);
  // As rotas resolvem exports/ a partir de process.cwd(): sem isto apontariam para o exports/ real.
  vi.spyOn(process, "cwd").mockReturnValue(path.join(tmp, "app"));
  caminhoDb = path.join(tmp, "teste.db");
  process.env.EXTRATOR_DB = caminhoDb;
  process.env.TEAMS_PYTHON = process.execPath;
  process.env.TEAMS_SCRIPT = FAKE;
  process.env.FAKE_PID_FILE = arquivoPid;
  delete process.env.FAKE_MODO;
});

afterEach(async () => {
  // Defesa: nada iniciado por um teste pode sobreviver a ele, mesmo se uma asserção falhar.
  try {
    for (const e of await exportacoes()) if (e.status === "em_andamento") await cancelar(post(""), CONTEXTO(e.id));
  } catch {
    // O banco pode nem ter sido aberto neste teste.
  }
  if (existsSync(arquivoPid)) {
    const pid = readFileSync(arquivoPid, "utf8").trim();
    if (/^\d+$/.test(pid)) {
      if (process.platform === "win32") spawnSync("taskkill", ["/PID", pid, "/T", "/F"], { windowsHide: true });
      else {
        try {
          process.kill(Number(pid), "SIGKILL");
        } catch {
          // Já terminou.
        }
      }
      // O kill só pede o fim: enquanto o processo vive ele pode segurar arquivo dentro de `tmp` (no Windows, EBUSY).
      // Preventivo: a falha não foi reproduzida (25 execuções), a causa é hipótese.
      await aguardar(() => !processoVivo(Number(pid)), 5_000).catch(() => undefined);
    }
  }
  try {
    await aguardar(async () => (await exportacoes()).every((e) => e.status !== "em_andamento"), 10_000);
  } catch {
    // Já reportado pelo teste; o que importa aqui é não deixar processo para trás.
  }
  fecharBanco();
  vi.restoreAllMocks();
  await new Promise((r) => setTimeout(r, 200));
  await limparTmp(tmp);
});

afterAll(() => {
  for (const nome of ambiente) {
    const valor = ambienteOriginal[nome];
    if (valor === undefined) delete process.env[nome];
    else process.env[nome] = valor;
  }
});

function processoVivo(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    // EPERM = existe mas sem permissão para sinalizar; só ESRCH quer dizer que já não existe.
    return (e as NodeJS.ErrnoException).code === "EPERM";
  }
}

/**
 * Apaga a pasta temporária do teste, insistindo por ~5 s. Se o Windows ainda segurar algum arquivo
 * (EBUSY/EPERM), avisa e segue: sobra lixo em os.tmpdir(), mas um teste que já passou não deve
 * reprovar por causa da limpeza.
 */
async function limparTmp(pasta: string): Promise<void> {
  const fim = Date.now() + 5_000;
  for (;;) {
    try {
      rmSync(pasta, { recursive: true, force: true });
      return;
    } catch (e) {
      const codigo = (e as NodeJS.ErrnoException).code;
      if (codigo !== "EBUSY" && codigo !== "EPERM") throw e;
      if (Date.now() > fim) {
        console.warn(`Não foi possível apagar ${pasta} (${codigo}); ficou em os.tmpdir().`);
        return;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
  }
}

async function aguardar(condicao: () => boolean | Promise<boolean>, ms = 20_000): Promise<void> {
  const fim = Date.now() + ms;
  while (!(await condicao())) {
    if (Date.now() > fim) throw new Error("tempo esgotado esperando a condição do teste");
    await new Promise((r) => setTimeout(r, 50));
  }
}

interface ExportacaoJson {
  id: number;
  grupo: string;
  status: string;
  erroMsg: string | null;
}

const post = (corpo: string) =>
  new NextRequest("http://127.0.0.1:51794/api/exportacoes", {
    method: "POST",
    body: corpo || undefined,
    headers: corpo ? { "content-type": "application/json" } : {},
  });
const postGrupo = (grupo: unknown) => post(JSON.stringify({ grupo }));
const get = () => new NextRequest("http://127.0.0.1:51794/api/exportacoes");

async function exportacoes(): Promise<ExportacaoJson[]> {
  return ((await (await listar()).json()) as { exportacoes: ExportacaoJson[] }).exportacoes;
}

async function statusDe(id: number): Promise<string> {
  return ((await (await obter(get(), CONTEXTO(id))).json()) as { exportacao: ExportacaoJson }).exportacao.status;
}

async function aguardarStatus(id: number, esperado: string) {
  await aguardar(async () => (await statusDe(id)) === esperado);
  expect(await statusDe(id)).toBe(esperado);
}

async function aguardarPid() {
  await aguardar(() => existsSync(arquivoPid) && /^\d+$/.test(readFileSync(arquivoPid, "utf8").trim()), 10_000);
}

async function iniciarOk(grupo: string): Promise<number> {
  const resposta = await iniciar(postGrupo(grupo));
  expect(resposta.status).toBe(202);
  return ((await resposta.json()) as { id: number }).id;
}

describe("POST /api/exportacoes: concorrência", () => {
  it("duas requisições simultâneas: uma vence (202) e a outra recebe 409; cancelar libera a vaga", async () => {
    process.env.FAKE_MODO = "lento";

    const [a, b] = await Promise.all([iniciar(postGrupo("Grupo A")), iniciar(postGrupo("Grupo B"))]);

    expect([a.status, b.status].sort()).toEqual([202, 409]);
    const [vencedora, perdedora] = a.status === 202 ? [a, b] : [b, a];
    const { id } = (await vencedora.json()) as { id: number };
    expect(Number.isInteger(id)).toBe(true);
    expect(await perdedora.json()).toMatchObject({ error: { code: "EM_ANDAMENTO" } });
    expect(perdedora.headers.get("cache-control")).toBe("private, no-store");

    const lista = await exportacoes();
    expect(lista).toHaveLength(1);
    expect(lista.filter((e) => e.status === "em_andamento")).toHaveLength(1);

    await aguardarPid();
    const cancelamento = await cancelar(post(""), CONTEXTO(id));
    expect(cancelamento.status).toBe(200);
    expect(await cancelamento.json()).toEqual({ ok: true });
    await aguardarStatus(id, "cancelada");

    const outra = await iniciar(postGrupo("Grupo B"));
    expect(outra.status).toBe(202);
  });

  it("cancelar uma exportação que não está rodando responde ok:false", async () => {
    const resposta = await cancelar(post(""), CONTEXTO(987_654));
    expect(resposta.status).toBe(200);
    expect(await resposta.json()).toEqual({ ok: false });
  });
});

describe("POST /api/exportacoes: entrada e falhas ao iniciar", () => {
  const CONTROLE = String.fromCharCode(1);

  it.each([
    ["vazio", () => postGrupo("")],
    ["só espaços", () => postGrupo("   ")],
    ["201 caracteres", () => postGrupo("g".repeat(201))],
    ["caractere de controle", () => postGrupo(`Grupo${CONTROLE}A`)],
    ["não é texto", () => postGrupo(42)],
    ["sem o campo grupo", () => post("{}")],
    ["sem corpo", () => post("")],
    ["corpo que não é JSON", () => post("isto não é json")],
  ])("grupo inválido (%s): 400 GRUPO_INVALIDO e nenhuma linha criada", async (_nome, montar) => {
    const resposta = await iniciar(montar());

    expect(resposta.status).toBe(400);
    expect(await resposta.json()).toMatchObject({ error: { code: "GRUPO_INVALIDO" } });
    expect(resposta.headers.get("cache-control")).toBe("private, no-store");
    expect(await exportacoes()).toHaveLength(0);
  });

  it("Python ausente: 500 PYTHON_AUSENTE e nenhuma linha criada", async () => {
    process.env.TEAMS_PYTHON = path.join(tmp, "nao-existe", "python.exe");

    const resposta = await iniciar(postGrupo("Grupo A"));

    expect(resposta.status).toBe(500);
    expect(await resposta.json()).toMatchObject({ error: { code: "PYTHON_AUSENTE" } });
    expect(await exportacoes()).toHaveLength(0);
  });

  it("falha ao iniciar (exports/ é um arquivo): 500 FALHA_AO_INICIAR, a linha termina em erro e a vaga é liberada", async () => {
    rmSync(exportsDir, { recursive: true });
    writeFileSync(exportsDir, "sou um arquivo, não uma pasta");

    const resposta = await iniciar(postGrupo("Grupo A"));

    expect(resposta.status).toBe(500);
    expect(await resposta.json()).toMatchObject({ error: { code: "FALHA_AO_INICIAR" } });
    const lista = await exportacoes();
    expect(lista).toHaveLength(1);
    expect(lista[0].status).toBe("erro");
    expect(lista[0].erroMsg).toMatch(/Falha ao iniciar/);

    rmSync(exportsDir);
    mkdirSync(exportsDir);
    const id = await iniciarOk("Grupo A");
    await aguardarStatus(id, "concluida");
  });
});

describe("re-exportação pela API", () => {
  it("rodar o mesmo grupo duas vezes não duplica as mensagens", async () => {
    const totalDe = async (nome: string) =>
      ((await (await listarGrupos()).json()) as { grupos: { nome: string; total: number }[] }).grupos.find((g) => g.nome === nome)
        ?.total;

    const primeira = await iniciarOk("Grupo A");
    await aguardarStatus(primeira, "concluida");
    expect(await totalDe("Grupo A")).toBe(2);

    const segunda = await iniciarOk("Grupo A");
    expect(segunda).not.toBe(primeira);
    await aguardarStatus(segunda, "concluida");
    expect(await totalDe("Grupo A")).toBe(2);

    const lista = await exportacoes();
    expect(lista.map((e) => e.status)).toEqual(["concluida", "concluida"]);
  });
});
