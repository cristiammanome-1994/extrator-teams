import { describe, expect, it } from "vitest";
import { destinoSeguro } from "./destino";

const ORIGEM = "http://127.0.0.1:51794";

describe("destinoSeguro", () => {
  it.each([
    ["/", "/"],
    ["/conversas", "/conversas"],
    ["/conversas?x=1", "/conversas?x=1"],
  ])("mantém o caminho interno válido %j", (de, esperado) => {
    expect(destinoSeguro(de, ORIGEM)).toBe(esperado);
  });

  it.each([[null], [""]])("cai para / quando ausente (%j)", (de) => {
    expect(destinoSeguro(de, ORIGEM)).toBe("/");
  });

  it.each([
    ["//evil.com"],
    ["/\t/evil.com"],
    ["/\n/evil.com"],
    ["/\\evil.com"],
    ["\\evil.com"],
    ["https://evil.com"],
    ["javascript:alert(1)"],
  ])("recusa destino que sai do app: %j", (de) => {
    expect(destinoSeguro(de, ORIGEM)).toBe("/");
  });

  it.each([["/login"], ["/login?de=%2F"], ["/login/"]])(
    "nunca volta para a tela de login: %j",
    (de) => {
      expect(destinoSeguro(de, ORIGEM)).toBe("/");
    }
  );

  it("nunca leva a uma URL de API", () => {
    expect(destinoSeguro("/api/exportacoes", ORIGEM)).toBe("/");
  });

  // O parser normaliza dot-segments: o pathname resultante pode começar com
  // "//", que o router trata como protocol-relative (outro site).
  it.each([["/.//evil.com"], ["/a/..//evil.com"], ["/../..//evil.com"]])(
    "recusa dot-segments que normalizam para //: %j",
    (de) => {
      expect(destinoSeguro(de, ORIGEM)).toBe("/");
    }
  );

  // O parser mantém %2F e %5C codificados, então o resultado é um caminho
  // interno inofensivo e pode ser devolvido como está.
  it.each([["/%2F/evil.com"], ["/%2f/evil.com"], ["/%5Cevil.com"], ["/%09/evil.com"]])(
    "mantém codificações inofensivas como caminho interno: %j",
    (de) => {
      expect(destinoSeguro(de, ORIGEM)).toBe(de);
    }
  );
});

describe("destinoSeguro: invariante de origem", () => {
  const ADVERSARIAS = [
    "//evil.com",
    "///evil.com",
    "/\t/evil.com",
    "/\n/evil.com",
    "/\r/evil.com",
    "\t//evil.com",
    "/\\evil.com",
    "\\\\evil.com",
    "/.//evil.com",
    "/a/..//evil.com",
    "/../..//evil.com",
    "/%2F/evil.com",
    "/%09/evil.com",
    "/%5Cevil.com",
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "https://evil.com",
    "http://127.0.0.1:51794.evil.com/",
    "/login?de=//evil.com",
  ];

  // A invariante real: seja qual for a entrada, resolver o resultado a partir
  // da tela de login nunca sai da origem do app.
  it.each(ADVERSARIAS.map((de) => [de]))("resultado para %j fica na origem", (de) => {
    const r = destinoSeguro(de, ORIGEM);
    expect(new URL(r, `${ORIGEM}/login`).origin).toBe(ORIGEM);
  });
});
