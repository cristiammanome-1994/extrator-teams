import { NextResponse, type NextRequest } from "next/server";
import { NOME_COOKIE_SESSAO, sessaoEhValida } from "@/lib/auth/sessao";

/**
 * Barreira única do app: tudo exige sessão, exceto a tela de login e a rota
 * que a valida. Lista de exceções em vez de lista de protegidos, de
 * propósito — uma rota nova nasce protegida, e esquecer de registrá-la aqui
 * causa um login a mais, não um vazamento.
 */
const ROTAS_PUBLICAS = ["/login", "/api/auth/login"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (ROTAS_PUBLICAS.some((rota) => pathname === rota || pathname.startsWith(`${rota}/`))) {
    return NextResponse.next();
  }

  return verificar(request);
}

async function verificar(request: NextRequest) {
  const cookie = request.cookies.get(NOME_COOKIE_SESSAO)?.value;
  if (await sessaoEhValida(cookie)) return NextResponse.next();

  // API responde 401 em vez de redirecionar: um fetch que recebe o HTML da
  // tela de login quebra de um jeito difícil de diagnosticar.
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: { code: "NAO_AUTENTICADO", message: "Sessão expirada. Faça login novamente." } },
      { status: 401 }
    );
  }

  const destino = request.nextUrl.clone();
  destino.pathname = "/login";
  destino.searchParams.set("de", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(destino);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico)$).*)"],
};
