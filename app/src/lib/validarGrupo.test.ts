import { describe, expect, it } from "vitest";
import { validarGrupo } from "./validarGrupo";

describe("validarGrupo", () => {
  it("aceita um nome normal e apara espaços", () => {
    expect(validarGrupo("  Projetos | CAPAG - Etapa 4 - SaaS  ")).toEqual({
      ok: true,
      nome: "Projetos | CAPAG - Etapa 4 - SaaS",
    });
  });

  it("recusa não-texto, vazio e só espaços", () => {
    expect(validarGrupo(undefined).ok).toBe(false);
    expect(validarGrupo(42).ok).toBe(false);
    expect(validarGrupo("").ok).toBe(false);
    expect(validarGrupo("   ").ok).toBe(false);
  });

  it("recusa mais de 200 caracteres", () => {
    expect(validarGrupo("a".repeat(200)).ok).toBe(true);
    expect(validarGrupo("a".repeat(201)).ok).toBe(false);
  });

  it("recusa caracteres de controle", () => {
    expect(validarGrupo("a\nb").ok).toBe(false);
    expect(validarGrupo("a\u0000b").ok).toBe(false);
  });
});
