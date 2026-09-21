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
});
