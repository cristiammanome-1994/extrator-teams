import { NextRequest, NextResponse } from "next/server";
import {
  DURACAO_SESSAO_MS,
  NOME_COOKIE_SESSAO,
  autenticacaoConfigurada,
  criarValorSessao,
  senhaConfere,
} from "@/lib/auth/sessao";
import {
  ORIGEM_LOCAL,
  registrarFalha,
  registrarSucesso,
  verificarLimite,
} from "@/lib/auth/limiteTentativas";

export const dynamic = "force-dynamic";

/** Atraso fixo em toda tentativa, para desencorajar força bruta. */
const ATRASO_RESPOSTA_MS = 400;

export async function POST(request: NextRequest) {
  if (!autenticacaoConfigurada()) {
    return NextResponse.json(
      {
        error: {
          code: "SEM_SENHA_CONFIGURADA",
          message: "EXTRATOR_SENHA não está definida no servidor. Configure-a em app/.env.local.",
        },
      },
      { status: 500 }
    );
  }

  // Antes de ler o corpo e do atraso: uma origem bloqueada não deve nem custar
  // o processamento da tentativa.
  const limite = verificarLimite(ORIGEM_LOCAL);
  if (limite.bloqueado) {
    return NextResponse.json(
      {
        error: {
          code: "MUITAS_TENTATIVAS",
          message: `Muitas tentativas seguidas. Tente novamente em ${Math.ceil(limite.segundosParaLiberar / 60)} min.`,
        },
      },
      { status: 429, headers: { "Retry-After": String(limite.segundosParaLiberar) } }
    );
  }

  let senha = "";
  try {
    const corpo = (await request.json()) as { senha?: unknown };
    senha = typeof corpo.senha === "string" ? corpo.senha : "";
  } catch {
    senha = "";
  }

  await new Promise((resolve) => setTimeout(resolve, ATRASO_RESPOSTA_MS));

  if (!senhaConfere(senha)) {
    const apos = registrarFalha(ORIGEM_LOCAL);
    return NextResponse.json(
      {
        error: {
          code: "SENHA_INVALIDA",
          message:
            apos.restantes <= 3 && apos.restantes > 0
              ? apos.restantes === 1
                ? "Senha incorreta. Resta 1 tentativa."
                : `Senha incorreta. Restam ${apos.restantes} tentativas.`
              : "Senha incorreta.",
        },
      },
      { status: 401 }
    );
  }

  registrarSucesso(ORIGEM_LOCAL);
  const resposta = NextResponse.json({ ok: true });
  resposta.cookies.set({
    name: NOME_COOKIE_SESSAO,
    value: await criarValorSessao(),
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(DURACAO_SESSAO_MS / 1000),
    secure: request.nextUrl.protocol === "https:",
  });
  return resposta;
}

/** Sair: apaga o cookie. */
export async function DELETE() {
  const resposta = NextResponse.json({ ok: true });
  resposta.cookies.set({ name: NOME_COOKIE_SESSAO, value: "", path: "/", maxAge: 0 });
  return resposta;
}
