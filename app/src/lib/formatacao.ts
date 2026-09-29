export function formatarNumero(n: number): string {
  return new Intl.NumberFormat("pt-BR").format(n);
}

/** ISO local (`2026-09-08T11:09`) para `08/09/2026 11:09`; sem ISO, devolve o texto original do Teams. */
export function formatarDataHora(iso: string | null, original: string): string {
  if (!iso) return original;
  const [data, hora] = iso.split("T");
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano} ${hora}`;
}

/** `2026-09-08` para `08/09/2026`. */
export function formatarDia(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

/**
 * Recorte de um filtro em partes de texto (`autor: Ana`, `de 08/09/2026`, `até 09/09/2026`,
 * `busca: "reunião"`), o que a referência do PDF e o nome do Excel/CSV mostram. Só entra o que foi
 * filtrado. `texto` é a busca de Conversas; a Análise não tem caixa de busca na tela, mas `lerFiltros`
 * é compartilhado, então um `q=` na URL entra do mesmo jeito — o nome do arquivo passa a dizer a
 * verdade sobre o filtro, já que `texto` também filtra os dados exportados (`montarWhere`).
 */
export function partesDoRecorte({
  autor,
  de,
  ate,
  texto,
}: {
  autor?: string;
  de?: string;
  ate?: string;
  texto?: string;
}): string[] {
  return [
    autor && `autor: ${autor}`,
    de && `de ${formatarDia(de)}`,
    ate && `até ${formatarDia(ate)}`,
    texto && `busca: "${texto}"`,
  ].filter((p): p is string => Boolean(p));
}

/** Instante ISO (UTC) para data e hora locais. */
export function formatarInstante(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function formatarDuracao(inicioIso: string, fimIso: string | null): string {
  const ms = (fimIso ? Date.parse(fimIso) : Date.now()) - Date.parse(inicioIso);
  const segundos = Math.max(0, Math.round(ms / 1000));
  const minutos = Math.floor(segundos / 60);
  return minutos > 0 ? `${minutos} min ${segundos % 60} s` : `${segundos} s`;
}

/** Hora cheia como `09h`. */
export function rotuloHora(hora: number): string {
  return `${String(hora).padStart(2, "0")}h`;
}

/** Faixa de uma hora cheia, como `09h – 10h` (a de 23h termina em `00h`). */
export function rotuloIntervaloHora(hora: number): string {
  return `${rotuloHora(hora)} – ${rotuloHora((hora + 1) % 24)}`;
}
