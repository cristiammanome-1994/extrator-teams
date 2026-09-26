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

  it("distribui por hora (24 posições) e acha a hora de pico, com empate na mais cedo", () => {
    const k = calcularKpis([
      { autor: "Ana", dataHora: "2026-09-08T09:00" },
      { autor: "Ana", dataHora: "2026-09-08T09:59" },
      { autor: "Bruno", dataHora: "2026-09-08T14:30" },
      { autor: "Bruno", dataHora: "2026-09-09T14:00" },
      { autor: "Bruno", dataHora: "2026-09-09T00:05" },
    ]);
    expect(k.porHora).toHaveLength(24);
    expect(k.porHora[0]).toEqual({ hora: 0, total: 1 });
    expect(k.porHora[9].total).toBe(2);
    expect(k.porHora[14].total).toBe(2);
    expect(k.porHora[23].total).toBe(0);
    expect(k.horaPico).toBe(9);
  });

  it("distribui por dia da semana de segunda a domingo", () => {
    // 2026-09-07 é segunda, 2026-09-13 é domingo.
    const k = calcularKpis([
      { autor: "Ana", dataHora: "2026-09-07T10:00" },
      { autor: "Ana", dataHora: "2026-09-07T11:00" },
      { autor: "Bruno", dataHora: "2026-09-13T10:00" },
    ]);
    expect(k.porDiaSemana.map((d) => d.dia)).toEqual([
      "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo",
    ]);
    expect(k.porDiaSemana[0].total).toBe(2);
    expect(k.porDiaSemana[6].total).toBe(1);
    expect(k.porDiaSemana.reduce((s, d) => s + d.total, 0)).toBe(3);
  });

  it("acha o dia do calendário mais movimentado, com empate no mais antigo", () => {
    const k = calcularKpis([
      { autor: "Ana", dataHora: "2026-09-08T10:00" },
      { autor: "Ana", dataHora: "2026-09-09T10:00" },
      { autor: "Ana", dataHora: "2026-09-09T11:00" },
      { autor: "Ana", dataHora: "2026-09-10T10:00" },
      { autor: "Ana", dataHora: "2026-09-10T11:00" },
    ]);
    expect(k.diaMaisMovimentado).toEqual({ dia: "2026-09-09", total: 2 });
  });

  it("data sem hora válida não cai em nenhuma hora (nem infla a meia-noite)", () => {
    const k = calcularKpis([
      { autor: "Ana", dataHora: "2026-09-08" },
      { autor: "Ana", dataHora: "2026-09-08Tab:cd" },
      { autor: "Ana", dataHora: "2026-09-08T25:00" },
      { autor: "Ana", dataHora: "2026-09-08T09:00" },
    ]);
    expect(k.porHora[0].total).toBe(0);
    expect(k.porHora.reduce((s, h) => s + h.total, 0)).toBe(1);
    expect(k.horaPico).toBe(9);
    expect(k.porHora).toHaveLength(24);
  });

  it("sem mensagem datada não há pico, mas as séries continuam com o tamanho fixo", () => {
    const k = calcularKpis([{ autor: "Ana", dataHora: null }]);
    expect(k.horaPico).toBeNull();
    expect(k.diaMaisMovimentado).toBeNull();
    expect(k.porHora).toHaveLength(24);
    expect(k.porDiaSemana).toHaveLength(7);
  });
});
