import { NextResponse, type NextRequest } from "next/server";
import { NOME_COOKIE_SESSAO, sessaoEhValida } from "@/lib/auth/sessao";

/**
 * Barreira única do app: tudo exige sessão, exceto a tela de login e a rota
 * que a valida. Lista de exceções em vez de lista de protegidos, de
 * propósito — uma rota nova nasce protegida, e esquecer de registrá-la aqui
 * causa um login a mais, não um vazamento.
 */
const ROTAS_PUBLICAS = ["/login", "/api/auth/login"];

const METODOS_SEGUROS = ["GET", "HEAD", "OPTIONS"];

/**
 * `SameSite=lax` ignora a porta: outro app em `localhost`/`127.0.0.1` é "mesmo site" e poderia
 * disparar um POST com o cookie do usuário. Para métodos que alteram estado, um `Origin` que não
 * bate com o host que o cliente usou é recusado. `Origin` ausente (curl, servidor a servidor) passa —
 * a sessão continua sendo exigida —, e ilegível (`null`, lixo) conta como inválido.
 *
 * O esperado sai do cabeçalho `Host`, não de `nextUrl.origin`: o Next reescreve qualquer host de
 * loopback para "localhost" ali, e um navegador em 127.0.0.1 (o endereço em que o app sobe) seria
 * recusado por engano.
 */
function origemInvalida(request: NextRequest): boolean {
  if (METODOS_SEGUROS.includes(request.method.toUpperCase())) return false;
  const origem = request.headers.get("origin");
  if (origem === null) return false;
  const host = request.headers.get("host") || request.nextUrl.host;
  try {
    return new URL(origem).origin !== `${request.nextUrl.protocol}//${host}`;
  } catch {
    return true;
  }
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Antes da rota pública: o POST do login também não deve aceitar origem estranha.
  if (origemInvalida(request)) {
    return NextResponse.json(
      { error: { code: "ORIGEM_INVALIDA", message: "Origem da requisição não permitida." } },
      { status: 403 }
    );
  }

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
