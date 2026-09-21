import path from "node:path";
import { describe, expect, it } from "vitest";
import { lerConfigExportacao } from "./config";

const base = path.resolve("/proj/app");
const raiz = path.resolve("/proj");

describe("lerConfigExportacao", () => {
  it("usa padrões relativos à pasta app/", () => {
    const c = lerConfigExportacao({}, base);
    expect(c.cwd).toBe(raiz);
    expect(c.script).toBe(path.join(raiz, "teams_chat_export.py"));
    expect(c.exportsDir).toBe(path.join(raiz, "exports"));
    expect(c.python).toBe(
      path.join(raiz, process.platform === "win32" ? ".venv/Scripts/python.exe" : ".venv/bin/python")
    );
    expect(c.timeoutMs).toBe(30 * 60_000);
  });

  it("variáveis vazias contam como ausentes", () => {
    const c = lerConfigExportacao({ TEAMS_PYTHON: "", TEAMS_SCRIPT: "", EXTRATOR_TIMEOUT_MIN: "" }, base);
    expect(c.script).toBe(path.join(raiz, "teams_chat_export.py"));
    expect(c.timeoutMs).toBe(30 * 60_000);
  });

  it("aceita sobrescritas (caminhos relativos partem de app/)", () => {
    const c = lerConfigExportacao(
      { TEAMS_PYTHON: "C:\\py\\python.exe", TEAMS_SCRIPT: "../outro.py", EXTRATOR_TIMEOUT_MIN: "5" },
      base
    );
    expect(c.python).toBe(path.resolve(base, "C:\\py\\python.exe"));
    expect(c.script).toBe(path.resolve(base, "../outro.py"));
    expect(c.timeoutMs).toBe(5 * 60_000);
  });

  describe("EXTRATOR_EXPORTS_DIR", () => {
    it("sem a variavel, a pasta continua sendo <raiz>/exports", () => {
      expect(lerConfigExportacao({}, base).exportsDir).toBe(path.join(raiz, "exports"));
    });

    it("caminho absoluto sobrescreve a pasta", () => {
      const abs = path.resolve("/tmp/outra-pasta");
      expect(lerConfigExportacao({ EXTRATOR_EXPORTS_DIR: abs }, base).exportsDir).toBe(abs);
    });

    it("caminho relativo parte de app/", () => {
      expect(lerConfigExportacao({ EXTRATOR_EXPORTS_DIR: "../saidas" }, base).exportsDir).toBe(path.resolve(base, "../saidas"));
    });

    it("variavel vazia conta como ausente", () => {
      expect(lerConfigExportacao({ EXTRATOR_EXPORTS_DIR: "" }, base).exportsDir).toBe(path.join(raiz, "exports"));
    });
  });
});
