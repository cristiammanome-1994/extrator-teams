import { describe, expect, it } from "vitest";
import {
  formatarDataHora,
  formatarDia,
  formatarDuracao,
  formatarNumero,
  rotuloHora,
  rotuloIntervaloHora,
} from "./formatacao";

describe("formatação", () => {
  it("formata data/hora ISO local e cai no original quando não há ISO", () => {
    expect(formatarDataHora("2026-09-08T11:09", "x")).toBe("08/09/2026 11:09");
    expect(formatarDataHora(null, "terça, sem data")).toBe("terça, sem data");
  });

  it("formata dia e número em pt-BR", () => {
    expect(formatarDia("2026-09-08")).toBe("08/09/2026");
    expect(formatarNumero(1527)).toBe("1.527");
  });

  it("formata duração", () => {
    expect(formatarDuracao("2026-09-21T10:00:00.000Z", "2026-09-21T10:00:42.000Z")).toBe("42 s");
    expect(formatarDuracao("2026-09-21T10:00:00.000Z", "2026-09-21T10:03:05.000Z")).toBe("3 min 5 s");
  });
});

describe("rotuloHora e rotuloIntervaloHora", () => {
  it("formata a hora com dois dígitos e a faixa de uma hora", () => {
    expect(rotuloHora(9)).toBe("09h");
    expect(rotuloIntervaloHora(9)).toBe("09h – 10h");
  });

  it("a faixa da última hora do dia termina à meia-noite", () => {
    expect(rotuloIntervaloHora(23)).toBe("23h – 00h");
  });
});
