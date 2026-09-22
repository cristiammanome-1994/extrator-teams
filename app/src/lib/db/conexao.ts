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

  // Sem isso, uma segunda conexão que encontra o lock de escrita ocupado recebe SQLITE_BUSY na hora,
  // em vez de esperar e enxergar a exportação em andamento. Vem antes das demais PRAGMAs para que
  // elas próprias (em especial a troca para WAL, que também pode encontrar contenção) fiquem
  // protegidas pelo timeout.
  db.exec("PRAGMA busy_timeout = 5000");
  // WAL deixa leitura e escrita concorrentes viáveis: as telas continuam
  // lendo enquanto uma exportação grava.
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA synchronous = NORMAL");

  try {
    aplicarEsquema(db);
    // Uma execução `em_andamento` que sobrou de antes deste boot não tem mais
    // processo por trás: vira erro em vez de bloquear novas exportações.
    reconciliarInterrompidas(db, new Date().toISOString());
  } catch (erro) {
    // Sem fechar, o handle vaza: o singleton nunca é gravado, e a próxima chamada abriria outro.
    db.close();
    throw erro;
  }

  g.__extratorBanco = db;
  return db;
}
