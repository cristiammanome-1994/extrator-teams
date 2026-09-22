import { ChildProcess, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { aplicarEsquema } from "@/lib/db/migracoes";
import { obterExportacao } from "@/lib/db/repositorio";
import type { ConfigExportacao } from "./config";
import { cancelarExportacao, iniciarExportacao } from "./orquestrador";

// Simula o `taskkill`/`kill` falhando (pid não encontrado, taskkill ausente): o orquestrador
// precisa cair no `child.kill("SIGKILL")`.
vi.mock("./encerrarArvore", () => ({ encerrarArvore: vi.fn(() => false) }));

const FAKE = path.resolve(import.meta.dirname, "__fixtures__", "fake-teams.mjs");

let db: DatabaseSync;
let tmp: string;
let config: ConfigExportacao;
const iniciadas: number[] = [];

beforeEach(() => {
  db = new DatabaseSync(":memory:");
  aplicarEsquema(db);
  tmp = mkdtempSync(path.join(tmpdir(), "extrator-"));
  config = { python: process.execPath, script: FAKE, cwd: tmp, exportsDir: tmp, timeoutMs: 20_000 };
  process.env.FAKE_MODO = "lento";
  process.env.FAKE_PID_FILE = path.join(tmp, "neto.pid");
});

afterEach(async () => {
  // Como `encerrarArvore` está simulado, quem sobrar precisa ser morto aqui.
  const arquivoPid = path.join(tmp, "neto.pid");
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
    }
  }
  iniciadas.splice(0);
  delete process.env.FAKE_MODO;
  delete process.env.FAKE_PID_FILE;
  await new Promise((r) => setTimeout(r, 200));
  rmSync(tmp, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});

async function aguardar(condicao: () => boolean, ms = 8_000): Promise<void> {
  const fim = Date.now() + ms;
  while (!condicao()) {
    if (Date.now() > fim) throw new Error("tempo esgotado esperando a condição do teste");
    await new Promise((r) => setTimeout(r, 50));
  }
}

const terminou = (id: number) => obterExportacao(db, id)!.status !== "em_andamento";

function iniciar(): number {
  const r = iniciarExportacao({ db, config }, "Grupo A");
  if (!r.ok) throw new Error(r.mensagem);
  iniciadas.push(r.id);
  return r.id;
}

describe("plano B quando encerrarArvore falha", () => {
  it("cancelar cai no SIGKILL do próprio processo filho", async () => {
    const id = iniciar();
    await aguardar(() => obterExportacao(db, id)!.etapa === "lendo_historico");

    expect(cancelarExportacao(id)).toBe(true);
    await aguardar(() => terminou(id));

    expect(obterExportacao(db, id)!.status).toBe("cancelada");
  }, 20_000);

  it("estourar o tempo limite cai no SIGKILL do próprio processo filho", async () => {
    config = { ...config, timeoutMs: 800 };
    const id = iniciar();
    await aguardar(() => terminou(id));

    const e = obterExportacao(db, id)!;
    expect(e.status).toBe("erro");
    expect(e.erroMsg).toMatch(/Tempo esgotado/);
  }, 20_000);

  it("cancelar devolve false quando o fallback SIGKILL também falha (nenhum kill funcionou)", async () => {
    // encerrarArvore já está simulado (sempre false, do mock do topo do arquivo); aqui o fallback
    // `child.kill("SIGKILL")` também é simulado como falho, para o teste não depender de conseguir
    // matar o processo de verdade. O afterEach mata o processo real pelo pid gravado em FAKE_PID_FILE.
    const filhoKill = vi.spyOn(ChildProcess.prototype, "kill").mockReturnValue(false);
    try {
      const id = iniciar();
      await aguardar(() => obterExportacao(db, id)!.etapa === "lendo_historico");

      expect(cancelarExportacao(id)).toBe(false);
    } finally {
      filhoKill.mockRestore();
    }
  }, 20_000);
});
