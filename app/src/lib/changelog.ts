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
  {
    data: "2026-09-26",
    titulo: "Análise: filtro por autor, atalhos de período e novos gráficos",
    categoria: "melhoria",
    descricao:
      "A tela Análise agora filtra por autor e tem atalhos de período (últimos 7, 30 e 90 dias, contados a partir da última mensagem do grupo, não de hoje), com o número de filtros ativos e um botão Limpar. Ganhou também os gráficos de mensagens por hora do dia e por dia da semana, e os cartões de horário de pico e dia mais movimentado.",
  },
  {
    data: "2026-09-26",
    titulo: "Análise: Excel com o recorte no nome e gráfico por hora completo",
    categoria: "melhoria",
    descricao:
      "O Excel da Análise agora traz o autor e o período no nome do arquivo, como o PDF. O gráfico de mensagens por hora mostra todas as 24 horas, girando os rótulos em tela estreita para não sobrepor. A tela já desabilitava o botão sem mensagens; agora quem acessa o endereço do Excel direto recebe um erro 404 em vez de uma planilha só com cabeçalhos.",
  },
  {
    data: "2026-09-26",
    titulo: "PDF da Análise: gráficos deixam de sair em branco",
    categoria: "correcao",
    descricao:
      "Ao salvar a Análise em PDF, os gráficos (por dia, por hora e por dia da semana) saíam vazios; só os cartões e a lista de autores apareciam. Agora os gráficos saem completos.",
  },
  {
    data: "2026-09-28",
    titulo: "Conversas: CSV e Excel com o recorte no nome",
    categoria: "melhoria",
    descricao:
      "O CSV e o Excel de Conversas agora trazem o autor, o período e a busca no nome do arquivo, como o Excel da Análise. A tela já desabilitava os botões sem mensagens; agora quem acessa o endereço direto recebe um erro 404 em vez de um arquivo só com cabeçalhos.",
  },
];

/** `CHANGELOG` (ou outra lista, nos testes) da mais recente para a mais antiga, sem alterar o original. */
export function changelogOrdenado(entradas: EntradaChangelog[] = CHANGELOG): EntradaChangelog[] {
  return [...entradas].sort((a, b) => b.data.localeCompare(a.data));
}
