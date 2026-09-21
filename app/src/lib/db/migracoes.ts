import type { DatabaseSync } from "node:sqlite";

/**
 * Esquema do banco. Fica separado de `conexao.ts` (que só abre o arquivo) para
 * poder ser aplicado num banco `:memory:` nos testes.
 *
 * A chave única de `mensagens` usa o texto ORIGINAL da data, não a data já
 * interpretada: `NULL` não deduplica em SQLite, e a data original é o que o
 * script usa na sua própria chave de deduplicação.
 */
export const DDL = `
CREATE TABLE IF NOT EXISTS grupos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL UNIQUE,
  ultima_exportacao_em TEXT
);

CREATE TABLE IF NOT EXISTS exportacoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  grupo_id INTEGER NOT NULL REFERENCES grupos(id),
  status TEXT NOT NULL,
  etapa TEXT NOT NULL DEFAULT 'iniciando',
  grupo_aberto TEXT,
  iniciada_em TEXT NOT NULL,
  finalizada_em TEXT,
  total_mensagens INTEGER,
  contador INTEGER NOT NULL DEFAULT 0,
  arquivo_txt TEXT,
  arquivo_json TEXT,
  erro_msg TEXT,
  log_tail TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS mensagens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  grupo_id INTEGER NOT NULL REFERENCES grupos(id),
  exportacao_id INTEGER REFERENCES exportacoes(id),
  autor TEXT NOT NULL,
  data_hora TEXT,
  data_hora_original TEXT NOT NULL,
  texto TEXT NOT NULL,
  UNIQUE (grupo_id, autor, data_hora_original, texto)
);

CREATE INDEX IF NOT EXISTS idx_mensagens_grupo_data ON mensagens (grupo_id, data_hora);
`;

export function aplicarEsquema(db: DatabaseSync): void {
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(DDL);
}
