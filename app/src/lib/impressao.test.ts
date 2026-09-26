import { describe, expect, it } from "vitest";
import { nomeArquivoPdf } from "./impressao";

const dia = new Date(2026, 8, 26);

describe("nomeArquivoPdf", () => {
  it("normaliza título e referência e anexa a data", () => {
    expect(nomeArquivoPdf("Análise", "Grupo | Exportação", dia)).toBe("Analise-Grupo-Exportacao-2026-09-26");
  });

  it("funciona sem referência", () => {
    expect(nomeArquivoPdf("Análise", undefined, dia)).toBe("Analise-2026-09-26");
  });

  it("omite o recorte que não rende slug, sem deixar hífen duplo", () => {
    expect(nomeArquivoPdf("Análise", "🚀", dia)).toBe("Analise-2026-09-26");
    expect(nomeArquivoPdf("Análise", "|||", dia)).toBe("Analise-2026-09-26");
  });
});
