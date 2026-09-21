import { describe, expect, it } from "vitest";
import { interpretarDataHoraPt } from "./dataPt";

describe("interpretarDataHoraPt", () => {
  it("interpreta o formato do Teams", () => {
    expect(interpretarDataHoraPt("terça-feira, 8 de setembro de 2026 11:09")).toBe("2026-09-08T11:09");
    expect(interpretarDataHoraPt("segunda-feira, 20 de outubro de 2025 15:12")).toBe("2025-10-20T15:12");
  });

  it("aceita março com e sem cedilha (\\w do JS não casa 'ç')", () => {
    expect(interpretarDataHoraPt("domingo, 1 de março de 2026 09:05")).toBe("2026-03-01T09:05");
    expect(interpretarDataHoraPt("domingo, 1 de marco de 2026 09:05")).toBe("2026-03-01T09:05");
  });

  it("ignora maiúsculas no mês", () => {
    expect(interpretarDataHoraPt("terça-feira, 8 de SETEMBRO de 2026 11:09")).toBe("2026-09-08T11:09");
  });

  it("devolve null para texto que não é data, mês desconhecido ou data impossível", () => {
    expect(interpretarDataHoraPt("sem data")).toBeNull();
    expect(interpretarDataHoraPt("terça, 8 de setembr de 2026 11:09")).toBeNull();
    expect(interpretarDataHoraPt("sábado, 31 de fevereiro de 2026 11:09")).toBeNull();
    expect(interpretarDataHoraPt("terça, 8 de setembro de 2026 25:09")).toBeNull();
  });
});
