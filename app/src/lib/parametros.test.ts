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
});
