import type { NextRequest } from "next/server";
import { erroApi, okJson } from "@/lib/api";
import { obterBanco } from "@/lib/db/conexao";
import { ErroImportacao, importarTxt } from "@/lib/importacao";
import { LIMITE_ARQUIVO_BYTES, LIMITE_CORPO_BYTES } from "@/lib/limitesUpload";

export const dynamic = "force-dynamic";

const MENSAGEM_ARQUIVO_GRANDE = `O arquivo passa do limite de ${LIMITE_ARQUIVO_BYTES / (1024 * 1024)} MB.`;

export async function POST(request: NextRequest) {
  // Antes de ler o corpo: acima do teto o proxy do Next o truncaria e o
  // formData() falharia com um erro enganoso (e leríamos tudo à toa).
  const declarado = Number(request.headers.get("content-length"));
  if (Number.isFinite(declarado) && declarado > LIMITE_CORPO_BYTES) {
    return erroApi("ARQUIVO_GRANDE", MENSAGEM_ARQUIVO_GRANDE, 413);
  }

  let formulario: FormData;
  try {
    formulario = await request.formData();
  } catch {
    // Sem Content-Length (ex.: chunked) um corpo truncado também cai aqui.
    return erroApi(
      "CORPO_INVALIDO",
      `Não foi possível ler o arquivo enviado. Envie um .txt como multipart/form-data (limite de ${LIMITE_ARQUIVO_BYTES / (1024 * 1024)} MB).`,
      400
    );
  }

  const arquivo = formulario.get("arquivo");
  if (!(arquivo instanceof File)) return erroApi("SEM_ARQUIVO", "Envie um arquivo .txt no campo \"arquivo\".", 400);
  if (!arquivo.name.toLowerCase().endsWith(".txt")) return erroApi("TIPO_INVALIDO", "Só arquivos .txt são aceitos.", 400);
  if (arquivo.size > LIMITE_ARQUIVO_BYTES) return erroApi("ARQUIVO_GRANDE", MENSAGEM_ARQUIVO_GRANDE, 413);

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
