import { describe, expect, it } from "vitest";
import { dataIso, inteiro, lerFiltros, limitar } from "./parametros";

describe("parâmetros de consulta", () => {
  it("inteiro só aceita número inteiro", () => {
    expect(inteiro("12")).toBe(12);
    expect(inteiro("1.5")).toBeNull();
    expect(inteiro("abc")).toBeNull();
    expect(inteiro("")).toBeNull();
    expect(inteiro(null)).toBeNull();
  });

  it("inteiro só aceita inteiros decimais não negativos, seguros e em ASCII", () => {
    expect(inteiro("0")).toBe(0);
    expect(inteiro("007")).toBe(7);
    expect(inteiro(String(Number.MAX_SAFE_INTEGER))).toBe(Number.MAX_SAFE_INTEGER);
    for (const ruim of [
      "1e3",
      "0x10",
      "0b11",
      " 12 ",
      "12 ",
      String.fromCharCode(10) + "12",
      "-1",
      "+1",
      "1.5",
      "1.0",
      "Infinity",
      "99999999999999999999",
      String(Number.MAX_SAFE_INTEGER + 1),
      String.fromCharCode(0xff11, 0xff12), // dígitos de largura total
      String.fromCharCode(0x661, 0x662), // dígitos arábico-índicos
    ]) {
      expect(inteiro(ruim), JSON.stringify(ruim)).toBeNull();
    }
  });

  it("dataIso só aceita AAAA-MM-DD", () => {
    expect(dataIso("2026-09-08")).toBe("2026-09-08");
    expect(dataIso("08/09/2026")).toBeUndefined();
    expect(dataIso(null)).toBeUndefined();
  });

  it("limitar respeita o intervalo e cai no padrão", () => {
    expect(limitar(500, 10, 200, 50)).toBe(200);
    expect(limitar(1, 10, 200, 50)).toBe(10);
    expect(limitar(null, 10, 200, 50)).toBe(50);
  });

  it("lerFiltros exige grupoId e ignora valores inválidos", () => {
    expect(lerFiltros(new URLSearchParams(""))).toEqual({ erro: "Informe o grupo (grupoId)." });
    expect(lerFiltros(new URLSearchParams("grupoId=3&autor=Ana&de=2026-09-01&ate=lixo&q=%20oi%20"))).toEqual({
      filtros: { grupoId: 3, autor: "Ana", de: "2026-09-01", ate: undefined, texto: "oi" },
    });
  });

  it("lerFiltros limita autor e texto a 200 caracteres", () => {
    const longo = "a".repeat(500);
    const r = lerFiltros(new URLSearchParams({ grupoId: "1", autor: longo, q: longo }));
    if ("erro" in r) throw new Error(r.erro);
    expect(r.filtros.autor).toBe("a".repeat(200));
    expect(r.filtros.texto).toBe("a".repeat(200));
  });

  it("lerFiltros recusa grupoId em notação que inteiro() rejeita", () => {
    for (const ruim of ["1e3", "-1", "0x10", "abc"]) {
      expect(lerFiltros(new URLSearchParams({ grupoId: ruim })), ruim).toEqual({ erro: "Informe o grupo (grupoId)." });
    }
  });
});
