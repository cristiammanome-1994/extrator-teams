import type { NextRequest } from "next/server";
import { erroApi, okJson } from "@/lib/api";
import { obterBanco } from "@/lib/db/conexao";
import { ErroImportacao, importarTxt } from "@/lib/importacao";

export const dynamic = "force-dynamic";

const LIMITE_BYTES = 20 * 1024 * 1024;

export async function POST(request: NextRequest) {
  let formulario: FormData;
  try {
    formulario = await request.formData();
  } catch {
    return erroApi("CORPO_INVALIDO", "Envie o arquivo como multipart/form-data.", 400);
  }

  const arquivo = formulario.get("arquivo");
  if (!(arquivo instanceof File)) return erroApi("SEM_ARQUIVO", "Envie um arquivo .txt no campo \"arquivo\".", 400);
  if (!arquivo.name.toLowerCase().endsWith(".txt")) return erroApi("TIPO_INVALIDO", "Só arquivos .txt são aceitos.", 400);
  if (arquivo.size > LIMITE_BYTES) return erroApi("ARQUIVO_GRANDE", "O arquivo passa do limite de 20 MB.", 413);

  const grupo = formulario.get("grupo");
  try {
    const resultado = importarTxt(
      obterBanco(),
      await arquivo.text(),
      typeof grupo === "string" ? grupo : undefined
    );
    return okJson(resultado);
  } catch (erro) {
    if (erro instanceof ErroImportacao) return erroApi("IMPORTACAO_INVALIDA", erro.message, 400);
    throw erro;
  }
}
