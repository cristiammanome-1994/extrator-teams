export type CategoriaAtualizacao = "novidade" | "melhoria" | "correcao";

export interface EntradaChangelog {
  /** Data no formato "AAAA-MM-DD". */
  data: string;
  titulo: string;
  categoria: CategoriaAtualizacao;
  descricao: string;
}

export const ROTULO_CATEGORIA: Record<CategoriaAtualizacao, string> = {
  novidade: "Nova funcionalidade",
  melhoria: "Melhoria",
  correcao: "Correção",
};

/**
 * Histórico de atualizações do Extrator Teams, mostrado na aba Sobre ▸ Changelog.
 *
 * Para registrar uma atualização nova, só acrescente um item ao fim deste array — a tela ordena
 * por data (mais recente primeiro) sozinha, então a ordem aqui não importa. Escreva do ponto de
 * vista de quem usa o painel, não da implementação por trás.
 */
export const CHANGELOG: EntradaChangelog[] = [
  {
    data: "2026-09-22",
    titulo: "Lançamento do Extrator Teams",
    categoria: "novidade",
    descricao:
      "Primeira versão do painel: exportar o histórico de um chat do Teams, ler e filtrar as conversas, e acompanhar a análise de mensagens por dia e por autor.",
  },
  {
    data: "2026-09-22",
    titulo: "Excluir itens do histórico",
    categoria: "novidade",
    descricao: "Agora dá para apagar uma exportação do histórico, junto com as mensagens que ela trouxe.",
  },
  {
    data: "2026-09-26",
    titulo: "Exportar para CSV, Excel e PDF",
    categoria: "novidade",
    descricao:
      "Em Conversas, baixe todas as mensagens do filtro atual em CSV ou Excel, não só a página aberta. Em Análise, baixe as tabelas por autor e por dia em Excel ou salve a tela em PDF.",
  },
];

/** `CHANGELOG` (ou outra lista, nos testes) da mais recente para a mais antiga, sem alterar o original. */
export function changelogOrdenado(entradas: EntradaChangelog[] = CHANGELOG): EntradaChangelog[] {
  return [...entradas].sort((a, b) => b.data.localeCompare(a.data));
}
