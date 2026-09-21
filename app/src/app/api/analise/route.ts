import type { NextRequest } from "next/server";
import { erroApi, okJson } from "@/lib/api";
import { obterBanco } from "@/lib/db/conexao";
import { dadosParaKpis } from "@/lib/db/repositorio";
import { calcularKpis } from "@/lib/kpis";
import { lerFiltros } from "@/lib/parametros";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const lido = lerFiltros(request.nextUrl.searchParams);
  if ("erro" in lido) return erroApi("PARAMETRO_INVALIDO", lido.erro, 400);
  return okJson({ kpis: calcularKpis(dadosParaKpis(obterBanco(), lido.filtros)) });
}
