import { realpathSync, statSync } from "node:fs";
import path from "node:path";

/**
 * `alvo` está estritamente dentro de `base`? Usa `path.relative`, que no
 * Windows ignora diferença de maiúsculas na letra do drive — um `startsWith`
 * simples falharia com `c:\` contra `C:\`.
 */
export function estaDentro(base: string, alvo: string): boolean {
  const relativo = path.relative(path.resolve(base), path.resolve(alvo));
  return relativo !== "" && !relativo.startsWith("..") && !path.isAbsolute(relativo);
}

/**
 * Caminho REAL do arquivo `alvo` se — e só se — ele é um arquivo comum dentro de `base`; senão `null`.
 *
 * A checagem léxica (`estaDentro`) sozinha não basta: uma junction ou symlink dentro de `base` que aponta
 * para fora passaria por ela. Por isso o alvo e a base são resolvidos com `realpath` (que segue
 * links e expande nomes 8.3 do Windows) e a comparação é refeita sobre os caminhos reais.
 * A checagem léxica vem ANTES, sem tocar o disco: um caminho UNC vindo de um registro adulterado
 * (`\\servidor\share\...`) faria o `realpath` abrir uma conexão SMB para fora da máquina.
 */
export function resolverArquivoDentro(base: string, alvo: string): string | null {
  try {
    if (!estaDentro(base, alvo)) return null;
    const baseReal = realpathSync.native(base);
    const alvoReal = realpathSync.native(alvo);
    if (!estaDentro(baseReal, alvoReal) || !statSync(alvoReal).isFile()) return null;
    return alvoReal;
  } catch {
    // Não existe, byte NUL, sem permissão, link quebrado ou em laço: para quem pede é tudo "não há".
    return null;
  }
}

/** Atributo `attr-char` do RFC 5987: `encodeURIComponent` deixa passar `'()*`, que aqui precisam ser codificados. */
function codificarRfc5987(texto: string): string {
  return encodeURIComponent(texto).replace(/['()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
}

/**
 * Valor de `Content-Disposition` seguro para um nome de arquivo qualquer. O `filename` só leva
 * ASCII inócuo (o resto vira `_`): aspas, barras, CR/LF ou caracteres acima de 255 quebrariam ou
 * injetariam o cabeçalho (`new Response` lança em valor que não é ByteString). O nome verdadeiro
 * segue em `filename*`, codificado em UTF-8, quando difere da versão ASCII.
 */
export function cabecalhoDisposicao(nome: string): string {
  const seguro = nome.replace(/[^A-Za-z0-9._ -]/g, "_");
  const base = `attachment; filename="${seguro}"`;
  return seguro === nome ? base : `${base}; filename*=UTF-8''${codificarRfc5987(nome.toWellFormed())}`;
}
