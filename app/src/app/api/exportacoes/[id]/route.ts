import { unlinkSync } from "node:fs";
import path from "node:path";
import type { NextRequest } from "next/server";
import { erroApi, okJson } from "@/lib/api";
import { obterBanco } from "@/lib/db/conexao";
import { excluirExportacao, obterExportacao } from "@/lib/db/repositorio";
import { lerConfigExportacao } from "@/lib/exportacao/config";
import { resolverArquivoDentro } from "@/lib/exportacao/caminhos";
import { inteiro } from "@/lib/parametros";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = inteiro((await params).id);
  if (id === null) return erroApi("ID_INVALIDO", "Identificador inválido.", 400);
  const exportacao = obterExportacao(obterBanco(), id);
  if (!exportacao) return erroApi("NAO_ENCONTRADA", "Exportação não encontrada.", 404);
  return okJson({ exportacao });
}

/**
 * Apaga a linha e as mensagens que ela trouxe. Os arquivos `.txt`/`.json` em `exports/` (se ainda
 * existirem) são apagados também, cada um só depois de passar pela mesma checagem de caminho
 * (léxica + realpath) da rota de download — um registro adulterado nunca apaga algo fora de
 * `exports/`, e o arquivo já ter sumido não é erro.
 */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = inteiro((await params).id);
  if (id === null) return erroApi("ID_INVALIDO", "Identificador inválido.", 400);

  const db = obterBanco();
  const exportacao = obterExportacao(db, id);
  const resultado = excluirExportacao(db, id);

  if (!resultado.ok) {
    if (resultado.motivo === "em_andamento") {
      return erroApi("EM_ANDAMENTO", "Cancele a exportação antes de excluí-la.", 409);
    }
    return erroApi("NAO_ENCONTRADA", "Exportação não encontrada.", 404);
  }

  const exportsDir = lerConfigExportacao().exportsDir;
  for (const arquivo of [exportacao?.arquivoTxt, exportacao?.arquivoJson]) {
    if (!arquivo) continue;
    const real = resolverArquivoDentro(exportsDir, path.resolve(arquivo));
    if (!real) continue;
    try {
      unlinkSync(real);
    } catch {
      // Best-effort: o arquivo pode já ter sumido, ou o disco pode estar sem permissão. A linha do
      // histórico e as mensagens já foram removidas, que é o que importa para quem usa o painel.
    }
  }

  return okJson({ ok: true, mensagensRemovidas: resultado.mensagensRemovidas });
}
