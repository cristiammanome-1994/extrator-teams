import { describe, expect, it } from "vitest";
import { ETAPAS, indiceDaEtapa } from "./etapas";

describe("etapas", () => {
  it("mantém a ordem do fluxo do script", () => {
    expect(ETAPAS.map((e) => e.id)).toEqual([
      "aguardando_login",
      "login_concluido",
      "procurando_grupo",
      "grupo_aberto",
      "lendo_historico",
      "salvando",
    ]);
  });

  it("indiceDaEtapa: 'iniciando' fica antes de todas", () => {
    expect(indiceDaEtapa("iniciando")).toBe(-1);
    expect(indiceDaEtapa("aguardando_login")).toBe(0);
    expect(indiceDaEtapa("salvando")).toBe(5);
  });
});
