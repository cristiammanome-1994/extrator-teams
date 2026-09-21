import { beforeEach, describe, expect, it } from "vitest";
import {
  JANELA_MS,
  MAX_TENTATIVAS,
  ORIGEM_LOCAL,
  limparTudo,
  registrarFalha,
  registrarSucesso,
  verificarLimite,
} from "./limiteTentativas";

beforeEach(() => limparTudo());

describe("limite de tentativas", () => {
  it("bloqueia depois de MAX_TENTATIVAS falhas seguidas", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < MAX_TENTATIVAS - 1; i++) registrarFalha(ORIGEM_LOCAL, t0);
    expect(verificarLimite(ORIGEM_LOCAL, t0).bloqueado).toBe(false);
    registrarFalha(ORIGEM_LOCAL, t0);
    const limite = verificarLimite(ORIGEM_LOCAL, t0);
    expect(limite.bloqueado).toBe(true);
    expect(limite.segundosParaLiberar).toBeGreaterThan(0);
  });

  it("a janela expira sozinha", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < MAX_TENTATIVAS; i++) registrarFalha(ORIGEM_LOCAL, t0);
    expect(verificarLimite(ORIGEM_LOCAL, t0 + JANELA_MS + 1).bloqueado).toBe(false);
  });

  it("um login bem-sucedido zera o contador", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < MAX_TENTATIVAS - 1; i++) registrarFalha(ORIGEM_LOCAL, t0);
    registrarSucesso(ORIGEM_LOCAL);
    expect(verificarLimite(ORIGEM_LOCAL, t0).restantes).toBe(MAX_TENTATIVAS);
  });
});
