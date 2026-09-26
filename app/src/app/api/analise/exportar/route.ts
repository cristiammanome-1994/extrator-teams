import type { NextRequest } from "next/server";
import { erroApi, respostaArquivo } from "@/lib/api";
import { obterBanco } from "@/lib/db/conexao";
import { dadosParaKpis, listarGrupos } from "@/lib/db/repositorio";
import { criarAba, gerarXlsx } from "@/lib/exportar";
import { formatarDia, partesDoRecorte } from "@/lib/formatacao";
import { nomeArquivoExportacao } from "@/lib/nomeArquivo";
import { calcularKpis } from "@/lib/kpis";
import { lerFiltros } from "@/lib/parametros";

export const dynamic = "force-dynamic";

/** "autor: " + 30 + "de 08/09/2026" + "até 09/09/2026" cabem nos 80 caracteres do slug do recorte. */
const LIMITE_AUTOR_NO_NOME = 30;

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
  // A tela desabilita o botão neste caso; quem chama a rota direto recebe o motivo em vez de uma planilha só com cabeçalhos.
  if (kpis.total === 0) return erroApi("SEM_MENSAGENS", "Nenhuma mensagem no recorte selecionado.", 404);

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
  // O slug do recorte tem teto de 80 caracteres: um autor comprido cortaria o período, que é o que diferencia os arquivos.
  const recorte = partesDoRecorte({ ...lido.filtros, autor: lido.filtros.autor?.slice(0, LIMITE_AUTOR_NO_NOME) }).join(" ");
  return respostaArquivo(corpo, "xlsx", nomeArquivoExportacao(`${grupo.nome} analise`, "xlsx", new Date(), recorte));
}
