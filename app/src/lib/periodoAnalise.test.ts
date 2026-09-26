import { describe, expect, it } from "vitest";
import { atalhoAtivo, contarFiltrosAnalise, periodoDoAtalho, PERIODO_VAZIO } from "./periodoAnalise";

describe("periodoDoAtalho", () => {
  it("termina na última mensagem e inclui o próprio dia (7 dias = 6 antes + o último)", () => {
    expect(periodoDoAtalho("7", "2025-02-11")).toEqual({ de: "2025-02-05", ate: "2025-02-11" });
  });

  it("atravessa mês e ano", () => {
    expect(periodoDoAtalho("30", "2026-01-15")).toEqual({ de: "2025-12-17", ate: "2026-01-15" });
    expect(periodoDoAtalho("90", "2026-03-01")).toEqual({ de: "2025-12-02", ate: "2026-03-01" });
  });

  it("considera o ano bissexto", () => {
    expect(periodoDoAtalho("7", "2024-03-02")).toEqual({ de: "2024-02-25", ate: "2024-03-02" });
  });

  it("'tudo' e a falta de data de referência não recortam nada", () => {
    expect(periodoDoAtalho("tudo", "2026-01-15")).toEqual(PERIODO_VAZIO);
    expect(periodoDoAtalho("30", null)).toEqual(PERIODO_VAZIO);
  });
});

describe("atalhoAtivo", () => {
  const ultima = "2026-01-15";

  it("reconhece o período de cada atalho e o vazio como 'tudo'", () => {
    expect(atalhoAtivo(PERIODO_VAZIO, ultima)).toBe("tudo");
    expect(atalhoAtivo(periodoDoAtalho("30", ultima), ultima)).toBe("30");
  });

  it("datas digitadas à mão não acendem nenhum atalho", () => {
    expect(atalhoAtivo({ de: "2026-01-01", ate: "2026-01-15" }, ultima)).toBeNull();
    expect(atalhoAtivo({ de: "2026-01-01", ate: "" }, ultima)).toBeNull();
  });
});

describe("contarFiltrosAnalise", () => {
  it("conta período (um só, mesmo com de e até) e autor", () => {
    expect(contarFiltrosAnalise(PERIODO_VAZIO, "")).toBe(0);
    expect(contarFiltrosAnalise({ de: "2026-01-01", ate: "2026-01-02" }, "")).toBe(1);
    expect(contarFiltrosAnalise({ de: "", ate: "2026-01-02" }, "Ana")).toBe(2);
  });
});
