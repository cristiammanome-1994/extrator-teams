import { describe, expect, it } from "vitest";
import { changelogOrdenado, type EntradaChangelog } from "./changelog";

function entrada(data: string, titulo: string): EntradaChangelog {
  return { data, titulo, categoria: "novidade", descricao: "..." };
}

describe("changelogOrdenado", () => {
  it("ordena da mais recente para a mais antiga", () => {
    const entradas = [entrada("2026-01-01", "primeira"), entrada("2026-09-22", "ultima"), entrada("2026-05-10", "meio")];
    expect(changelogOrdenado(entradas).map((e) => e.titulo)).toEqual(["ultima", "meio", "primeira"]);
  });

  it("não muda a lista original", () => {
    const entradas = [entrada("2026-01-01", "a"), entrada("2026-09-22", "b")];
    changelogOrdenado(entradas);
    expect(entradas.map((e) => e.titulo)).toEqual(["a", "b"]);
  });

  it("sem argumento, ordena o próprio CHANGELOG do app", () => {
    const ordenado = changelogOrdenado();
    expect(ordenado.length).toBeGreaterThan(0);
    for (let i = 1; i < ordenado.length; i++) {
      expect(ordenado[i - 1].data >= ordenado[i].data).toBe(true);
    }
  });
});
