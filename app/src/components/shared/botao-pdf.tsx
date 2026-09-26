"use client";

import { useCallback } from "react";
import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { nomeArquivoPdf } from "@/lib/impressao";

/**
 * Salva a tela atual em PDF pela impressão do próprio navegador.
 *
 * Por que não uma biblioteca: jsPDF + html2canvas rasterizam a página (o texto
 * vira imagem, o arquivo fica pesado, a tabela quebra mal) e somariam ~1 MB ao
 * bundle. A impressão nativa gera texto vetorial e respeita o layout; o que a
 * deixa apresentável são as regras `@media print` em `globals.css`.
 */
export function BotaoPdf({
  titulo,
  referencia,
  desabilitado,
}: {
  /** Vira o nome do arquivo e o cabeçalho impresso. Use o título da tela. */
  titulo: string;
  /** Recorte exibido (grupo, período); sem ele, PDFs de recortes diferentes teriam o mesmo nome. */
  referencia?: string;
  desabilitado?: boolean;
}) {
  const imprimir = useCallback(async () => {
    const tituloOriginal = document.title;
    // O navegador sugere o `document.title` como nome do arquivo.
    document.title = nomeArquivoPdf(titulo, referencia);

    // `attr()` em `body::before` lê do próprio body: os atributos vão nele, não no <html>.
    const corpo = document.body;
    corpo.dataset.tituloImpressao = referencia ? `${titulo} — ${referencia}` : titulo;
    corpo.dataset.dataImpressao = new Date().toLocaleString("pt-BR");

    // O Recharts grava a largura medida no SVG e não remede ao trocar para a mídia de impressão:
    // estreitar a página antes faz o ResizeObserver redesenhar o gráfico. Mas ele mede na mídia de
    // TELA, então o layout do preparo tem de ser o da folha: o CSS de `data-preparando-impressao`
    // (globals.css) também força 1 coluna nas `[data-grade-graficos]` e zera o padding do main.
    // Grade nova com gráfico, ou breakpoint novo (`lg:` etc.), precisa entrar nessa regra.
    document.documentElement.dataset.preparandoImpressao = "";
    window.dispatchEvent(new Event("resize"));

    // Dois quadros: um para o React reconciliar, outro para o Recharts redesenhar.
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

    // `afterprint` também dispara quando o diálogo é cancelado.
    window.addEventListener(
      "afterprint",
      () => {
        document.title = tituloOriginal;
        delete corpo.dataset.tituloImpressao;
        delete corpo.dataset.dataImpressao;
        delete document.documentElement.dataset.preparandoImpressao;
        window.dispatchEvent(new Event("resize"));
      },
      { once: true }
    );
    window.print();
  }, [titulo, referencia]);

  return (
    <Button
      variant="outline"
      size="icon-sm"
      onClick={() => void imprimir()}
      disabled={desabilitado}
      data-sem-impressao
      aria-label="Salvar esta tela em PDF"
      title="Salvar em PDF — abre o diálogo de impressão"
    >
      <FileDown className="size-4" />
    </Button>
  );
}
