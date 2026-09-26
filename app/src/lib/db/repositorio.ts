import type { DatabaseSync } from "node:sqlite";
import type {
  EtapaExportacao,
  Exportacao,
  FiltrosMensagens,
  GrupoResumo,
  LinhaKpi,
  Mensagem,
  MensagemParaInserir,
  StatusExportacao,
} from "@/types/dominio";

type Linha = Record<string, unknown>;
type Parametro = string | number | null;

function todas(db: DatabaseSync, sql: string, ...params: Parametro[]): Linha[] {
  return db.prepare(sql).all(...params) as unknown as Linha[];
}

function uma(db: DatabaseSync, sql: string, ...params: Parametro[]): Linha | undefined {
  return db.prepare(sql).get(...params) as unknown as Linha | undefined;
}

/** Roda `fn` numa transação; desfaz tudo se ela lançar. */
function transacao<T>(db: DatabaseSync, fn: () => T, imediata = false): T {
  db.exec(imediata ? "BEGIN IMMEDIATE" : "BEGIN");
  try {
    const resultado = fn();
    db.exec("COMMIT");
    return resultado;
  } catch (erro) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // A transação já pode ter sido desfeita pelo próprio SQLite.
    }
    throw erro;
  }
}

// ---------------------------------------------------------------- grupos

export function obterOuCriarGrupo(db: DatabaseSync, nome: string): number {
  db.prepare("INSERT OR IGNORE INTO grupos (nome) VALUES (?)").run(nome);
  return Number(uma(db, "SELECT id FROM grupos WHERE nome = ?", nome)!.id);
}

export function marcarUltimaExportacao(db: DatabaseSync, grupoId: number, agoraIso: string): void {
  db.prepare("UPDATE grupos SET ultima_exportacao_em = ? WHERE id = ?").run(agoraIso, grupoId);
}

export function listarGrupos(db: DatabaseSync): GrupoResumo[] {
  return todas(
    db,
    `SELECT g.id, g.nome, COUNT(m.id) AS total, MIN(m.data_hora) AS primeira, MAX(m.data_hora) AS ultima
       FROM grupos g LEFT JOIN mensagens m ON m.grupo_id = g.id
      GROUP BY g.id ORDER BY g.nome`
  ).map((l) => ({
    id: Number(l.id),
    nome: String(l.nome),
    total: Number(l.total),
    primeira: (l.primeira as string | null) ?? null,
    ultima: (l.ultima as string | null) ?? null,
  }));
}

export function listarAutores(db: DatabaseSync, grupoId: number): string[] {
  return todas(db, "SELECT DISTINCT autor FROM mensagens WHERE grupo_id = ? ORDER BY autor", grupoId).map((l) =>
    String(l.autor)
  );
}

// ------------------------------------------------------------ exportações

const COLUNAS = {
  status: "status",
  etapa: "etapa",
  grupoAberto: "grupo_aberto",
  finalizadaEm: "finalizada_em",
  totalMensagens: "total_mensagens",
  contador: "contador",
  arquivoTxt: "arquivo_txt",
  arquivoJson: "arquivo_json",
  erroMsg: "erro_msg",
  logTail: "log_tail",
} as const;

export type CamposExportacao = Partial<{
  status: StatusExportacao;
  etapa: EtapaExportacao;
  grupoAberto: string | null;
  finalizadaEm: string | null;
  totalMensagens: number | null;
  contador: number;
  arquivoTxt: string | null;
  arquivoJson: string | null;
  erroMsg: string | null;
  logTail: string;
}>;

const SELECT_EXPORTACAO = `SELECT e.*, g.nome AS grupo_nome
   FROM exportacoes e JOIN grupos g ON g.id = e.grupo_id`;

function mapearExportacao(l: Linha): Exportacao {
  return {
    id: Number(l.id),
    grupo: String(l.grupo_nome),
    grupoAberto: (l.grupo_aberto as string | null) ?? null,
    status: l.status as StatusExportacao,
    etapa: l.etapa as EtapaExportacao,
    contador: Number(l.contador),
    totalMensagens: l.total_mensagens === null ? null : Number(l.total_mensagens),
    iniciadaEm: String(l.iniciada_em),
    finalizadaEm: (l.finalizada_em as string | null) ?? null,
    arquivoTxt: (l.arquivo_txt as string | null) ?? null,
    arquivoJson: (l.arquivo_json as string | null) ?? null,
    erroMsg: (l.erro_msg as string | null) ?? null,
    logTail: String(l.log_tail ?? ""),
  };
}

/** Violação do índice único de exportação em andamento (a mensagem é a do SQLite). */
function ehViolacaoDeUnicidade(erro: unknown): boolean {
  return erro instanceof Error && /UNIQUE constraint failed: exportacoes\.status/i.test(erro.message);
}

/**
 * Cria a execução se — e só se — não houver outra em andamento; devolve `null` quando há.
 * O teams_profile só aceita um Edge por vez. Garantias:
 * - a checagem e a inserção rodam numa transação `BEGIN IMMEDIATE`, que serializa chamadas
 *   concorrentes (de outras conexões ou processos): quem chega depois espera o lock de escrita
 *   por até `busy_timeout` (5 s, definido em `obterBanco`) e então enxerga a linha em andamento;
 * - o índice único parcial `uq_exportacoes_em_andamento` impõe o mesmo limite no próprio banco,
 *   mesmo que alguém insira sem passar por esta função; se ele barrar a inserção, a transação é
 *   desfeita e o resultado também é `null`. Qualquer outro erro (inclusive SQLITE_BUSY após o
 *   `busy_timeout`) é relançado.
 */
export function tentarCriarExportacao(db: DatabaseSync, grupoNome: string, agoraIso: string): number | null {
  try {
    return transacao(
      db,
      () => {
        if (uma(db, "SELECT id FROM exportacoes WHERE status = 'em_andamento' LIMIT 1")) return null;
        const grupoId = obterOuCriarGrupo(db, grupoNome);
        const r = db
          .prepare("INSERT INTO exportacoes (grupo_id, status, etapa, iniciada_em) VALUES (?, 'em_andamento', 'iniciando', ?)")
          .run(grupoId, agoraIso);
        return Number(r.lastInsertRowid);
      },
      true
    );
  } catch (erro) {
    if (ehViolacaoDeUnicidade(erro)) return null;
    throw erro;
  }
}

export function atualizarExportacao(db: DatabaseSync, id: number, campos: CamposExportacao): void {
  const chaves = (Object.keys(campos) as (keyof CamposExportacao)[]).filter((k) => campos[k] !== undefined);
  if (chaves.length === 0) return;
  const sql = `UPDATE exportacoes SET ${chaves.map((k) => `${COLUNAS[k]} = ?`).join(", ")} WHERE id = ?`;
  db.prepare(sql).run(...chaves.map((k) => (campos[k] ?? null) as Parametro), id);
}

export function obterExportacao(db: DatabaseSync, id: number): Exportacao | null {
  const l = uma(db, `${SELECT_EXPORTACAO} WHERE e.id = ?`, id);
  return l ? mapearExportacao(l) : null;
}

export function listarExportacoes(db: DatabaseSync, limite = 50): Exportacao[] {
  return todas(db, `${SELECT_EXPORTACAO} ORDER BY e.id DESC LIMIT ?`, limite).map(mapearExportacao);
}

export type ResultadoExclusao =
  | { ok: true; mensagensRemovidas: number }
  | { ok: false; motivo: "nao_encontrada" | "em_andamento" };

/**
 * Apaga a execução e as mensagens que ELA trouxe (`mensagens.exportacao_id = id`) — não as do
 * grupo inteiro. Mensagens importadas por um `.txt` avulso (`exportacao_id` nulo) nunca são
 * tocadas. Se o grupo foi reexportado depois e uma mensagem já existia, ela continua marcada com
 * a execução mais antiga (quem inseriu de fato); apagar essa execução apaga essa mensagem também,
 * mesmo a reexportação mais recente tendo "confirmado" ela de novo — não há como saber, só pelo
 * banco, que duas execuções trouxeram a mesma mensagem.
 *
 * Recusa uma execução `em_andamento` (cancele antes) e devolve `nao_encontrada` para um id que não
 * existe. Não mexe no arquivo `.txt`/`.json` em disco — isso é responsabilidade de quem chama.
 */
export function excluirExportacao(db: DatabaseSync, id: number): ResultadoExclusao {
  return transacao(db, () => {
    const linha = uma(db, "SELECT status FROM exportacoes WHERE id = ?", id);
    if (!linha) return { ok: false, motivo: "nao_encontrada" };
    if (linha.status === "em_andamento") return { ok: false, motivo: "em_andamento" };
    const removidas = db.prepare("DELETE FROM mensagens WHERE exportacao_id = ?").run(id).changes;
    db.prepare("DELETE FROM exportacoes WHERE id = ?").run(id);
    return { ok: true, mensagensRemovidas: Number(removidas) };
  });
}

/** Execuções que ficaram `em_andamento` de uma sessão anterior do servidor. */
export function reconciliarInterrompidas(db: DatabaseSync, agoraIso: string): number {
  const r = db
    .prepare(
      `UPDATE exportacoes
          SET status = 'erro', finalizada_em = ?,
              erro_msg = 'Interrompida: o servidor foi reiniciado durante a exportação.'
        WHERE status = 'em_andamento'`
    )
    .run(agoraIso);
  return Number(r.changes);
}

// -------------------------------------------------------------- mensagens

export function inserirMensagens(
  db: DatabaseSync,
  grupoId: number,
  exportacaoId: number | null,
  mensagens: MensagemParaInserir[]
): { lidas: number; novas: number } {
  const inserir = db.prepare(
    `INSERT OR IGNORE INTO mensagens (grupo_id, exportacao_id, autor, data_hora, data_hora_original, texto)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  const novas = transacao(db, () => {
    let total = 0;
    for (const m of mensagens) {
      total += Number(inserir.run(grupoId, exportacaoId, m.autor, m.dataHora, m.dataHoraOriginal, m.texto).changes);
    }
    return total;
  });
  return { lidas: mensagens.length, novas };
}

function escaparLike(texto: string): string {
  return texto.replace(/[\\%_]/g, "\\$&");
}

function montarWhere(f: FiltrosMensagens): { where: string; params: Parametro[] } {
  const cond = ["grupo_id = ?"];
  const params: Parametro[] = [f.grupoId];
  if (f.autor) {
    cond.push("autor = ?");
    params.push(f.autor);
  }
  if (f.de) {
    cond.push("substr(data_hora, 1, 10) >= ?");
    params.push(f.de);
  }
  if (f.ate) {
    cond.push("substr(data_hora, 1, 10) <= ?");
    params.push(f.ate);
  }
  if (f.texto) {
    cond.push("texto LIKE ? ESCAPE '\\'");
    params.push(`%${escaparLike(f.texto)}%`);
  }
  return { where: cond.join(" AND "), params };
}

const SELECT_MENSAGENS = "SELECT id, grupo_id, autor, data_hora, data_hora_original, texto FROM mensagens";
const ORDEM_MENSAGENS = "ORDER BY data_hora IS NULL, data_hora, id";

function paraMensagem(l: Record<string, unknown>): Mensagem {
  return {
    id: Number(l.id),
    grupoId: Number(l.grupo_id),
    autor: String(l.autor),
    dataHora: (l.data_hora as string | null) ?? null,
    dataHoraOriginal: String(l.data_hora_original),
    texto: String(l.texto),
  };
}

export function consultarMensagens(
  db: DatabaseSync,
  filtros: FiltrosMensagens,
  pagina: number,
  porPagina: number
): { itens: Mensagem[]; total: number } {
  const { where, params } = montarWhere(filtros);
  const total = Number(uma(db, `SELECT COUNT(*) AS n FROM mensagens WHERE ${where}`, ...params)!.n);
  const itens = todas(
    db,
    `${SELECT_MENSAGENS} WHERE ${where} ${ORDEM_MENSAGENS} LIMIT ? OFFSET ?`,
    ...params,
    porPagina,
    (pagina - 1) * porPagina
  ).map(paraMensagem);
  return { itens, total };
}

/** Todas as mensagens do filtro, na ordem da tela, para exportação. Sem paginação. */
export function todasMensagens(db: DatabaseSync, filtros: FiltrosMensagens): Mensagem[] {
  const { where, params } = montarWhere(filtros);
  return todas(
    db,
    `${SELECT_MENSAGENS} WHERE ${where} ${ORDEM_MENSAGENS}`,
    ...params
  ).map(paraMensagem);
}

export function dadosParaKpis(db: DatabaseSync, filtros: FiltrosMensagens): LinhaKpi[] {
  const { where, params } = montarWhere(filtros);
  return todas(db, `SELECT autor, data_hora FROM mensagens WHERE ${where}`, ...params).map((l) => ({
    autor: String(l.autor),
    dataHora: (l.data_hora as string | null) ?? null,
  }));
}
