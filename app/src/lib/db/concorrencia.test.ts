import { existsSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { aplicarEsquema } from "./migracoes";
import { atualizarExportacao, obterExportacao, tentarCriarExportacao } from "./repositorio";

// `conexao` importa `server-only`, que lança fora do bundler do Next.
vi.mock("server-only", () => ({}));

const base = path.join(os.tmpdir(), `extrator-concorrencia-${process.pid}-${Date.now()}`);
const arquivos: string[] = [];

function novoCaminho(nome: string): string {
  const caminho = `${base}-${nome}.db`;
  arquivos.push(caminho);
  return caminho;
}

function limpar(caminho: string): void {
  for (const sufixo of ["", "-wal", "-shm"]) {
    if (existsSync(caminho + sufixo)) rmSync(caminho + sufixo, { force: true });
  }
}

function abrir(caminho: string): DatabaseSync {
  const db = new DatabaseSync(caminho);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA busy_timeout = 5000");
  aplicarEsquema(db);
  return db;
}

const g = globalThis as unknown as { __extratorBanco?: DatabaseSync };

function fecharSingleton(): void {
  try {
    g.__extratorBanco?.close();
  } catch {
    // Já fechado.
  }
  delete g.__extratorBanco;
}

afterEach(() => {
  fecharSingleton();
});

afterAll(() => {
  fecharSingleton();
  delete process.env.EXTRATOR_DB;
  for (const a of arquivos) limpar(a);
});

describe("duas conexões ao mesmo arquivo", () => {
  it("a segunda não cria exportação enquanto a primeira roda, e cria depois que ela termina", () => {
    const caminho = novoCaminho("duas");
    const a = abrir(caminho);
    const b = abrir(caminho);
    try {
      const id = tentarCriarExportacao(a, "Grupo X", "2026-09-21T10:00:00.000Z");
      expect(id).toEqual(expect.any(Number));

      expect(tentarCriarExportacao(b, "Grupo Y", "2026-09-21T10:00:01.000Z")).toBeNull();

      atualizarExportacao(a, id!, { status: "concluida", finalizadaEm: "2026-09-21T10:05:00.000Z" });
      expect(obterExportacao(b, id!)!.status).toBe("concluida");

      const segundo = tentarCriarExportacao(b, "Grupo Y", "2026-09-21T10:06:00.000Z");
      expect(segundo).toEqual(expect.any(Number));
      expect(segundo).not.toBe(id);
    } finally {
      a.close();
      b.close();
    }
  });
});

describe("índice único de exportação em andamento", () => {
  const inserir = (db: DatabaseSync, status: string) =>
    db
      .prepare("INSERT INTO exportacoes (grupo_id, status, etapa, iniciada_em) VALUES (?, ?, 'iniciando', '2026-09-21T10:00:00.000Z')")
      .run(1, status);

  it("recusa uma segunda linha em_andamento, mas aceita concluida, erro e cancelada à vontade", () => {
    const caminho = novoCaminho("indice");
    const db = abrir(caminho);
    try {
      db.prepare("INSERT INTO grupos (nome) VALUES ('G')").run();
      inserir(db, "em_andamento");
      expect(() => inserir(db, "em_andamento")).toThrow(/UNIQUE constraint failed/);

      for (const status of ["concluida", "erro", "cancelada", "concluida", "erro", "cancelada"]) {
        expect(() => inserir(db, status)).not.toThrow();
      }
      const n = db.prepare("SELECT COUNT(*) AS n FROM exportacoes").get() as unknown as { n: number };
      expect(n.n).toBe(7);
    } finally {
      db.close();
    }
  });

  it("tentarCriarExportacao devolve null (não lança) quando só o índice barra a inserção", () => {
    // Faz a checagem de existência "não ver" a linha em andamento (como se ela tivesse sido
    // criada por outro caminho): a violação do índice também vira "já existe uma em andamento".
    const caminho = novoCaminho("indice-funcao");
    const db = abrir(caminho);
    try {
      expect(tentarCriarExportacao(db, "G", "2026-09-21T10:00:00.000Z")).toEqual(expect.any(Number));

      const cego = new Proxy(db, {
        get(alvo, prop) {
          if (prop === "prepare") {
            return (sql: string) =>
              sql.includes("SELECT id FROM exportacoes WHERE status = 'em_andamento'")
                ? { get: () => undefined }
                : alvo.prepare(sql);
          }
          const valor = Reflect.get(alvo, prop, alvo);
          return typeof valor === "function" ? valor.bind(alvo) : valor;
        },
      });
      expect(tentarCriarExportacao(cego, "G", "2026-09-21T10:00:01.000Z")).toBeNull();

      const n = db.prepare("SELECT COUNT(*) AS n FROM exportacoes").get() as unknown as { n: number };
      expect(n.n).toBe(1);
      // A transação foi desfeita: o banco continua utilizável.
      expect(() => db.exec("BEGIN IMMEDIATE; COMMIT")).not.toThrow();
    } finally {
      db.close();
    }
  });
});

describe("obterBanco", () => {
  it("abre com busy_timeout de 5000 ms e journal_mode wal", async () => {
    const caminho = novoCaminho("obter");
    process.env.EXTRATOR_DB = caminho;
    const { obterBanco } = await import("./conexao");

    const db = obterBanco();
    const busy = db.prepare("PRAGMA busy_timeout").get() as unknown as { timeout: number };
    const wal = db.prepare("PRAGMA journal_mode").get() as unknown as { journal_mode: string };
    expect(busy.timeout).toBe(5000);
    expect(wal.journal_mode).toBe("wal");
  });

  it("marca como erro a exportação que ficou em_andamento antes do primeiro obterBanco()", async () => {
    const caminho = novoCaminho("orfa");
    const semente = abrir(caminho);
    const id = tentarCriarExportacao(semente, "Grupo Órfão", "2026-09-21T10:00:00.000Z")!;
    semente.close();

    process.env.EXTRATOR_DB = caminho;
    const { obterBanco } = await import("./conexao");
    const db = obterBanco();

    const e = obterExportacao(db, id)!;
    expect(e.status).toBe("erro");
    expect(e.erroMsg).toContain("Interrompida");
    expect(e.finalizadaEm).not.toBeNull();
  });
});
