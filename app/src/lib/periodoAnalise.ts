/**
 * Atalhos de período da tela Análise ("Últimos 30 dias" etc.).
 *
 * São relativos à ÚLTIMA MENSAGEM do grupo, não a hoje: um chat exportado com histórico antigo
 * ficaria vazio em "últimos 30 dias" se a conta partisse da data atual.
 */

export interface Periodo {
  de: string;
  ate: string;
}

export const PERIODO_VAZIO: Periodo = { de: "", ate: "" };

export const ATALHOS_PERIODO = [
  { id: "tudo", rotulo: "Tudo", dias: null },
  { id: "7", rotulo: "Últimos 7 dias", dias: 7 },
  { id: "30", rotulo: "Últimos 30 dias", dias: 30 },
  { id: "90", rotulo: "Últimos 90 dias", dias: 90 },
] as const;

export type IdAtalhoPeriodo = (typeof ATALHOS_PERIODO)[number]["id"];

const MS_POR_DIA = 24 * 60 * 60 * 1000;

function subtrairDias(dia: string, dias: number): string {
  return new Date(Date.parse(`${dia}T00:00:00Z`) - dias * MS_POR_DIA).toISOString().slice(0, 10);
}

/** Intervalo do atalho, terminando em `ultimaData` (`AAAA-MM-DD`). Sem data de referência, sem recorte. */
export function periodoDoAtalho(id: IdAtalhoPeriodo, ultimaData: string | null): Periodo {
  const atalho = ATALHOS_PERIODO.find((a) => a.id === id);
  if (!atalho || atalho.dias === null || !ultimaData) return PERIODO_VAZIO;
  return { de: subtrairDias(ultimaData, atalho.dias - 1), ate: ultimaData };
}

/** Qual atalho o período aplicado representa, para destacá-lo; `null` quando são datas digitadas. */
export function atalhoAtivo(periodo: Periodo, ultimaData: string | null): IdAtalhoPeriodo | null {
  if (!periodo.de && !periodo.ate) return "tudo";
  const achado = ATALHOS_PERIODO.find((a) => {
    const p = periodoDoAtalho(a.id, ultimaData);
    return a.dias !== null && p.de === periodo.de && p.ate === periodo.ate;
  });
  return achado?.id ?? null;
}

/** Quantos filtros da Análise estão fora do padrão; o período (de/até) conta como um só. */
export function contarFiltrosAnalise(periodo: Periodo, autor: string): number {
  return (periodo.de || periodo.ate ? 1 : 0) + (autor ? 1 : 0);
}
