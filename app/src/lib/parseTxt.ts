import type { MensagemBruta } from "@/types/dominio";

export interface ResultadoTxt {
  grupo: string | null;
  totalDeclarado: number | null;
  mensagens: MensagemBruta[];
}

/**
 * Cabeçalho de uma mensagem: `[<data do Teams>] <autor>:`. Reconhecido por
 * regex e não por linha em branco, porque o texto de uma mensagem pode ter
 * linhas em branco no meio.
 */
const CABECALHO_MENSAGEM = /^\[([^\]]*\d{1,2}\s+de\s+\p{L}+\s+de\s+\d{4}\s+\d{1,2}:\d{2})\]\s+(.+):$/u;

interface Bloco {
  autor: string;
  dataHoraOriginal: string;
  linhas: string[];
}

/**
 * Lê o `.txt` produzido por `teams_chat_export.py`. Aceita CRLF (o Python no
 * Windows grava assim) e BOM.
 */
export function parseTxt(conteudo: string): ResultadoTxt {
  const linhas = conteudo.replace(/^\uFEFF/, "").split(/\r\n|\n|\r/);
  let grupo: string | null = null;
  let totalDeclarado: number | null = null;
  const blocos: Bloco[] = [];

  for (const linha of linhas) {
    const cabecalho = CABECALHO_MENSAGEM.exec(linha);
    if (cabecalho) {
      blocos.push({ dataHoraOriginal: cabecalho[1], autor: cabecalho[2], linhas: [] });
      continue;
    }
    if (blocos.length > 0) {
      blocos[blocos.length - 1].linhas.push(linha);
      continue;
    }
    // Antes da primeira mensagem: cabeçalho do arquivo.
    const g = /^Histórico do chat:\s*(.+)$/u.exec(linha);
    if (g) grupo = g[1].trim();
    const t = /^Total de mensagens:\s*(\d+)/u.exec(linha);
    if (t) totalDeclarado = Number(t[1]);
  }

  return {
    grupo,
    totalDeclarado,
    mensagens: blocos.map((b) => ({
      autor: b.autor,
      dataHoraOriginal: b.dataHoraOriginal,
      // O script termina cada mensagem com uma linha em branco separadora.
      texto: b.linhas.join("\n").replace(/\n+$/, ""),
    })),
  };
}
