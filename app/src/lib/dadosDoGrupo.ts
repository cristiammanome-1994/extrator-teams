/**
 * O cache de `useRecursoRemoto` guarda o último dado por endpoint (sem a query), então logo após trocar de
 * grupo o dado "anterior" pertence ao grupo antigo. Só o dado do grupo atual pode ser exibido.
 */
export function selecionarDadosDoGrupo<T extends { grupoId: number }>(
  dados: T | undefined,
  grupoId: number | null
): T | undefined {
  if (dados === undefined || grupoId === null) return undefined;
  return dados.grupoId === grupoId ? dados : undefined;
}
