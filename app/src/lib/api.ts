import { NextResponse } from "next/server";

/**
 * `private` NÃO É NEGOCIÁVEL. Estas rotas devolvem conversas atrás da
 * barreira de sessão; com `public`, um cache compartilhado no caminho poderia
 * guardar a resposta de uma sessão autenticada e entregá-la a quem nunca
 * passou pelo login.
 */
export const CABECALHOS_PRIVADOS = { "Cache-Control": "private, no-store" } as const;

export function erroApi(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status, headers: CABECALHOS_PRIVADOS });
}

export function okJson<T>(dados: T, status = 200) {
  return NextResponse.json(dados, { status, headers: CABECALHOS_PRIVADOS });
}

export type FormatoExportacao = "csv" | "xlsx";

const TIPOS_EXPORTACAO: Record<FormatoExportacao, string> = {
  csv: "text/csv; charset=utf-8",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

/** `csv` ou `xlsx`; ausente ou outra coisa é recusado (undefined). */
export function lerFormato(valor: string | null): FormatoExportacao | undefined {
  return valor === "csv" || valor === "xlsx" ? valor : undefined;
}

/** Download de arquivo. `nomeArquivo` já vem higienizado por `nomeArquivoExportacao`. */
export function respostaArquivo(corpo: string | Buffer, formato: FormatoExportacao, nomeArquivo: string) {
  return new Response(new Uint8Array(typeof corpo === "string" ? Buffer.from(corpo, "utf8") : corpo), {
    headers: {
      ...CABECALHOS_PRIVADOS,
      "Content-Type": TIPOS_EXPORTACAO[formato],
      "Content-Disposition": `attachment; filename="${nomeArquivo}"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
