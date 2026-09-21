import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DURACAO_SESSAO_MS,
  autenticacaoConfigurada,
  criarValorSessao,
  senhaConfere,
  sessaoEhValida,
} from "./sessao";

const SENHA = "senha-de-teste";

beforeEach(() => {
  process.env.EXTRATOR_SENHA = SENHA;
  delete process.env.EXTRATOR_SEGREDO_SESSAO;
});

afterEach(() => {
  delete process.env.EXTRATOR_SENHA;
  delete process.env.EXTRATOR_SEGREDO_SESSAO;
});

describe("senha", () => {
  it("aceita a certa e recusa a errada", () => {
    expect(senhaConfere(SENHA)).toBe(true);
    expect(senhaConfere("outra")).toBe(false);
  });

  it("não aceita vazia nem prefixo da correta", () => {
    expect(senhaConfere("")).toBe(false);
    expect(senhaConfere("senha")).toBe(false);
  });

  it("sem EXTRATOR_SENHA nada é aceito", () => {
    delete process.env.EXTRATOR_SENHA;
    expect(autenticacaoConfigurada()).toBe(false);
    expect(senhaConfere("")).toBe(false);
    expect(senhaConfere(SENHA)).toBe(false);
  });
});

describe("cookie de sessão", () => {
  it("um cookie recém-criado é válido", async () => {
    expect(await sessaoEhValida(await criarValorSessao())).toBe(true);
  });

  it("recusa ausente ou sem formato", async () => {
    expect(await sessaoEhValida(undefined)).toBe(false);
    expect(await sessaoEhValida("")).toBe(false);
    expect(await sessaoEhValida("qualquer-coisa")).toBe(false);
    expect(await sessaoEhValida(".semprazo")).toBe(false);
  });

  it("recusa expirado", async () => {
    const agora = Date.now();
    const valor = await criarValorSessao(agora);
    expect(await sessaoEhValida(valor, agora + DURACAO_SESSAO_MS - 1000)).toBe(true);
    expect(await sessaoEhValida(valor, agora + DURACAO_SESSAO_MS + 1000)).toBe(false);
  });

  it("recusa assinatura adulterada", async () => {
    const [prazo, assinatura] = (await criarValorSessao()).split(".");
    const trocada = assinatura.slice(0, -1) + (assinatura.endsWith("a") ? "b" : "a");
    expect(await sessaoEhValida(`${prazo}.${trocada}`)).toBe(false);
  });

  it("recusa prazo esticado sem reassinar", async () => {
    const valor = await criarValorSessao();
    const assinatura = valor.slice(valor.lastIndexOf(".") + 1);
    const futuro = String(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000);
    expect(await sessaoEhValida(`${futuro}.${assinatura}`)).toBe(false);
  });

  it("trocar a senha derruba as sessões abertas", async () => {
    const valor = await criarValorSessao();
    process.env.EXTRATOR_SENHA = "senha-nova";
    expect(await sessaoEhValida(valor)).toBe(false);
  });

  it("com segredo próprio, trocar a senha não derruba a sessão", async () => {
    process.env.EXTRATOR_SEGREDO_SESSAO = "segredo-fixo";
    const valor = await criarValorSessao();
    process.env.EXTRATOR_SENHA = "senha-nova";
    expect(await sessaoEhValida(valor)).toBe(true);
  });
});
