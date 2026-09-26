import type { LinhaKpi } from "@/types/dominio";

export interface Kpis {
  total: number;
  autores: number;
  /** Mensagens cuja data não foi interpretável; contam no total mas não nas séries. */
  semData: number;
  primeiraData: string | null;
  ultimaData: string | null;
  /** Dias corridos entre a primeira e a última mensagem, inclusive. */
  dias: number;
  /** Mensagens com data ÷ `dias`. */
  mediaPorDia: number;
  porAutor: { autor: string; total: number }[];
  porDia: { dia: string; total: number }[];
  /**
   * Sempre 24 posições (0 a 23), com zeros. Hora como o Teams mostrou, sem conversão de fuso.
   * Mensagem cuja data não traz hora válida não entra em nenhuma posição (a soma pode ficar
   * abaixo de `total - semData`).
   */
  porHora: { hora: number; total: number }[];
  /** Sempre 7 posições, de segunda a domingo, com zeros. */
  porDiaSemana: { dia: string; total: number }[];
  /** Hora com mais mensagens; empate fica com a mais cedo. `null` sem nenhuma mensagem datada. */
  horaPico: number | null;
  /** Dia do calendário com mais mensagens; empate fica com o mais antigo. */
  diaMaisMovimentado: { dia: string; total: number } | null;
}

export const NOMES_DIA_SEMANA = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"] as const;

/** Segunda = 0 … domingo = 6, a partir de `AAAA-MM-DD` (sem fuso: só a data do calendário). */
function indiceDiaSemana(dia: string): number {
  return (new Date(`${dia}T00:00:00Z`).getUTCDay() + 6) % 7;
}

/** Posição do maior valor; empate fica com a primeira. `null` se todos forem zero. */
function indiceDoMaior(totais: number[]): number | null {
  let melhor = -1;
  let indice: number | null = null;
  totais.forEach((total, i) => {
    if (total > melhor && total > 0) {
      melhor = total;
      indice = i;
    }
  });
  return indice;
}

const MS_POR_DIA = 24 * 60 * 60 * 1000;

function diasEntre(inicio: string, fim: string): number {
  const a = Date.parse(`${inicio}T00:00:00Z`);
  const b = Date.parse(`${fim}T00:00:00Z`);
  return Math.round((b - a) / MS_POR_DIA) + 1;
}

export function calcularKpis(linhas: LinhaKpi[]): Kpis {
  const porAutor = new Map<string, number>();
  const porDia = new Map<string, number>();
  const porHora = new Array<number>(24).fill(0);
  const porDiaSemana = new Array<number>(7).fill(0);
  let semData = 0;

  for (const l of linhas) {
    porAutor.set(l.autor, (porAutor.get(l.autor) ?? 0) + 1);
    if (!l.dataHora) {
      semData++;
      continue;
    }
    const dia = l.dataHora.slice(0, 10);
    porDia.set(dia, (porDia.get(dia) ?? 0) + 1);
    // Só conta na hora quando ela existe e é válida: `Number("")` daria 0 e inflaria a meia-noite.
    const hora = /^\d{4}-\d{2}-\d{2}T(\d{2})/.exec(l.dataHora)?.[1];
    if (hora !== undefined && Number(hora) < 24) porHora[Number(hora)]++;
    porDiaSemana[indiceDiaSemana(dia)]++;
  }

  const dias = [...porDia.keys()].sort();
  const primeiraData = dias[0] ?? null;
  const ultimaData = dias[dias.length - 1] ?? null;
  const span = primeiraData && ultimaData ? diasEntre(primeiraData, ultimaData) : 0;
  const totaisPorDia = dias.map((d) => porDia.get(d)!);
  const iMaisMovimentado = indiceDoMaior(totaisPorDia);

  return {
    total: linhas.length,
    autores: porAutor.size,
    semData,
    primeiraData,
    ultimaData,
    dias: span,
    mediaPorDia: span > 0 ? (linhas.length - semData) / span : 0,
    porAutor: [...porAutor.entries()]
      .map(([autor, total]) => ({ autor, total }))
      .sort((a, b) => b.total - a.total || a.autor.localeCompare(b.autor, "pt-BR")),
    porDia: dias.map((dia) => ({ dia, total: porDia.get(dia)! })),
    porHora: porHora.map((total, hora) => ({ hora, total })),
    porDiaSemana: porDiaSemana.map((total, i) => ({ dia: NOMES_DIA_SEMANA[i], total })),
    horaPico: indiceDoMaior(porHora),
    diaMaisMovimentado: iMaisMovimentado === null ? null : { dia: dias[iMaisMovimentado], total: totaisPorDia[iMaisMovimentado] },
  };
}
