export const TAMANHO_MAXIMO_GRUPO = 200;

export type ResultadoGrupo = { ok: true; nome: string } | { ok: false; motivo: string };

/**
 * O nome vai para a linha de comando do script (sem shell, então não é
 * interpretado) e para a busca do Teams. Recusa o que não é texto de uma
 * linha só.
 */
export function validarGrupo(bruto: unknown): ResultadoGrupo {
  if (typeof bruto !== "string") return { ok: false, motivo: "Informe o nome do grupo." };
  const nome = bruto.trim();
  if (nome.length === 0) return { ok: false, motivo: "Informe o nome do grupo." };
  if (nome.length > TAMANHO_MAXIMO_GRUPO) {
    return { ok: false, motivo: `O nome do grupo deve ter no máximo ${TAMANHO_MAXIMO_GRUPO} caracteres.` };
  }
  if (/[\u0000-\u001f\u007f]/.test(nome)) {
    return { ok: false, motivo: "O nome do grupo tem caracteres inválidos." };
  }
  return { ok: true, nome };
}
