import type { NextRequest } from "next/server";
import { erroApi, respostaArquivo } from "@/lib/api";
import { obterBanco } from "@/lib/db/conexao";
import { dadosParaKpis, listarGrupos } from "@/lib/db/repositorio";
import { criarAba, gerarXlsx } from "@/lib/exportar";
import { formatarDia } from "@/lib/formatacao";
import { nomeArquivoExportacao } from "@/lib/nomeArquivo";
import { calcularKpis } from "@/lib/kpis";
import { lerFiltros } from "@/lib/parametros";

export const dynamic = "force-dynamic";

/**
 * Excel com as duas tabelas da tela Análise (por autor e por dia), no mesmo recorte: grupo, período
 * e autor. Com um autor escolhido, a aba "Por autor" tem uma linha só.
 */
export async function GET(request: NextRequest) {
  const lido = lerFiltros(request.nextUrl.searchParams);
  if ("erro" in lido) return erroApi("PARAMETRO_INVALIDO", lido.erro, 400);

  const db = obterBanco();
  const grupo = listarGrupos(db).find((g) => g.id === lido.filtros.grupoId);
  if (!grupo) return erroApi("NAO_ENCONTRADO", "Grupo não encontrado.", 404);

  const kpis = calcularKpis(dadosParaKpis(db, lido.filtros));
  const corpo = await gerarXlsx([
    criarAba("Por autor", kpis.porAutor, [
      { cabecalho: "Autor", valor: (l) => l.autor, largura: 32 },
      { cabecalho: "Mensagens", valor: (l) => l.total },
    ]),
    criarAba("Por dia", kpis.porDia, [
      { cabecalho: "Dia", valor: (l) => formatarDia(l.dia), largura: 14 },
      { cabecalho: "Mensagens", valor: (l) => l.total },
    ]),
  ]);
  return respostaArquivo(corpo, "xlsx", nomeArquivoExportacao(`${grupo.nome} analise`, "xlsx"));
}
