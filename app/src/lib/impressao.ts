import { slugArquivo, sufixoData } from "./nomeArquivo";

/**
 * Nome sugerido ao navegador ao salvar o PDF. O navegador usa o `document.title` como nome do
 * arquivo, então ele é trocado durante a impressão (e restaurado depois), senão toda tela salvaria
 * com o mesmo nome. Partes que não rendem slug (título ou recorte só com símbolos) são omitidas.
 */
export function nomeArquivoPdf(titulo: string, referencia?: string, hoje: Date = new Date()): string {
  return [slugArquivo(titulo), referencia ? slugArquivo(referencia) : "", sufixoData(hoje)].filter(Boolean).join("-");
}
