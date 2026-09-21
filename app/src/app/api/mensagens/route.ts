import type { NextRequest } from "next/server";
import { erroApi, okJson } from "@/lib/api";
import { obterBanco } from "@/lib/db/conexao";
import { consultarMensagens, listarAutores } from "@/lib/db/repositorio";
import { inteiro, lerFiltros, limitar } from "@/lib/parametros";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const lido = lerFiltros(params);
  if ("erro" in lido) return erroApi("PARAMETRO_INVALIDO", lido.erro, 400);

  const pagina = limitar(inteiro(params.get("pagina")), 1, 1_000_000, 1);
  const porPagina = limitar(inteiro(params.get("porPagina")), 10, 200, 50);
  const db = obterBanco();
  const { itens, total } = consultarMensagens(db, lido.filtros, pagina, porPagina);
  return okJson({
    itens,
    total,
    pagina,
    porPagina,
    autores: listarAutores(db, lido.filtros.grupoId),
    grupoId: lido.filtros.grupoId,
  });
}
