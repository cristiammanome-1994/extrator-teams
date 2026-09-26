import type { NextRequest } from "next/server";
import { erroApi, lerFormato, respostaArquivo } from "@/lib/api";
import { obterBanco } from "@/lib/db/conexao";
import { listarGrupos, todasMensagens } from "@/lib/db/repositorio";
import { criarAba, gerarCsv, gerarXlsx, type ColunaExportacao } from "@/lib/exportar";
import { nomeArquivoExportacao } from "@/lib/nomeArquivo";
import { formatarDataHora } from "@/lib/formatacao";
import { lerFiltros } from "@/lib/parametros";
import type { Mensagem } from "@/types/dominio";

export const dynamic = "force-dynamic";

const COLUNAS: ColunaExportacao<Mensagem>[] = [
  { cabecalho: "Data e hora", valor: (m) => formatarDataHora(m.dataHora, m.dataHoraOriginal), largura: 18 },
  { cabecalho: "Autor", valor: (m) => m.autor, largura: 28 },
  { cabecalho: "Mensagem", valor: (m) => m.texto, largura: 100 },
];

/** Conversa do grupo com os mesmos filtros da tela Conversas, todas as páginas. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const lido = lerFiltros(params);
  if ("erro" in lido) return erroApi("PARAMETRO_INVALIDO", lido.erro, 400);
  const formato = lerFormato(params.get("formato"));
  if (!formato) return erroApi("PARAMETRO_INVALIDO", "Formato deve ser csv ou xlsx.", 400);

  const db = obterBanco();
  const grupo = listarGrupos(db).find((g) => g.id === lido.filtros.grupoId);
  if (!grupo) return erroApi("NAO_ENCONTRADO", "Grupo não encontrado.", 404);

  const mensagens = todasMensagens(db, lido.filtros);
  const nome = nomeArquivoExportacao(grupo.nome, formato);
  const corpo =
    formato === "csv"
      ? gerarCsv(mensagens, COLUNAS)
      : await gerarXlsx([criarAba("Mensagens", mensagens, COLUNAS)]);
  return respostaArquivo(corpo, formato, nome);
}
