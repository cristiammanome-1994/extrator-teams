import type { NextRequest } from "next/server";
import { erroApi, okJson } from "@/lib/api";
import { cancelarExportacao } from "@/lib/exportacao/orquestrador";
import { inteiro } from "@/lib/parametros";

export const dynamic = "force-dynamic";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = inteiro((await params).id);
  if (id === null) return erroApi("ID_INVALIDO", "Identificador inválido.", 400);
  return okJson({ ok: cancelarExportacao(id) });
}
