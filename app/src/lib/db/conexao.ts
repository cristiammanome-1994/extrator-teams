import "server-only";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { aplicarEsquema } from "./migracoes";
import { reconciliarInterrompidas } from "./repositorio";

/**
 * Banco local em SQLite, usando o módulo nativo do Node (24+). Guarda os
 * grupos, o histórico de exportações e as mensagens.
 *
 * O singleton mora em `globalThis`: em desenvolvimento o Next recarrega
 * módulos e cada instância abriria a sua própria conexão.
 */
const g = globalThis as unknown as { __extratorBanco?: DatabaseSync };

export function caminhoDoBanco(): string {
  return process.env.EXTRATOR_DB || path.join(process.cwd(), "data", "extrator.db");
}

export function obterBanco(): DatabaseSync {
  if (g.__extratorBanco) return g.__extratorBanco;

  const caminho = caminhoDoBanco();
  mkdirSync(path.dirname(caminho), { recursive: true });
  const db = new DatabaseSync(caminho);

  // WAL deixa leitura e escrita concorrentes viáveis: as telas continuam
  // lendo enquanto uma exportação grava.
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA synchronous = NORMAL");
  aplicarEsquema(db);

  // Uma execução `em_andamento` que sobrou de antes deste boot não tem mais
  // processo por trás: vira erro em vez de bloquear novas exportações.
  reconciliarInterrompidas(db, new Date().toISOString());

  g.__extratorBanco = db;
  return db;
}
