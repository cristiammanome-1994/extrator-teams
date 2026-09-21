import path from "node:path";
import { describe, expect, it } from "vitest";
import { cabecalhoDisposicao, estaDentro } from "./caminhos";

const base = path.resolve("/tmp/x/exports");

describe("estaDentro", () => {
  it("aceita arquivo dentro da pasta base", () => {
    expect(estaDentro(base, path.join(base, "a.txt"))).toBe(true);
    expect(estaDentro(base, path.join(base, "sub", "a.txt"))).toBe(true);
  });

  it("recusa a própria pasta, irmãs e travessia com ..", () => {
    expect(estaDentro(base, base)).toBe(false);
    expect(estaDentro(base, path.resolve("/tmp/x/exports2/a.txt"))).toBe(false);
    expect(estaDentro(base, path.join(base, "..", "segredo.txt"))).toBe(false);
  });
});

describe("cabecalhoDisposicao", () => {
  it("nome simples: só filename entre aspas", () => {
    expect(cabecalhoDisposicao("Grupo A_2026.txt")).toBe('attachment; filename="Grupo A_2026.txt"');
  });

  it("aspas, barras, CR e LF nunca chegam ao valor do cabeçalho", () => {
    const barra = String.fromCharCode(92);
    const valor = cabecalhoDisposicao('a"b' + barra + "c\r\nSet-Cookie: x=1.txt");
    expect(valor).not.toMatch(/[\r\n\\]/);
    expect(valor.match(/"/g)).toHaveLength(2);
    expect(valor).toMatch(/^attachment; filename="[A-Za-z0-9._ -]+"; filename\*=UTF-8''[A-Za-z0-9%._-]+$/);
  });

  it("nome fora de ASCII: filename ASCII de reserva mais filename* em UTF-8", () => {
    const valor = cabecalhoDisposicao("Relatório – 日本.txt");
    expect(valor).toBe(`attachment; filename="Relat_rio _ __.txt"; filename*=UTF-8''${encodeURIComponent("Relatório – 日本.txt")}`);
    expect(() => new Headers({ "Content-Disposition": valor })).not.toThrow();
  });

  it("caracteres reservados do RFC 5987 são codificados e surrogate solto não lança", () => {
    expect(cabecalhoDisposicao("a'(b)*ç.txt")).toContain("filename*=UTF-8''a%27%28b%29%2A%C3%A7.txt");
    expect(() => cabecalhoDisposicao("a\ud800b.txt")).not.toThrow();
  });
});
