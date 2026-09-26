/**
 * Nomes de arquivo derivados de texto do Teams (nome de grupo), compartilhados pela exportação
 * (CSV/XLSX, via cabeçalho HTTP) e pelo "Salvar em PDF" (via `document.title`). Um só slug, para o
 * mesmo grupo dar o mesmo nome nos dois.
 */

/**
 * Só letras e dígitos ASCII, sem acento, separados por hífen: nada de barra, `..`, aspas ou quebra
 * de linha, que virariam caminho ou injeção de cabeçalho. Vazio quando nada sobra (ex.: só símbolos).
 */
export function slugArquivo(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

/** Data local no formato AAAA-MM-DD. */
export function sufixoData(hoje: Date): string {
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
}

/**
 * Nome do arquivo baixado: `<grupo>[-<recorte>]-<data>.<extensão>`, com `exportacao` se o grupo não
 * render slug. O recorte tem o próprio slug, com o mesmo teto de 80 caracteres para o recorte inteiro:
 * isso protege o filtro de um nome de grupo comprido, mas quem monta o recorte deve encurtar partes
 * longas (como o autor) para o período não ser cortado.
 */
export function nomeArquivoExportacao(
  base: string,
  extensao: "csv" | "xlsx",
  hoje: Date = new Date(),
  recorte = ""
): string {
  const partes = [slugArquivo(base) || "exportacao", slugArquivo(recorte), sufixoData(hoje)].filter(Boolean);
  return `${partes.join("-")}.${extensao}`;
}
