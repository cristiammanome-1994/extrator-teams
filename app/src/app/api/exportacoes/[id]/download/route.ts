import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { NextRequest } from "next/server";
import { CABECALHOS_PRIVADOS, erroApi } from "@/lib/api";
import { obterBanco } from "@/lib/db/conexao";
import { obterExportacao } from "@/lib/db/repositorio";
import { lerConfigExportacao } from "@/lib/exportacao/config";
import { estaDentro } from "@/lib/exportacao/caminhos";
import { inteiro } from "@/lib/parametros";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = inteiro((await params).id);
  if (id === null) return erroApi("ID_INVALIDO", "Identificador inválido.", 400);

  // O caminho vem do banco, nunca do cliente, e ainda precisa estar dentro de
  // exports/ — defesa em profundidade contra um registro adulterado.
  const exportacao = obterExportacao(obterBanco(), id);
  const caminho = exportacao?.arquivoTxt ? path.resolve(exportacao.arquivoTxt) : null;
  if (!caminho || !estaDentro(lerConfigExportacao().exportsDir, caminho) || !existsSync(caminho)) {
    return erroApi("ARQUIVO_NAO_ENCONTRADO", "O arquivo desta exportação não está disponível.", 404);
  }

  return new Response(readFileSync(caminho, "utf8"), {
    headers: {
      ...CABECALHOS_PRIVADOS,
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${path.basename(caminho)}"`,
    },
  });
}
