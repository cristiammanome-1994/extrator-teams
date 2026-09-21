const MESES: Record<string, number> = {
  janeiro: 1,
  fevereiro: 2,
  março: 3,
  marco: 3,
  abril: 4,
  maio: 5,
  junho: 6,
  julho: 7,
  agosto: 8,
  setembro: 9,
  outubro: 10,
  novembro: 11,
  dezembro: 12,
};

// `\p{L}` e não `\w`: em JS o `\w` só casa ASCII e deixaria "março" de fora.
const PADRAO = /,\s*(\d{1,2})\s+de\s+(\p{L}+)\s+de\s+(\d{4})\s+(\d{1,2}):(\d{2})/u;

const dois = (n: number) => String(n).padStart(2, "0");

/**
 * Converte o texto de data do Teams ("terça-feira, 8 de setembro de 2026
 * 11:09") em ISO local sem fuso (`2026-09-08T11:09`). Devolve `null` quando o
 * texto não é uma data interpretável — o chamador guarda o original.
 */
export function interpretarDataHoraPt(original: string): string | null {
  const m = PADRAO.exec(original);
  if (!m) return null;

  const dia = Number(m[1]);
  const mes = MESES[m[2].toLowerCase()];
  const ano = Number(m[3]);
  const hora = Number(m[4]);
  const minuto = Number(m[5]);
  if (!mes || hora > 23 || minuto > 59) return null;

  // Rejeita datas que só existem no papel (31 de fevereiro).
  const teste = new Date(Date.UTC(ano, mes - 1, dia));
  if (teste.getUTCFullYear() !== ano || teste.getUTCMonth() !== mes - 1 || teste.getUTCDate() !== dia) {
    return null;
  }

  return `${ano}-${dois(mes)}-${dois(dia)}T${dois(hora)}:${dois(minuto)}`;
}
