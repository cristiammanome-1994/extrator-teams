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
