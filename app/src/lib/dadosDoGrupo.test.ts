import { describe, expect, it } from "vitest";
import { selecionarDadosDoGrupo } from "./dadosDoGrupo";

describe("selecionarDadosDoGrupo", () => {
  const dados = { grupoId: 1, total: 3 };

  it("devolve o mesmo objeto quando o dado é do grupo atual", () => {
    expect(selecionarDadosDoGrupo(dados, 1)).toBe(dados);
  });

  it("devolve undefined quando o dado é de outro grupo", () => {
    expect(selecionarDadosDoGrupo(dados, 2)).toBeUndefined();
  });

  it("devolve undefined quando não há grupo atual", () => {
    expect(selecionarDadosDoGrupo(dados, null)).toBeUndefined();
  });

  it("devolve undefined quando não há dado", () => {
    expect(selecionarDadosDoGrupo(undefined, 1)).toBeUndefined();
  });
});
