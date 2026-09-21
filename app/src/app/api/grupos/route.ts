import { okJson } from "@/lib/api";
import { obterBanco } from "@/lib/db/conexao";
import { listarGrupos } from "@/lib/db/repositorio";

export const dynamic = "force-dynamic";

export async function GET() {
  return okJson({ grupos: listarGrupos(obterBanco()) });
}
