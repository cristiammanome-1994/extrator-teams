import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NOME_COOKIE_SESSAO, criarValorSessao } from "@/lib/auth/sessao";
import { config, proxy } from "./proxy";

const HOST = "127.0.0.1:51794";
const BASE = "http://" + HOST;
const SENHA = "senha-de-teste-do-proxy";
const DIRETORIO_API = path.join(import.meta.dirname, "app", "api");

interface RotaApi {
  arquivo: string;
  caminho: string;
  metodo: string;
}

/**
 * Descobre as rotas de API pelo sistema de arquivos: uma rota nova entra no
 * teste sem que ninguém precise lembrar de registrá-la aqui.
 */
function descobrirRotas(): RotaApi[] {
  const rotas: RotaApi[] = [];
  const arquivos = readdirSync(DIRETORIO_API, { recursive: true, encoding: "utf8" });
  for (const relativo of arquivos) {
    const normalizado = relativo.split(path.sep).join("/");
    if (!/(^|\/)route\.ts$/.test(normalizado)) continue;
    const pasta = normalizado.replace(/\/?route\.ts$/, "");
    const caminho = "/api" + (pasta ? "/" + pasta.replace(/\[[^\]]+\]/g, "1") : "");
    const fonte = readFileSync(path.join(DIRETORIO_API, relativo), "utf8");
    const metodos = new Set<string>();
    for (const m of fonte.matchAll(/export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\b/g)) metodos.add(m[1]);
    for (const m of fonte.matchAll(/export\s+const\s+(GET|POST|PUT|PATCH|DELETE)\b/g)) metodos.add(m[1]);
    for (const metodo of metodos) rotas.push({ arquivo: normalizado, caminho, metodo });
  }
  return rotas;
}

// A função é interna do Next e não tem tipos publicados; o Next a usa no build para gerar o regexp do
// manifesto a partir de `config.matcher`.
const { getMiddlewareMatchers } = (await import("next/dist/build/analysis/get-page-static-info")) as unknown as {
  getMiddlewareMatchers(matchers: string[], nextConfig: object): { regexp: string }[];
};

const rotas = descobrirRotas();
const arquivosDeRota = new Set(rotas.map((r) => r.arquivo));
const PUBLICA = "/api/auth/login";
const protegidas = rotas.filter((r) => r.caminho !== PUBLICA);

/**
 * O Next reescreve hosts de loopback para "localhost" em `nextUrl`; o cabeçalho Host (que o servidor
 * real sempre recebe) preserva o que o navegador usou. O teste o informa como o servidor faria.
 */
function requisicao(caminho: string, metodo = "GET", cabecalhos: Record<string, string> = {}) {
  return new NextRequest(BASE + caminho, { method: metodo, headers: { host: HOST, ...cabecalhos } });
}

const comCookie = (valor: string) => ({ cookie: `${NOME_COOKIE_SESSAO}=${valor}` });
const passou = (resposta: Response) => resposta.headers.get("x-middleware-next") === "1";

const ambienteOriginal = { senha: process.env.EXTRATOR_SENHA, segredo: process.env.EXTRATOR_SEGREDO_SESSAO };
let cookieValido: string;

beforeAll(async () => {
  delete process.env.EXTRATOR_SEGREDO_SESSAO;
  process.env.EXTRATOR_SENHA = SENHA;
  cookieValido = await criarValorSessao();
});

afterAll(() => {
  for (const [nome, valor] of [
    ["EXTRATOR_SENHA", ambienteOriginal.senha],
    ["EXTRATOR_SEGREDO_SESSAO", ambienteOriginal.segredo],
  ] as const) {
    if (valor === undefined) delete process.env[nome];
    else process.env[nome] = valor;
  }
});

describe("descoberta das rotas de API", () => {
  it("encontra todas as rotas conhecidas (não passa no vazio)", () => {
    expect(arquivosDeRota.size).toBeGreaterThanOrEqual(9);
    expect([...arquivosDeRota].sort()).toEqual(
      expect.arrayContaining([
        "analise/route.ts",
        "auth/login/route.ts",
        "exportacoes/[id]/cancelar/route.ts",
        "exportacoes/[id]/download/route.ts",
        "exportacoes/[id]/route.ts",
        "exportacoes/route.ts",
        "grupos/route.ts",
        "importar/route.ts",
        "mensagens/route.ts",
      ])
    );
    expect(rotas.length).toBeGreaterThanOrEqual(10);
    expect(rotas.filter((r) => r.caminho === PUBLICA).map((r) => r.metodo).sort()).toEqual(["DELETE", "POST"]);
    expect(rotas.every((r) => !r.caminho.includes("["))).toBe(true);
  });
});

describe("autenticação de todas as rotas de API", () => {
  it.each(protegidas.map((r) => [r.metodo, r.caminho] as const))(
    "%s %s sem cookie responde 401 NAO_AUTENTICADO",
    async (metodo, caminho) => {
      const resposta = await proxy(requisicao(caminho, metodo));
      expect(resposta.status).toBe(401);
      expect(passou(resposta)).toBe(false);
      expect(await resposta.json()).toMatchObject({ error: { code: "NAO_AUTENTICADO" } });
    }
  );

  it.each(rotas.filter((r) => r.caminho === PUBLICA).map((r) => [r.metodo, r.caminho] as const))(
    "%s %s (pública) passa sem cookie",
    async (metodo, caminho) => {
      const resposta = await proxy(requisicao(caminho, metodo));
      expect(resposta.status).not.toBe(401);
      expect(passou(resposta)).toBe(true);
    }
  );

  it.each(rotas.map((r) => [r.metodo, r.caminho] as const))("%s %s com cookie válido passa", async (metodo, caminho) => {
    const resposta = await proxy(requisicao(caminho, metodo, comCookie(cookieValido)));
    expect(passou(resposta)).toBe(true);
  });
});

describe("cookies inválidos em rota protegida", () => {
  const alvo = "/api/exportacoes";

  async function esperar401(valor: string) {
    const resposta = await proxy(requisicao(alvo, "GET", comCookie(valor)));
    expect(resposta.status).toBe(401);
    expect(await resposta.json()).toMatchObject({ error: { code: "NAO_AUTENTICADO" } });
  }

  it("assinatura adulterada", async () => {
    const ultimo = cookieValido.slice(-1);
    await esperar401(cookieValido.slice(0, -1) + (ultimo === "0" ? "1" : "0"));
  });

  it("prazo adulterado com a assinatura antiga", async () => {
    const [, assinatura] = cookieValido.split(".");
    await esperar401(`${Date.now() + 10 * 24 * 3600 * 1000}.${assinatura}`);
  });

  it("cookie expirado", async () => {
    await esperar401(await criarValorSessao(Date.now() - 8 * 24 * 3600 * 1000));
  });

  it("cookie assinado com outra senha", async () => {
    process.env.EXTRATOR_SENHA = "outra-senha-qualquer";
    const alheio = await criarValorSessao();
    process.env.EXTRATOR_SENHA = SENHA;
    await esperar401(alheio);
  });

  it("cookie vazio", async () => {
    await esperar401("");
  });

  it("uma rota de API que não existe, sem cookie, também dá 401 (barreira por exceção)", async () => {
    const resposta = await proxy(requisicao("/api/nao-existe"));
    expect(resposta.status).toBe(401);
    expect(await resposta.json()).toMatchObject({ error: { code: "NAO_AUTENTICADO" } });
  });
});

describe("páginas", () => {
  it.each([
    ["/", "%2F"],
    ["/conversas", "%2Fconversas"],
  ])("%s sem cookie redireciona (307) para /login?de=%s", async (caminho, de) => {
    const resposta = await proxy(requisicao(caminho));
    expect(resposta.status).toBe(307);
    const destino = new URL(resposta.headers.get("location")!);
    expect(destino.pathname + destino.search).toBe(`/login?de=${de}`);
  });

  it("/login passa sem cookie", async () => {
    expect(passou(await proxy(requisicao("/login")))).toBe(true);
  });

  it("uma página com cookie válido passa", async () => {
    expect(passou(await proxy(requisicao("/conversas", "GET", comCookie(cookieValido))))).toBe(true);
  });
});

describe("origem das requisições que alteram estado", () => {
  const ORIGEM_ESTRANHA = "http://localhost:3000";

  async function esperar403(resposta: Response | Promise<Response>) {
    const r = await resposta;
    expect(r.status).toBe(403);
    expect(passou(r)).toBe(false);
    expect(await r.json()).toMatchObject({
      error: { code: "ORIGEM_INVALIDA", message: "Origem da requisição não permitida." },
    });
  }

  it("POST com origem de outra porta e cookie válido é barrado (403)", async () => {
    await esperar403(proxy(requisicao("/api/exportacoes", "POST", { ...comCookie(cookieValido), origin: ORIGEM_ESTRANHA })));
  });

  it("POST com a mesma origem passa", async () => {
    const resposta = await proxy(requisicao("/api/exportacoes", "POST", { ...comCookie(cookieValido), origin: BASE }));
    expect(passou(resposta)).toBe(true);
  });

  it("POST sem Origin passa (curl, servidor a servidor): a sessão continua sendo exigida", async () => {
    expect(passou(await proxy(requisicao("/api/exportacoes", "POST", comCookie(cookieValido))))).toBe(true);
    expect((await proxy(requisicao("/api/exportacoes", "POST"))).status).toBe(401);
  });

  it.each(["null", "lixo", "http://", ""])("POST com Origin malformado (%j) é barrado", async (origem) => {
    await esperar403(proxy(requisicao("/api/exportacoes", "POST", { ...comCookie(cookieValido), origin: origem })));
  });

  it("o POST de login com origem estranha também é barrado", async () => {
    await esperar403(proxy(requisicao("/api/auth/login", "POST", { origin: ORIGEM_ESTRANHA })));
    expect(passou(await proxy(requisicao("/api/auth/login", "POST", { origin: BASE })))).toBe(true);
  });

  it.each(["PUT", "PATCH", "DELETE"])("%s com origem estranha é barrado", async (metodo) => {
    await esperar403(proxy(requisicao("/api/exportacoes/1", metodo, { ...comCookie(cookieValido), origin: ORIGEM_ESTRANHA })));
  });

  it("origem com outro esquema ou host também conta como estranha", async () => {
    for (const origem of ["https://127.0.0.1:51794", "http://localhost:51794", "http://127.0.0.1:51795"]) {
      await esperar403(proxy(requisicao("/api/exportacoes", "POST", { ...comCookie(cookieValido), origin: origem })));
    }
  });

  it("sem cabeçalho Host, cai no host da URL (já normalizado pelo Next para localhost)", async () => {
    const semHost = (origem: string) =>
      new NextRequest(BASE + "/api/exportacoes", {
        method: "POST",
        headers: { ...comCookie(cookieValido), origin: origem },
      });
    expect(passou(await proxy(semHost("http://localhost:51794")))).toBe(true);
    await esperar403(proxy(semHost(ORIGEM_ESTRANHA)));
  });

  it("GET com origem estranha só depende da autenticação", async () => {
    const ok = await proxy(requisicao("/api/grupos", "GET", { ...comCookie(cookieValido), origin: ORIGEM_ESTRANHA }));
    expect(passou(ok)).toBe(true);
    const semCookie = await proxy(requisicao("/api/grupos", "GET", { origin: ORIGEM_ESTRANHA }));
    expect(semCookie.status).toBe(401);
  });

  it("HEAD e OPTIONS com origem estranha não são afetados", async () => {
    for (const metodo of ["HEAD", "OPTIONS"]) {
      const r = await proxy(requisicao("/api/grupos", metodo, { ...comCookie(cookieValido), origin: ORIGEM_ESTRANHA }));
      expect(passou(r), metodo).toBe(true);
    }
  });
});

describe("matcher do proxy (avaliado pela mesma função que o Next usa no build)", () => {
  // `getMiddlewareMatchers` é a função interna do Next que transforma `config.matcher` no regexp
  // gravado no manifesto e usado em runtime; avaliá-la evita reimplementar path-to-regexp à mão.
  const [{ regexp }] = getMiddlewareMatchers(config.matcher, {});
  const re = new RegExp(regexp);

  it("intercepta as rotas de API e as páginas", () => {
    for (const p of ["/", "/login", "/conversas", "/api/exportacoes", "/api/exportacoes/1/download", "/api/nao-existe"]) {
      expect(re.test(p), p).toBe(true);
    }
  });

  it("dispensa só os recursos estáticos", () => {
    for (const p of ["/_next/static/a.js", "/_next/image", "/favicon.ico", "/logo.png", "/x/foto.webp"]) {
      expect(re.test(p), p).toBe(false);
    }
  });

  it("LIMITAÇÃO CONHECIDA: um caminho de API que termina em extensão de imagem escapa do proxy", () => {
    // Nenhuma rota atual tem esse formato, mas uma rota dinâmica futura (`/api/x.png`) nasceria sem
    // proteção. Documenta o comportamento atual; se o matcher for corrigido, inverta esta asserção.
    expect(re.test("/api/x.png")).toBe(false);
  });
});
