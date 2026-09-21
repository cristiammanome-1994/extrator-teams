import path from "node:path";
import { describe, expect, it } from "vitest";
import { estaDentro } from "./caminhos";

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
