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
  let semData = 0;

  for (const l of linhas) {
    porAutor.set(l.autor, (porAutor.get(l.autor) ?? 0) + 1);
    if (!l.dataHora) {
      semData++;
      continue;
    }
    const dia = l.dataHora.slice(0, 10);
    porDia.set(dia, (porDia.get(dia) ?? 0) + 1);
  }

  const dias = [...porDia.keys()].sort();
  const primeiraData = dias[0] ?? null;
  const ultimaData = dias[dias.length - 1] ?? null;
  const span = primeiraData && ultimaData ? diasEntre(primeiraData, ultimaData) : 0;

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
  };
}
