import type { NextRequest } from "next/server";
import { erroApi, okJson } from "@/lib/api";
import { obterBanco } from "@/lib/db/conexao";
import { obterExportacao } from "@/lib/db/repositorio";
import { inteiro } from "@/lib/parametros";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = inteiro((await params).id);
  if (id === null) return erroApi("ID_INVALIDO", "Identificador inválido.", 400);
  const exportacao = obterExportacao(obterBanco(), id);
  if (!exportacao) return erroApi("NAO_ENCONTRADA", "Exportação não encontrada.", 404);
  return okJson({ exportacao });
}
