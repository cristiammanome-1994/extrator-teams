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
