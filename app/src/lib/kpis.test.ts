import { describe, expect, it } from "vitest";
import { calcularKpis } from "./kpis";

describe("calcularKpis", () => {
  it("conta total, autores, período e média por dia", () => {
    const k = calcularKpis([
      { autor: "Ana", dataHora: "2026-09-08T09:00" },
      { autor: "Ana", dataHora: "2026-09-08T10:00" },
      { autor: "Bruno", dataHora: "2026-09-10T09:00" },
      { autor: "Bruno", dataHora: null },
    ]);
    expect(k.total).toBe(4);
    expect(k.autores).toBe(2);
    expect(k.semData).toBe(1);
    expect(k.primeiraData).toBe("2026-09-08");
    expect(k.ultimaData).toBe("2026-09-10");
    expect(k.dias).toBe(3);
    expect(k.mediaPorDia).toBe(1); // 3 mensagens com data / 3 dias
    expect(k.porAutor).toEqual([
      { autor: "Ana", total: 2 },
      { autor: "Bruno", total: 2 },
    ]);
    expect(k.porDia).toEqual([
      { dia: "2026-09-08", total: 2 },
      { dia: "2026-09-10", total: 1 },
    ]);
  });

  it("ordena autores por total (desc) e depois por nome", () => {
    const k = calcularKpis([
      { autor: "Zé", dataHora: "2026-09-08T09:00" },
      { autor: "Ana", dataHora: "2026-09-08T09:01" },
      { autor: "Zé", dataHora: "2026-09-08T09:02" },
    ]);
    expect(k.porAutor.map((a) => a.autor)).toEqual(["Zé", "Ana"]);
  });

  it("lista vazia ou sem nenhuma data não quebra", () => {
    expect(calcularKpis([])).toMatchObject({ total: 0, autores: 0, dias: 0, mediaPorDia: 0, primeiraData: null });
    expect(calcularKpis([{ autor: "Ana", dataHora: null }])).toMatchObject({
      total: 1,
      semData: 1,
      dias: 0,
      mediaPorDia: 0,
      porDia: [],
    });
  });
});
