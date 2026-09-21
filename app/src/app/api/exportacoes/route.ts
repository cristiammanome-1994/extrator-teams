import type { NextRequest } from "next/server";
import { erroApi, okJson } from "@/lib/api";
import { obterBanco } from "@/lib/db/conexao";
import { listarExportacoes } from "@/lib/db/repositorio";
import { lerConfigExportacao } from "@/lib/exportacao/config";
import { iniciarExportacao } from "@/lib/exportacao/orquestrador";

export const dynamic = "force-dynamic";

export async function GET() {
  return okJson({ exportacoes: listarExportacoes(obterBanco()) });
}

const STATUS_POR_CODIGO = { GRUPO_INVALIDO: 400, EM_ANDAMENTO: 409, PYTHON_AUSENTE: 500 } as const;

export async function POST(request: NextRequest) {
  let grupo: unknown;
  try {
    grupo = ((await request.json()) as { grupo?: unknown }).grupo;
  } catch {
    grupo = undefined;
  }

  try {
    const resultado = iniciarExportacao({ db: obterBanco(), config: lerConfigExportacao() }, grupo);
    if (resultado.ok) return okJson({ id: resultado.id }, 202);
    return erroApi(resultado.codigo, resultado.mensagem, STATUS_POR_CODIGO[resultado.codigo]);
  } catch (erro) {
    // O orquestrador já marcou a exportação como `erro` antes de relançar.
    const mensagem = erro instanceof Error && erro.message ? erro.message : "Falha ao iniciar a exportação.";
    return erroApi("FALHA_AO_INICIAR", mensagem, 500);
  }
}
