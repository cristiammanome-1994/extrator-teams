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
