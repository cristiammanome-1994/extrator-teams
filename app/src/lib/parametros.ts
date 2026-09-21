import type { FiltrosMensagens } from "@/types/dominio";

/**
 * Só decimal simples: dígitos ASCII, sem sinal, espaço, expoente, prefixo (`0x`) nem ponto. `Number()`
 * aceitaria `"1e3"`, `"0x10"` e `" 12 "`. Acima de 2^53 o valor perderia precisão, então também é recusado.
 */
export function inteiro(valor: string | null): number | null {
  if (valor === null || !/^[0-9]+$/.test(valor)) return null;
  const n = Number(valor);
  return Number.isSafeInteger(n) ? n : null;
}

/** Só `AAAA-MM-DD`; qualquer outra coisa é ignorada em vez de virar erro. */
export function dataIso(valor: string | null): string | undefined {
  return valor && /^\d{4}-\d{2}-\d{2}$/.test(valor) ? valor : undefined;
}

export function limitar(n: number | null, minimo: number, maximo: number, padrao: number): number {
  if (n === null) return padrao;
  return Math.min(maximo, Math.max(minimo, n));
}

/** Filtros de mensagens a partir da query string, compartilhados por /api/mensagens e /api/analise. */
export function lerFiltros(params: URLSearchParams): { filtros: FiltrosMensagens } | { erro: string } {
  const grupoId = inteiro(params.get("grupoId"));
  if (grupoId === null) return { erro: "Informe o grupo (grupoId)." };
  const autor = params.get("autor")?.trim().slice(0, 200);
  const texto = params.get("q")?.trim().slice(0, 200);
  return {
    filtros: {
      grupoId,
      autor: autor || undefined,
      de: dataIso(params.get("de")),
      ate: dataIso(params.get("ate")),
      texto: texto || undefined,
    },
  };
}
