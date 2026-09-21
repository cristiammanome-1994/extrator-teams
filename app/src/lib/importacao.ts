import type { DatabaseSync } from "node:sqlite";
import type { MensagemBruta } from "@/types/dominio";
import { interpretarDataHoraPt } from "./dataPt";
import { inserirMensagens, marcarUltimaExportacao, obterOuCriarGrupo } from "./db/repositorio";
import { parseTxt } from "./parseTxt";

/** Erro esperado de uma importação (entrada inválida) — a API o devolve como 400. */
export class ErroImportacao extends Error {}

export interface ResultadoImportacao {
  grupo: string;
  lidas: number;
  novas: number;
}

export function importarMensagens(
  db: DatabaseSync,
  params: { grupoNome: string; exportacaoId: number | null; mensagens: MensagemBruta[]; agoraIso?: string }
): ResultadoImportacao {
  const { grupoNome, exportacaoId, mensagens } = params;
  const grupoId = obterOuCriarGrupo(db, grupoNome);
  const { lidas, novas } = inserirMensagens(
    db,
    grupoId,
    exportacaoId,
    mensagens.map((m) => ({ ...m, dataHora: interpretarDataHoraPt(m.dataHoraOriginal) }))
  );
  // Só uma exportação de verdade conta como "última exportação" do grupo;
  // importar um .txt antigo não.
  if (exportacaoId !== null) marcarUltimaExportacao(db, grupoId, params.agoraIso ?? new Date().toISOString());
  return { grupo: grupoNome, lidas, novas };
}

export interface ResultadoImportacaoTxt extends ResultadoImportacao {
  totalDeclarado: number | null;
  /** O "Total de mensagens" do cabeçalho não bate com o que foi lido. */
  divergencia: boolean;
}

/** Importa um `.txt` produzido pelo script. O nome informado prevalece sobre o do cabeçalho. */
export function importarTxt(db: DatabaseSync, conteudo: string, grupoInformado?: string): ResultadoImportacaoTxt {
  const lido = parseTxt(conteudo);
  const grupo = grupoInformado?.trim() || lido.grupo;
  if (!grupo) {
    throw new ErroImportacao(
      'O arquivo não tem o cabeçalho "Histórico do chat: ...". Informe o nome do grupo.'
    );
  }
  if (lido.mensagens.length === 0) {
    throw new ErroImportacao("Nenhuma mensagem encontrada no arquivo.");
  }

  const r = importarMensagens(db, { grupoNome: grupo, exportacaoId: null, mensagens: lido.mensagens });
  return {
    ...r,
    totalDeclarado: lido.totalDeclarado,
    divergencia: lido.totalDeclarado !== null && lido.totalDeclarado !== lido.mensagens.length,
  };
}

function ehTexto(valor: unknown): valor is string {
  return typeof valor === "string";
}

/** Importa o `.json` do `--json-out` de uma exportação. */
export function importarJson(db: DatabaseSync, exportacaoId: number, dado: unknown): ResultadoImportacao {
  if (typeof dado !== "object" || dado === null) throw new ErroImportacao("JSON de exportação inválido.");
  const { grupo, mensagens } = dado as { grupo?: unknown; mensagens?: unknown };
  if (!ehTexto(grupo) || !grupo.trim()) throw new ErroImportacao('JSON de exportação sem o campo "grupo".');
  if (!Array.isArray(mensagens)) throw new ErroImportacao('JSON de exportação sem a lista "mensagens".');

  const lidas: MensagemBruta[] = mensagens.map((m, i) => {
    const { autor, data_hora_original, texto } = (m ?? {}) as Record<string, unknown>;
    if (!ehTexto(autor) || !ehTexto(data_hora_original) || !ehTexto(texto)) {
      throw new ErroImportacao(`Mensagem ${i + 1} do JSON está incompleta.`);
    }
    return { autor, dataHoraOriginal: data_hora_original, texto };
  });

  return importarMensagens(db, { grupoNome: grupo.trim(), exportacaoId, mensagens: lidas });
}
