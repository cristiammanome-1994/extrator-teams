import { describe, expect, it } from "vitest";
import { interpretarLinha } from "./parseProgresso";

describe("interpretarLinha", () => {
  it.each([
    [">> Uma janela do navegador foi aberta.", { etapa: "aguardando_login" }],
    [">> Login detectado, continuando...", { etapa: "login_concluido" }],
    ['>> Procurando o grupo/chat "Projetos | CAPAG"...', { etapa: "procurando_grupo" }],
    [">> Lendo o histórico da conversa (isso pode levar alguns minutos em grupos grandes)...", { etapa: "lendo_historico" }],
  ])("%s", (linha, esperado) => {
    expect(interpretarLinha(linha)).toEqual(esperado);
  });

  it("extrai o grupo aberto", () => {
    expect(interpretarLinha('>> Abrindo: "Projetos | CAPAG - Etapa 4 - SaaSAline Neres, Amanda, +11"')).toEqual({
      etapa: "grupo_aberto",
      grupoAberto: "Projetos | CAPAG - Etapa 4 - SaaSAline Neres, Amanda, +11",
    });
  });

  it("extrai o contador parcial e o final", () => {
    expect(interpretarLinha("   ... 1527 mensagens únicas encontradas até agora (iteração 150)")).toEqual({
      contador: 1527,
    });
    expect(interpretarLinha(">> Total de mensagens únicas capturadas: 1527")).toEqual({ contador: 1527 });
  });

  it("extrai o caminho do .txt", () => {
    expect(interpretarLinha(">> Pronto! Arquivo salvo em: C:\\x\\exports\\Grupo_20260921_0923.txt")).toEqual({
      etapa: "salvando",
      arquivoTxt: "C:\\x\\exports\\Grupo_20260921_0923.txt",
    });
  });

  it("linhas desconhecidas ou vazias não geram evento", () => {
    expect(interpretarLinha("")).toBeNull();
    expect(interpretarLinha(">> JSON salvo em: C:\\x.json")).toBeNull();
    expect(interpretarLinha("RuntimeError: algo")).toBeNull();
  });
});
