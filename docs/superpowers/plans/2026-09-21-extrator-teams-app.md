# Extrator Teams — app web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir um app web local (Next.js) que dispara o `teams_chat_export.py`, guarda as mensagens em SQLite e oferece telas de Exportações, Conversas e Análise.

**Architecture:** Next.js fullstack (API routes como backend) na pasta `app/`. O script Python roda como processo filho; o progresso vem das linhas `>>` da saída e as mensagens vêm de um `.json` estruturado (`--json-out`). Regras de negócio ficam em funções puras em `app/src/lib/`, testadas com Vitest. Infra (auth, tema, shell, hooks) é copiada e adaptada do projeto Click Up.

**Tech Stack:** Next.js 16.3.2, React 19.2.8, TypeScript 5, Tailwind 4, shadcn/ui (`base-nova`), Recharts 3, `node:sqlite` (Node 24), Vitest 4, Playwright 1.62 (Edge), Python 3 + Playwright (script existente).

**Spec:** `docs/superpowers/specs/2026-09-21-extrator-teams-app-design.md`

## Global Constraints

- Tudo em `extrator_teams/`, que é um repositório git próprio (`origin` = `cristiammanome-1994/extrator-teams`, branch `main`). Rodar todos os comandos git a partir dessa pasta. **Não fazer push** sem o usuário pedir.
- App em `extrator_teams/app/`. Script, `.venv`, `teams_profile/` e `exports/` continuam na raiz.
- Servidor escuta só em `127.0.0.1`, porta **51794**. Sem Docker.
- Acesso por **login de senha única** com cookie assinado (`EXTRATOR_SENHA`, `EXTRATOR_SEGREDO_SESSAO`). Sem senha configurada, nenhum login é aceito. Todas as rotas exigem sessão, exceto `/login` e `/api/auth/login`.
- O script roda no **Microsoft Edge** (`channel="msedge"`). O app nunca lê, pede ou guarda credenciais do Teams.
- Versões do `package.json` copiadas do Click Up: `next` 16.3.2, `react`/`react-dom` 19.2.8, `@base-ui/react` ^1.7.0, `recharts` ^3.10.1, `lucide-react` ^1.34.0, `vitest` ^4.1.11, `@playwright/test` ^1.62.1, `typescript` ^5, `tailwindcss` ^4.
- Node 24+ (`node:sqlite` nativo). Banco em `app/data/extrator.db` (variável `EXTRATOR_DB` sobrescreve).
- Nome do grupo: não vazio, até 200 caracteres, sem caracteres de controle. `spawn` com lista de argumentos e **sem shell**.
- Upload de importação: só `.txt`, até 20 MB, processado em memória. Download só por id de execução; o caminho vem do banco e precisa estar dentro de `exports/`.
- Timeout de exportação: 30 min (`EXTRATOR_TIMEOUT_MIN`). Cancelar/timeout encerram a **árvore** de processos (`taskkill /T /F` no Windows).
- Uma exportação por vez (o `teams_profile` só aceita um Edge).
- Nunca commitar conteúdo de conversas: `exports/`, `chat_teams_*.txt`, `teams_profile/`, `.venv/`, `app/data/`, `.env*` já estão no `.gitignore`. Fixtures de teste são **sintéticas**, nunca trechos reais.
- Textos de interface em português do Brasil, com acentos. Mensagens de commit em português sem acentos, no estilo do Click Up, terminadas com a linha `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
- O `AGENTS.md` do Click Up avisa que o Next 16 tem mudanças de API. Antes de escrever código do `app/`, consultar `app/node_modules/next/dist/docs/` (proxy, route handlers, cookies) se algo divergir do que o plano mostra.

## Ajustes em relação ao spec (decididos ao detalhar o plano)

- **Lock de exportação única:** em vez de portar `lockSincronizacao`, a checagem é atômica no banco (`BEGIN IMMEDIATE` + existência de linha `em_andamento`). O comportamento é o mesmo e não depende de variável de módulo.
- **Tabela de conversas:** `Table` do shadcn com paginação no servidor, sem TanStack (filtro e paginação já são do backend).
- **Importar `.txt`:** cartão na própria tela Exportações, não um modal.
- **Porta:** fixa (51794) nos scripts; `EXTRATOR_PORTA` foi removida.
- **Selects:** `<select>` nativo estilizado (evita a API do Select do base-ui).
- **Versão do Next:** `next` e `eslint-config-next` acabaram em **16.3.5** (não 16.3.2, como escrito acima e no código da Task 2), porque o `npm audit` acusou duas falhas de RCE no 16.3.2, corrigidas nessa versão de patch. Decidido durante a Task 2; ver `docs/superpowers/specs/2026-09-21-extrator-teams-app-design.md`.
- **Hardening além do plano:** as Tasks 8–9 ganharam três passos extras de endurecimento (H1a: banco e orquestrador; H1b: rotas e proxy; H2: verificação em servidor real, `app/scripts/verificar-api.mjs`) para atender às validações explícitas pedidas pelo usuário (concorrência, timeout/cancelamento, órfãos, path traversal, limite real de upload, idempotência). Um passo de polimento visual (P1) também não estava no plano original.

## Estrutura de arquivos

```
teams_chat_export.py            (modificado: --json-out, build_json)
tests/test_build_json.py        (unittest do build_json)
scripts/{setup,start,stop}.ps1  iniciar.bat
app/
  package.json  tsconfig.json  next.config.ts  postcss.config.mjs  eslint.config.mjs
  vitest.config.mts  components.json  playwright.config.ts  .env.example  README.md
  e2e/smoke.spec.ts
  src/
    proxy.ts
    types/dominio.ts
    app/{layout.tsx,globals.css,error.tsx,page.tsx,login/page.tsx,conversas/page.tsx,analise/page.tsx}
    app/api/{auth/login,exportacoes,exportacoes/[id],exportacoes/[id]/cancelar,exportacoes/[id]/download,grupos,mensagens,analise,importar}/route.ts
    lib/{utils,api,formatacao,dataPt,parseTxt,parseProgresso,validarGrupo,kpis,importacao}.ts
    lib/auth/{sessao,limiteTentativas}.ts
    lib/db/{migracoes,conexao,repositorio}.ts
    lib/exportacao/{config,caminhos,encerrarArvore,orquestrador}.ts
    hooks/{cacheLru,useRecursoRemoto,useExportacoes}.ts(x)
    contexts/TemaContext.tsx
    components/{ui/*,layout/*,auth/login-view.tsx,states/*,shared/*,exportacoes/*,conversas/*,analise/*}
```

---

### Task 1: Flag `--json-out` no script Python

**Files:**
- Modify: `teams_chat_export.py` (funções `build_txt`, `main`; novas `sort_records`, `build_json`)
- Create: `tests/__init__.py`, `tests/test_build_json.py`

**Interfaces:**
- Produces: `build_json(group_name: str, records: list[dict], exported_at: datetime | None = None) -> dict` com chaves `grupo`, `exportado_em` (`YYYY-MM-DDTHH:MM:SS`), `mensagens` (lista de `{autor, data_hora_original, texto}`, em ordem cronológica). Flag CLI `--json-out CAMINHO`. O script imprime `>> JSON salvo em: <caminho>` antes de `>> Pronto! Arquivo salvo em: ...`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/__init__.py` vazio e `tests/test_build_json.py`:

```python
import datetime
import unittest

import teams_chat_export as t

TS_A = "terça-feira, 8 de setembro de 2026 11:09"
TS_B = "quarta-feira, 9 de setembro de 2026 08:30"


class BuildJsonTest(unittest.TestCase):
    def test_estrutura_e_campos(self):
        records = [{"author": "Ana", "timeTitle": TS_A, "text": "Oi"}]
        out = t.build_json("Meu grupo", records, datetime.datetime(2026, 9, 21, 9, 23))
        self.assertEqual(out["grupo"], "Meu grupo")
        self.assertEqual(out["exportado_em"], "2026-09-21T09:23:00")
        self.assertEqual(
            out["mensagens"],
            [{"autor": "Ana", "data_hora_original": TS_A, "texto": "Oi"}],
        )

    def test_autor_ausente_vira_desconhecido(self):
        records = [{"author": None, "timeTitle": TS_A, "text": "Oi"}]
        out = t.build_json("G", records)
        self.assertEqual(out["mensagens"][0]["autor"], "(desconhecido)")

    def test_ordem_cronologica_com_data_ilegivel_no_fim(self):
        records = [
            {"author": "B", "timeTitle": "sem data", "text": "3"},
            {"author": "B", "timeTitle": TS_B, "text": "2"},
            {"author": "A", "timeTitle": TS_A, "text": "1"},
        ]
        out = t.build_json("G", records)
        self.assertEqual([m["texto"] for m in out["mensagens"]], ["1", "2", "3"])


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `.venv\Scripts\python.exe -m unittest discover -s tests -t . -v`
Expected: FAIL com `AttributeError: module 'teams_chat_export' has no attribute 'build_json'`.

- [ ] **Step 3: Implementar**

Em `teams_chat_export.py`, substituir o começo de `build_txt`:

```python
def build_txt(group_name, records):
    def sort_key(r):
        dt = parse_pt_datetime(r["timeTitle"])
        return (dt is None, dt)

    records_sorted = sorted(records, key=sort_key)
```

por:

```python
def sort_records(records):
    """Ordena do mais antigo para o mais recente; datas ilegíveis vão para o fim."""
    def sort_key(r):
        dt = parse_pt_datetime(r["timeTitle"])
        return (dt is None, dt)

    return sorted(records, key=sort_key)


def build_json(group_name, records, exported_at=None):
    """Monta o conteúdo do --json-out: as mesmas mensagens do .txt, estruturadas.

    A data fica no texto original do Teams ("terça-feira, 8 de setembro de
    2026 11:09"); quem consome interpreta. Autor ausente vira "(desconhecido)".
    """
    exported_at = exported_at or datetime.datetime.now()
    return {
        "grupo": group_name,
        "exportado_em": exported_at.strftime("%Y-%m-%dT%H:%M:%S"),
        "mensagens": [
            {
                "autor": r["author"] or "(desconhecido)",
                "data_hora_original": r["timeTitle"],
                "texto": r["text"],
            }
            for r in sort_records(records)
        ],
    }


def build_txt(group_name, records):
    records_sorted = sort_records(records)
```

No `main()`, adicionar o argumento logo após `--headless`:

```python
    parser.add_argument("--json-out", default=None, help="Caminho de um .json com as mensagens estruturadas (além do .txt)")
```

e substituir:

```python
        out_path.write_text(txt, encoding="utf-8")
        print(f">> Pronto! Arquivo salvo em: {out_path}")
```

por:

```python
        out_path.write_text(txt, encoding="utf-8")

        if args.json_out:
            json_path = Path(args.json_out).expanduser().resolve()
            json_path.parent.mkdir(parents=True, exist_ok=True)
            json_path.write_text(
                json.dumps(build_json(args.group_name, records), ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
            print(f">> JSON salvo em: {json_path}")

        print(f">> Pronto! Arquivo salvo em: {out_path}")
```

- [ ] **Step 4: Rodar e ver passar**

Run: `.venv\Scripts\python.exe -m unittest discover -s tests -t . -v`
Expected: 3 testes `ok`.

- [ ] **Step 5: Commit**

```bash
git add teams_chat_export.py tests
git commit -m "Adiciona flag --json-out e build_json ao script de exportacao"
```

---

### Task 2: Esqueleto do app (`app/`)

**Files:**
- Create: `app/package.json`, `app/tsconfig.json`, `app/next.config.ts`, `app/postcss.config.mjs`, `app/eslint.config.mjs`, `app/vitest.config.mts`, `app/components.json`, `app/.env.example`
- Create: `app/src/app/globals.css`, `app/src/app/layout.tsx` (mínimo), `app/src/app/page.tsx` (provisória), `app/src/lib/utils.ts`, `app/src/lib/utils.test.ts`
- Create (cópia do Click Up): `app/src/components/ui/{alert,badge,button,card,input,skeleton,table}.tsx`

**Interfaces:**
- Produces: `cn(...inputs: ClassValue[]): string` em `@/lib/utils`; componentes shadcn em `@/components/ui/*`; alias `@/` → `app/src/`; scripts npm `dev`, `build`, `start`, `lint`, `test`, `test:e2e`.

- [ ] **Step 1: Criar `app/package.json`**

```json
{
  "name": "extrator-teams-app",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev -H 127.0.0.1 -p 51794",
    "build": "next build",
    "start": "next start -H 127.0.0.1 -p 51794",
    "lint": "eslint",
    "test": "vitest run",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "@base-ui/react": "^1.7.0",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "lucide-react": "^1.34.0",
    "next": "16.3.2",
    "react": "19.2.8",
    "react-dom": "19.2.8",
    "recharts": "^3.10.1",
    "server-only": "^0.0.1",
    "shadcn": "^4.19.0",
    "tailwind-merge": "^3.6.0",
    "tw-animate-css": "^1.4.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.62.1",
    "@tailwindcss/postcss": "^4",
    "@types/node": "^24.13.3",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "16.3.2",
    "tailwindcss": "^4",
    "typescript": "^5",
    "vitest": "^4.1.11"
  }
}
```

- [ ] **Step 2: Copiar as configs do Click Up (sem alteração) e criar as adaptadas**

```bash
SRC="C:/Users/Cristiam.Ieda/Desktop/Claude/Click Up"
cd app
cp "$SRC/tsconfig.json" "$SRC/postcss.config.mjs" "$SRC/components.json" "$SRC/vitest.config.mts" .
mkdir -p src/app src/lib src/components/ui
cp "$SRC/src/lib/utils.ts" src/lib/utils.ts
for f in alert badge button card input skeleton table; do cp "$SRC/src/components/ui/$f.tsx" src/components/ui/; done
sed -n '1,147p;688,698p' "$SRC/src/app/globals.css" > src/app/globals.css
```

Criar `app/eslint.config.mjs`:

```js
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

export default eslintConfig;
```

Criar `app/next.config.ts`:

```ts
import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Desativa o indicador flutuante de dev ("N") no canto da tela.
  devIndicators: false,
};

export default nextConfig;
```

Criar `app/.env.example`:

```
# Senha única de acesso ao painel. Sem ela o servidor recusa qualquer login —
# o painel nunca sobe aberto por esquecimento.
EXTRATOR_SENHA=troque-esta-senha

# Segredo que assina o cookie de sessão. Opcional: sem ele a assinatura usa a
# própria senha, e trocar a senha derruba as sessões abertas.
EXTRATOR_SEGREDO_SESSAO=

# Python do venv e script de exportação. Vazio = padrão relativo à pasta app/
# (../.venv/Scripts/python.exe e ../teams_chat_export.py).
TEAMS_PYTHON=
TEAMS_SCRIPT=

# Tempo máximo de uma exportação, em minutos (padrão 30).
EXTRATOR_TIMEOUT_MIN=30

# Caminho do banco SQLite. Vazio = app/data/extrator.db.
EXTRATOR_DB=
```

- [ ] **Step 3: Escrever o teste que falha (`app/src/lib/utils.test.ts`)**

```ts
import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("junta classes e resolve conflitos do Tailwind", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
    expect(cn("a", false && "b", "c")).toBe("a c");
  });
});
```

- [ ] **Step 4: Layout e página provisórios**

`app/src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Extrator Teams",
  description: "Exporta, lê e analisa conversas do Microsoft Teams",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-background">{children}</body>
    </html>
  );
}
```

`app/src/app/page.tsx`:

```tsx
export default function Page() {
  return <h1 className="p-6 text-xl font-semibold">Extrator Teams</h1>;
}
```

- [ ] **Step 5: Instalar, rodar teste, checar tipos e build**

Run (em `app/`): `npm install`
Run: `npx vitest run`
Expected: 1 teste passa.
Run: `npx tsc --noEmit`
Expected: sem erros (se os componentes `ui/*` reclamarem de import faltando, o erro aponta o arquivo; copiar do Click Up o que faltar).
Run: `npm run build`
Expected: build conclui e lista a rota `/`.

- [ ] **Step 6: Commit**

```bash
cd ..
git add app
git commit -m "Adiciona esqueleto do app Next.js (configs, tokens de tema e componentes ui)"
```

---

### Task 3: Autenticação por senha única

**Files:**
- Create: `app/src/lib/auth/sessao.ts`, `app/src/lib/auth/sessao.test.ts`, `app/src/lib/auth/limiteTentativas.ts`, `app/src/lib/auth/limiteTentativas.test.ts`
- Create: `app/src/proxy.ts`, `app/src/app/api/auth/login/route.ts`, `app/src/components/auth/login-view.tsx`, `app/src/app/login/page.tsx`

**Interfaces:**
- Produces: `NOME_COOKIE_SESSAO = "extrator_sessao"`, `DURACAO_SESSAO_MS`, `criarValorSessao(agora?)`, `sessaoEhValida(valor, agora?)`, `senhaConfere(informada)`, `autenticacaoConfigurada()`; `verificarLimite(origem)`, `registrarFalha(origem)`, `registrarSucesso(origem)`, `limparTudo()`, `ORIGEM_LOCAL`. Rotas: `POST /api/auth/login` (`{senha}`), `DELETE /api/auth/login` (sair). Erros no formato `{error:{code,message}}`.

- [ ] **Step 1: Escrever `app/src/lib/auth/sessao.test.ts` (falha)**

```ts
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
```

- [ ] **Step 2: Rodar e ver falhar**

Run (em `app/`): `npx vitest run src/lib/auth/sessao.test.ts`
Expected: FAIL (`Cannot find module './sessao'`).

- [ ] **Step 3: Criar `app/src/lib/auth/sessao.ts`**

```ts
/**
 * Sessão por senha única.
 *
 * O app expõe conversas corporativas e dispara um processo na máquina; uma
 * senha só, definida em `.env.local`, protege isso sem exigir cadastro de
 * usuários. Não há "usuário logado": o cookie só atesta que alguém sabia a
 * senha.
 *
 * Usa Web Crypto (`crypto.subtle`) e não `node:crypto`: este módulo é
 * carregado pelo proxy, que o Next pode executar fora do runtime Node.
 */

export const NOME_COOKIE_SESSAO = "extrator_sessao";

/** Uma semana: longo o bastante para não irritar, curto para um cookie vazado expirar. */
export const DURACAO_SESSAO_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * TextEncoder devolve `Uint8Array<ArrayBufferLike>`, que o tipo `BufferSource`
 * da Web Crypto não aceita — ele exige um ArrayBuffer concreto. A cópia
 * resolve o descasamento sem `any`.
 */
function codificar(texto: string): Uint8Array<ArrayBuffer> {
  const bytes = new TextEncoder().encode(texto);
  const copia = new Uint8Array(new ArrayBuffer(bytes.byteLength));
  copia.set(bytes);
  return copia;
}

function paraHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Segredo que assina o cookie. Cai para a própria senha quando
 * `EXTRATOR_SEGREDO_SESSAO` não está definido — assim o app funciona
 * configurando uma variável só; o efeito colateral é que trocar a senha
 * invalida as sessões abertas.
 */
function obterSegredo(): string {
  const segredo = process.env.EXTRATOR_SEGREDO_SESSAO || process.env.EXTRATOR_SENHA;
  if (!segredo) {
    throw new Error(
      "EXTRATOR_SENHA não está definida. Configure-a em app/.env.local (veja .env.example)."
    );
  }
  return segredo;
}

async function assinar(mensagem: string): Promise<string> {
  const chave = await crypto.subtle.importKey(
    "raw",
    codificar(obterSegredo()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return paraHex(await crypto.subtle.sign("HMAC", chave, codificar(mensagem)));
}

/**
 * Comparação em tempo constante: um `===` vaza, pelo tempo de resposta,
 * quantos caracteres iniciais estavam certos.
 */
function iguaisEmTempoConstante(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diferenca = 0;
  for (let i = 0; i < a.length; i++) diferenca |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diferenca === 0;
}

/** Valor do cookie: quando expira, mais a assinatura desse prazo. */
export async function criarValorSessao(agora = Date.now()): Promise<string> {
  const expiraEm = String(agora + DURACAO_SESSAO_MS);
  return `${expiraEm}.${await assinar(expiraEm)}`;
}

/** Cookie íntegro e dentro do prazo? */
export async function sessaoEhValida(valor: string | undefined, agora = Date.now()): Promise<boolean> {
  if (!valor) return false;
  const separador = valor.lastIndexOf(".");
  if (separador <= 0) return false;

  const expiraEm = valor.slice(0, separador);
  const assinatura = valor.slice(separador + 1);

  const prazo = Number(expiraEm);
  if (!Number.isFinite(prazo) || prazo <= agora) return false;

  return iguaisEmTempoConstante(assinatura, await assinar(expiraEm));
}

/** A senha informada confere? Também em tempo constante. */
export function senhaConfere(informada: string): boolean {
  const esperada = process.env.EXTRATOR_SENHA;
  if (!esperada) return false;
  return iguaisEmTempoConstante(informada, esperada);
}

/** Sem senha configurada o app não deve subir aberto por engano. */
export function autenticacaoConfigurada(): boolean {
  return Boolean(process.env.EXTRATOR_SENHA);
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/auth/sessao.test.ts`
Expected: 10 testes passam.

- [ ] **Step 5: Limite de tentativas — teste (falha) e implementação**

`app/src/lib/auth/limiteTentativas.test.ts`:

```ts
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
```

Rodar `npx vitest run src/lib/auth/limiteTentativas.test.ts` → FAIL. Criar `app/src/lib/auth/limiteTentativas.ts`:

```ts
/**
 * Limite de tentativas de login.
 *
 * O app só escuta em 127.0.0.1, então há uma única "origem" (`ORIGEM_LOCAL`).
 * Mesmo assim o bloqueio existe: encarece a varredura de senhas caso a porta
 * seja exposta na rede por engano.
 *
 * Só falhas contam, um login bem-sucedido zera o contador, e a janela expira
 * sozinha — nunca existe um estado "bloqueado" que alguém precise destravar.
 * O estado vive em memória: reiniciar o servidor zera tudo.
 */

export const MAX_TENTATIVAS = 10;
export const JANELA_MS = 5 * 60 * 1000;
export const ORIGEM_LOCAL = "local";

interface Registro {
  falhas: number;
  /** Quando a janela desta origem expira. */
  expiraEm: number;
}

const porOrigem = new Map<string, Registro>();

export interface ResultadoLimite {
  bloqueado: boolean;
  /** Quantas tentativas ainda restam antes de bloquear. */
  restantes: number;
  /** Segundos até a janela liberar; 0 quando não está bloqueado. */
  segundosParaLiberar: number;
}

/** A origem está liberada para tentar? Não altera o contador. */
export function verificarLimite(origem: string, agora = Date.now()): ResultadoLimite {
  const registro = porOrigem.get(origem);
  if (!registro || registro.expiraEm <= agora) {
    return { bloqueado: false, restantes: MAX_TENTATIVAS, segundosParaLiberar: 0 };
  }

  const bloqueado = registro.falhas >= MAX_TENTATIVAS;
  return {
    bloqueado,
    restantes: Math.max(0, MAX_TENTATIVAS - registro.falhas),
    segundosParaLiberar: bloqueado ? Math.ceil((registro.expiraEm - agora) / 1000) : 0,
  };
}

/** Conta uma falha; a janela é renovada a cada falha. */
export function registrarFalha(origem: string, agora = Date.now()): ResultadoLimite {
  const registro = porOrigem.get(origem);
  const falhas = registro && registro.expiraEm > agora ? registro.falhas + 1 : 1;
  porOrigem.set(origem, { falhas, expiraEm: agora + JANELA_MS });
  return verificarLimite(origem, agora);
}

/** Login aceito: a origem volta à estaca zero. */
export function registrarSucesso(origem: string): void {
  porOrigem.delete(origem);
}

/** Só para os testes: devolve o módulo ao estado inicial. */
export function limparTudo(): void {
  porOrigem.clear();
}
```

Rodar de novo → 3 testes passam.

- [ ] **Step 6: Proxy, rota de login, tela de login**

`app/src/proxy.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { NOME_COOKIE_SESSAO, sessaoEhValida } from "@/lib/auth/sessao";

/**
 * Barreira única do app: tudo exige sessão, exceto a tela de login e a rota
 * que a valida. Lista de exceções em vez de lista de protegidos, de
 * propósito — uma rota nova nasce protegida, e esquecer de registrá-la aqui
 * causa um login a mais, não um vazamento.
 */
const ROTAS_PUBLICAS = ["/login", "/api/auth/login"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (ROTAS_PUBLICAS.some((rota) => pathname === rota || pathname.startsWith(`${rota}/`))) {
    return NextResponse.next();
  }

  return verificar(request);
}

async function verificar(request: NextRequest) {
  const cookie = request.cookies.get(NOME_COOKIE_SESSAO)?.value;
  if (await sessaoEhValida(cookie)) return NextResponse.next();

  // API responde 401 em vez de redirecionar: um fetch que recebe o HTML da
  // tela de login quebra de um jeito difícil de diagnosticar.
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: { code: "NAO_AUTENTICADO", message: "Sessão expirada. Faça login novamente." } },
      { status: 401 }
    );
  }

  const destino = request.nextUrl.clone();
  destino.pathname = "/login";
  destino.searchParams.set("de", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(destino);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico)$).*)"],
};
```

`app/src/app/api/auth/login/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import {
  DURACAO_SESSAO_MS,
  NOME_COOKIE_SESSAO,
  autenticacaoConfigurada,
  criarValorSessao,
  senhaConfere,
} from "@/lib/auth/sessao";
import {
  ORIGEM_LOCAL,
  registrarFalha,
  registrarSucesso,
  verificarLimite,
} from "@/lib/auth/limiteTentativas";

export const dynamic = "force-dynamic";

/** Atraso fixo em toda tentativa, para desencorajar força bruta. */
const ATRASO_RESPOSTA_MS = 400;

export async function POST(request: NextRequest) {
  if (!autenticacaoConfigurada()) {
    return NextResponse.json(
      {
        error: {
          code: "SEM_SENHA_CONFIGURADA",
          message: "EXTRATOR_SENHA não está definida no servidor. Configure-a em app/.env.local.",
        },
      },
      { status: 500 }
    );
  }

  // Antes de ler o corpo e do atraso: uma origem bloqueada não deve nem custar
  // o processamento da tentativa.
  const limite = verificarLimite(ORIGEM_LOCAL);
  if (limite.bloqueado) {
    return NextResponse.json(
      {
        error: {
          code: "MUITAS_TENTATIVAS",
          message: `Muitas tentativas seguidas. Tente novamente em ${Math.ceil(limite.segundosParaLiberar / 60)} min.`,
        },
      },
      { status: 429, headers: { "Retry-After": String(limite.segundosParaLiberar) } }
    );
  }

  let senha = "";
  try {
    const corpo = (await request.json()) as { senha?: unknown };
    senha = typeof corpo.senha === "string" ? corpo.senha : "";
  } catch {
    senha = "";
  }

  await new Promise((resolve) => setTimeout(resolve, ATRASO_RESPOSTA_MS));

  if (!senhaConfere(senha)) {
    const apos = registrarFalha(ORIGEM_LOCAL);
    return NextResponse.json(
      {
        error: {
          code: "SENHA_INVALIDA",
          message:
            apos.restantes <= 3 && apos.restantes > 0
              ? apos.restantes === 1
                ? "Senha incorreta. Resta 1 tentativa."
                : `Senha incorreta. Restam ${apos.restantes} tentativas.`
              : "Senha incorreta.",
        },
      },
      { status: 401 }
    );
  }

  registrarSucesso(ORIGEM_LOCAL);
  const resposta = NextResponse.json({ ok: true });
  resposta.cookies.set({
    name: NOME_COOKIE_SESSAO,
    value: await criarValorSessao(),
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(DURACAO_SESSAO_MS / 1000),
    secure: request.nextUrl.protocol === "https:",
  });
  return resposta;
}

/** Sair: apaga o cookie. */
export async function DELETE() {
  const resposta = NextResponse.json({ ok: true });
  resposta.cookies.set({ name: NOME_COOKIE_SESSAO, value: "", path: "/", maxAge: 0 });
  return resposta;
}
```

`app/src/components/auth/login-view.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Download, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function LoginView() {
  const router = useRouter();
  const parametros = useSearchParams();
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function entrar(evento: React.FormEvent) {
    evento.preventDefault();
    setEnviando(true);
    setErro(null);
    try {
      const resposta = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senha }),
      });
      if (!resposta.ok) {
        const corpo = await resposta.json().catch(() => null);
        setErro(corpo?.error?.message ?? "Não foi possível entrar.");
        return;
      }
      // `de` vem do proxy; só aceito caminho interno para o parâmetro não
      // virar um redirecionamento aberto para fora do app.
      const de = parametros.get("de");
      const destino = de && de.startsWith("/") && !de.startsWith("//") ? de : "/";
      router.replace(destino);
      router.refresh();
    } catch {
      setErro("Falha de rede. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardContent className="space-y-6 pt-6">
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="flex size-10 items-center justify-center rounded bg-primary text-primary-foreground">
              <Download className="size-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Extrator Teams</h1>
              <p className="text-sm text-muted-foreground">Informe a senha de acesso</p>
            </div>
          </div>

          <form onSubmit={entrar} className="space-y-3">
            <Input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Senha"
              autoFocus
              autoComplete="current-password"
              aria-label="Senha de acesso"
            />

            {erro && (
              <p
                className="flex items-start gap-1.5 text-xs leading-tight"
                style={{ color: "var(--status-critical)" }}
                role="alert"
              >
                <AlertTriangle className="mt-px size-3 shrink-0" />
                {erro}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={enviando || senha.length === 0}>
              <LogIn className="mr-1.5 size-4" />
              {enviando ? "Entrando..." : "Entrar"}
            </Button>
          </form>

          <p className="text-center text-[11px] leading-tight text-muted-foreground">
            Acesso local. A senha fica em app/.env.local e não identifica quem entrou.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
```

`app/src/app/login/page.tsx`:

```tsx
import { Suspense } from "react";
import { LoginView } from "@/components/auth/login-view";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  // useSearchParams exige um limite de Suspense; sem fallback o Next 16 entra
  // em refetch infinito, então o fallback é a própria moldura vazia da tela.
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <LoginView />
    </Suspense>
  );
}
```

- [ ] **Step 7: Verificar**

Criar `app/.env.local` com `EXTRATOR_SENHA=senha-local-de-teste` (arquivo ignorado pelo git).
Run: `npx tsc --noEmit` → sem erros. Run: `npx vitest run` → tudo passa.
Run (em outro terminal ou em background): `npm run dev`; depois `curl -s -o NUL -w "%{http_code}\n" http://127.0.0.1:51794/api/exportacoes` → **401**; `curl -s -o NUL -w "%{http_code}\n" -X POST -H "Content-Type: application/json" -d "{\"senha\":\"errada\"}" http://127.0.0.1:51794/api/auth/login` → **401**; com a senha certa → **200**. Parar o servidor.

- [ ] **Step 8: Commit**

```bash
git add app
git commit -m "Adiciona login por senha unica (sessao assinada, proxy e limite de tentativas)"
```

---

### Task 4: Tipos e camada de banco (SQLite)

**Files:**
- Create: `app/src/types/dominio.ts`, `app/src/lib/db/migracoes.ts`, `app/src/lib/db/conexao.ts`, `app/src/lib/db/repositorio.ts`
- Test: `app/src/lib/db/repositorio.test.ts`

**Interfaces:**
- Produces (tipos, em `@/types/dominio`):
  - `StatusExportacao = "em_andamento" | "concluida" | "erro" | "cancelada"`
  - `EtapaExportacao = "iniciando" | "aguardando_login" | "login_concluido" | "procurando_grupo" | "grupo_aberto" | "lendo_historico" | "salvando"`
  - `MensagemBruta { autor; dataHoraOriginal; texto }`, `MensagemParaInserir extends MensagemBruta { dataHora: string | null }`, `Mensagem extends MensagemParaInserir { id; grupoId }`
  - `Exportacao { id; grupo; grupoAberto; status; etapa; contador; totalMensagens; iniciadaEm; finalizadaEm; arquivoTxt; arquivoJson; erroMsg; logTail }`
  - `GrupoResumo { id; nome; total; primeira; ultima }`, `FiltrosMensagens { grupoId; autor?; de?; ate?; texto? }`, `LinhaKpi { autor; dataHora }`
- Produces (funções, todas com `db: DatabaseSync` como 1º parâmetro): `aplicarEsquema(db)`; `obterOuCriarGrupo(db, nome): number`; `tentarCriarExportacao(db, grupoNome, agoraIso): number | null`; `atualizarExportacao(db, id, campos)`; `obterExportacao(db, id): Exportacao | null`; `listarExportacoes(db, limite?): Exportacao[]`; `reconciliarInterrompidas(db, agoraIso): number`; `inserirMensagens(db, grupoId, exportacaoId | null, msgs): { lidas; novas }`; `marcarUltimaExportacao(db, grupoId, agoraIso)`; `listarGrupos(db): GrupoResumo[]`; `listarAutores(db, grupoId): string[]`; `consultarMensagens(db, filtros, pagina, porPagina): { itens; total }`; `dadosParaKpis(db, filtros): LinhaKpi[]`. `obterBanco(): DatabaseSync` (singleton, `server-only`) em `conexao.ts`.

- [ ] **Step 1: Criar `app/src/types/dominio.ts`**

```ts
export type StatusExportacao = "em_andamento" | "concluida" | "erro" | "cancelada";

export type EtapaExportacao =
  | "iniciando"
  | "aguardando_login"
  | "login_concluido"
  | "procurando_grupo"
  | "grupo_aberto"
  | "lendo_historico"
  | "salvando";

/** Mensagem como vem do Teams: a data ainda é o texto original. */
export interface MensagemBruta {
  autor: string;
  dataHoraOriginal: string;
  texto: string;
}

export interface MensagemParaInserir extends MensagemBruta {
  /** ISO local sem fuso (`YYYY-MM-DDTHH:MM`); nula quando o texto de data não é interpretável. */
  dataHora: string | null;
}

export interface Mensagem extends MensagemParaInserir {
  id: number;
  grupoId: number;
}

export interface Exportacao {
  id: number;
  grupo: string;
  grupoAberto: string | null;
  status: StatusExportacao;
  etapa: EtapaExportacao;
  contador: number;
  totalMensagens: number | null;
  iniciadaEm: string;
  finalizadaEm: string | null;
  arquivoTxt: string | null;
  arquivoJson: string | null;
  erroMsg: string | null;
  logTail: string;
}

export interface GrupoResumo {
  id: number;
  nome: string;
  total: number;
  primeira: string | null;
  ultima: string | null;
}

export interface FiltrosMensagens {
  grupoId: number;
  autor?: string;
  /** `YYYY-MM-DD`, inclusivo. */
  de?: string;
  /** `YYYY-MM-DD`, inclusivo. */
  ate?: string;
  texto?: string;
}

export interface LinhaKpi {
  autor: string;
  dataHora: string | null;
}
```

- [ ] **Step 2: Escrever o teste que falha (`app/src/lib/db/repositorio.test.ts`)**

```ts
import { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";
import { aplicarEsquema } from "./migracoes";
import {
  atualizarExportacao,
  consultarMensagens,
  dadosParaKpis,
  inserirMensagens,
  listarAutores,
  listarExportacoes,
  listarGrupos,
  obterExportacao,
  obterOuCriarGrupo,
  reconciliarInterrompidas,
  tentarCriarExportacao,
} from "./repositorio";
import type { MensagemParaInserir } from "@/types/dominio";

let db: DatabaseSync;

beforeEach(() => {
  db = new DatabaseSync(":memory:");
  aplicarEsquema(db);
});

function msg(autor: string, dataHora: string | null, texto: string): MensagemParaInserir {
  return { autor, dataHora, dataHoraOriginal: `orig ${dataHora ?? "sem data"}`, texto };
}

describe("grupos", () => {
  it("obterOuCriarGrupo é idempotente", () => {
    expect(obterOuCriarGrupo(db, "G1")).toBe(obterOuCriarGrupo(db, "G1"));
    expect(obterOuCriarGrupo(db, "G2")).not.toBe(obterOuCriarGrupo(db, "G1"));
  });
});

describe("exportações", () => {
  it("só uma exportação em andamento por vez", () => {
    const id = tentarCriarExportacao(db, "G1", "2026-09-21T10:00:00.000Z");
    expect(id).not.toBeNull();
    expect(tentarCriarExportacao(db, "G2", "2026-09-21T10:01:00.000Z")).toBeNull();
    atualizarExportacao(db, id!, { status: "concluida" });
    expect(tentarCriarExportacao(db, "G2", "2026-09-21T10:02:00.000Z")).not.toBeNull();
  });

  it("atualiza campos parciais e devolve o objeto mapeado", () => {
    const id = tentarCriarExportacao(db, "G1", "2026-09-21T10:00:00.000Z")!;
    atualizarExportacao(db, id, { etapa: "lendo_historico", contador: 42, grupoAberto: "G1 Ana" });
    const e = obterExportacao(db, id)!;
    expect(e).toMatchObject({
      id,
      grupo: "G1",
      grupoAberto: "G1 Ana",
      status: "em_andamento",
      etapa: "lendo_historico",
      contador: 42,
      totalMensagens: null,
      finalizadaEm: null,
    });
    expect(obterExportacao(db, 999)).toBeNull();
  });

  it("lista da mais recente para a mais antiga", () => {
    const a = tentarCriarExportacao(db, "G1", "2026-09-21T10:00:00.000Z")!;
    atualizarExportacao(db, a, { status: "concluida" });
    const b = tentarCriarExportacao(db, "G1", "2026-09-21T11:00:00.000Z")!;
    expect(listarExportacoes(db).map((e) => e.id)).toEqual([b, a]);
  });

  it("reconcilia execuções interrompidas como erro", () => {
    const id = tentarCriarExportacao(db, "G1", "2026-09-21T10:00:00.000Z")!;
    expect(reconciliarInterrompidas(db, "2026-09-21T12:00:00.000Z")).toBe(1);
    const e = obterExportacao(db, id)!;
    expect(e.status).toBe("erro");
    expect(e.erroMsg).toMatch(/interrompida/i);
    expect(e.finalizadaEm).toBe("2026-09-21T12:00:00.000Z");
  });
});

describe("mensagens", () => {
  it("deduplica pela chave (grupo, autor, data original, texto)", () => {
    const g = obterOuCriarGrupo(db, "G1");
    const m = msg("Ana", "2026-09-08T11:09", "Oi");
    expect(inserirMensagens(db, g, null, [m, m])).toEqual({ lidas: 2, novas: 1 });
    expect(inserirMensagens(db, g, null, [m, msg("Ana", "2026-09-08T11:09", "Outro")])).toEqual({
      lidas: 2,
      novas: 1,
    });
  });

  it("filtra por autor, período e texto (com % e _ literais) e ordena com datas nulas no fim", () => {
    const g = obterOuCriarGrupo(db, "G1");
    inserirMensagens(db, g, null, [
      msg("Ana", "2026-09-10T09:00", "depois"),
      msg("Bruno", "2026-09-08T09:00", "100% pronto"),
      msg("Ana", null, "sem data"),
      msg("Ana", "2026-09-08T10:00", "a_b"),
    ]);
    const todas = consultarMensagens(db, { grupoId: g }, 1, 50);
    expect(todas.total).toBe(4);
    expect(todas.itens.map((m) => m.texto)).toEqual(["100% pronto", "a_b", "depois", "sem data"]);

    expect(consultarMensagens(db, { grupoId: g, autor: "Ana" }, 1, 50).total).toBe(3);
    expect(consultarMensagens(db, { grupoId: g, de: "2026-09-09" }, 1, 50).total).toBe(1);
    expect(consultarMensagens(db, { grupoId: g, ate: "2026-09-08" }, 1, 50).total).toBe(2);
    expect(consultarMensagens(db, { grupoId: g, texto: "100%" }, 1, 50).itens.map((m) => m.texto)).toEqual([
      "100% pronto",
    ]);
    expect(consultarMensagens(db, { grupoId: g, texto: "a_b" }, 1, 50).total).toBe(1);
    expect(consultarMensagens(db, { grupoId: g, texto: "a%b" }, 1, 50).total).toBe(0);
  });

  it("pagina", () => {
    const g = obterOuCriarGrupo(db, "G1");
    inserirMensagens(
      db,
      g,
      null,
      Array.from({ length: 5 }, (_, i) => msg("Ana", `2026-09-0${i + 1}T09:00`, `m${i}`))
    );
    const p2 = consultarMensagens(db, { grupoId: g }, 2, 2);
    expect(p2.total).toBe(5);
    expect(p2.itens.map((m) => m.texto)).toEqual(["m2", "m3"]);
  });

  it("lista grupos com contagem e período, e autores distintos", () => {
    const g = obterOuCriarGrupo(db, "G1");
    obterOuCriarGrupo(db, "Vazio");
    inserirMensagens(db, g, null, [
      msg("Bruno", "2026-09-08T09:00", "a"),
      msg("Ana", "2026-09-10T09:00", "b"),
      msg("Ana", "2026-09-11T09:00", "c"),
    ]);
    const grupos = listarGrupos(db);
    expect(grupos.find((x) => x.nome === "G1")).toMatchObject({
      total: 3,
      primeira: "2026-09-08T09:00",
      ultima: "2026-09-11T09:00",
    });
    expect(grupos.find((x) => x.nome === "Vazio")).toMatchObject({ total: 0, primeira: null });
    expect(listarAutores(db, g)).toEqual(["Ana", "Bruno"]);
  });

  it("dadosParaKpis respeita o período", () => {
    const g = obterOuCriarGrupo(db, "G1");
    inserirMensagens(db, g, null, [msg("Ana", "2026-09-08T09:00", "a"), msg("Ana", "2026-09-20T09:00", "b")]);
    expect(dadosParaKpis(db, { grupoId: g, de: "2026-09-10" })).toEqual([
      { autor: "Ana", dataHora: "2026-09-20T09:00" },
    ]);
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run (em `app/`): `npx vitest run src/lib/db/repositorio.test.ts`
Expected: FAIL (`Cannot find module './migracoes'`).

- [ ] **Step 4: Criar `app/src/lib/db/migracoes.ts`**

```ts
import type { DatabaseSync } from "node:sqlite";

/**
 * Esquema do banco. Fica separado de `conexao.ts` (que só abre o arquivo) para
 * poder ser aplicado num banco `:memory:` nos testes.
 *
 * A chave única de `mensagens` usa o texto ORIGINAL da data, não a data já
 * interpretada: `NULL` não deduplica em SQLite, e a data original é o que o
 * script usa na sua própria chave de deduplicação.
 */
export const DDL = `
CREATE TABLE IF NOT EXISTS grupos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL UNIQUE,
  ultima_exportacao_em TEXT
);

CREATE TABLE IF NOT EXISTS exportacoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  grupo_id INTEGER NOT NULL REFERENCES grupos(id),
  status TEXT NOT NULL,
  etapa TEXT NOT NULL DEFAULT 'iniciando',
  grupo_aberto TEXT,
  iniciada_em TEXT NOT NULL,
  finalizada_em TEXT,
  total_mensagens INTEGER,
  contador INTEGER NOT NULL DEFAULT 0,
  arquivo_txt TEXT,
  arquivo_json TEXT,
  erro_msg TEXT,
  log_tail TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS mensagens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  grupo_id INTEGER NOT NULL REFERENCES grupos(id),
  exportacao_id INTEGER REFERENCES exportacoes(id),
  autor TEXT NOT NULL,
  data_hora TEXT,
  data_hora_original TEXT NOT NULL,
  texto TEXT NOT NULL,
  UNIQUE (grupo_id, autor, data_hora_original, texto)
);

CREATE INDEX IF NOT EXISTS idx_mensagens_grupo_data ON mensagens (grupo_id, data_hora);
`;

export function aplicarEsquema(db: DatabaseSync): void {
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(DDL);
}
```

- [ ] **Step 5: Criar `app/src/lib/db/repositorio.ts`**

```ts
import type { DatabaseSync } from "node:sqlite";
import type {
  EtapaExportacao,
  Exportacao,
  FiltrosMensagens,
  GrupoResumo,
  LinhaKpi,
  Mensagem,
  MensagemParaInserir,
  StatusExportacao,
} from "@/types/dominio";

type Linha = Record<string, unknown>;
type Parametro = string | number | null;

function todas(db: DatabaseSync, sql: string, ...params: Parametro[]): Linha[] {
  return db.prepare(sql).all(...params) as unknown as Linha[];
}

function uma(db: DatabaseSync, sql: string, ...params: Parametro[]): Linha | undefined {
  return db.prepare(sql).get(...params) as unknown as Linha | undefined;
}

/** Roda `fn` numa transação; desfaz tudo se ela lançar. */
function transacao<T>(db: DatabaseSync, fn: () => T, imediata = false): T {
  db.exec(imediata ? "BEGIN IMMEDIATE" : "BEGIN");
  try {
    const resultado = fn();
    db.exec("COMMIT");
    return resultado;
  } catch (erro) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // A transação já pode ter sido desfeita pelo próprio SQLite.
    }
    throw erro;
  }
}

// ---------------------------------------------------------------- grupos

export function obterOuCriarGrupo(db: DatabaseSync, nome: string): number {
  db.prepare("INSERT OR IGNORE INTO grupos (nome) VALUES (?)").run(nome);
  return Number(uma(db, "SELECT id FROM grupos WHERE nome = ?", nome)!.id);
}

export function marcarUltimaExportacao(db: DatabaseSync, grupoId: number, agoraIso: string): void {
  db.prepare("UPDATE grupos SET ultima_exportacao_em = ? WHERE id = ?").run(agoraIso, grupoId);
}

export function listarGrupos(db: DatabaseSync): GrupoResumo[] {
  return todas(
    db,
    `SELECT g.id, g.nome, COUNT(m.id) AS total, MIN(m.data_hora) AS primeira, MAX(m.data_hora) AS ultima
       FROM grupos g LEFT JOIN mensagens m ON m.grupo_id = g.id
      GROUP BY g.id ORDER BY g.nome`
  ).map((l) => ({
    id: Number(l.id),
    nome: String(l.nome),
    total: Number(l.total),
    primeira: (l.primeira as string | null) ?? null,
    ultima: (l.ultima as string | null) ?? null,
  }));
}

export function listarAutores(db: DatabaseSync, grupoId: number): string[] {
  return todas(db, "SELECT DISTINCT autor FROM mensagens WHERE grupo_id = ? ORDER BY autor", grupoId).map((l) =>
    String(l.autor)
  );
}

// ------------------------------------------------------------ exportações

const COLUNAS = {
  status: "status",
  etapa: "etapa",
  grupoAberto: "grupo_aberto",
  finalizadaEm: "finalizada_em",
  totalMensagens: "total_mensagens",
  contador: "contador",
  arquivoTxt: "arquivo_txt",
  arquivoJson: "arquivo_json",
  erroMsg: "erro_msg",
  logTail: "log_tail",
} as const;

export type CamposExportacao = Partial<{
  status: StatusExportacao;
  etapa: EtapaExportacao;
  grupoAberto: string | null;
  finalizadaEm: string | null;
  totalMensagens: number | null;
  contador: number;
  arquivoTxt: string | null;
  arquivoJson: string | null;
  erroMsg: string | null;
  logTail: string;
}>;

const SELECT_EXPORTACAO = `SELECT e.*, g.nome AS grupo_nome
   FROM exportacoes e JOIN grupos g ON g.id = e.grupo_id`;

function mapearExportacao(l: Linha): Exportacao {
  return {
    id: Number(l.id),
    grupo: String(l.grupo_nome),
    grupoAberto: (l.grupo_aberto as string | null) ?? null,
    status: l.status as StatusExportacao,
    etapa: l.etapa as EtapaExportacao,
    contador: Number(l.contador),
    totalMensagens: l.total_mensagens === null ? null : Number(l.total_mensagens),
    iniciadaEm: String(l.iniciada_em),
    finalizadaEm: (l.finalizada_em as string | null) ?? null,
    arquivoTxt: (l.arquivo_txt as string | null) ?? null,
    arquivoJson: (l.arquivo_json as string | null) ?? null,
    erroMsg: (l.erro_msg as string | null) ?? null,
    logTail: String(l.log_tail ?? ""),
  };
}

/**
 * Cria a execução se — e só se — não houver outra em andamento. A checagem e a
 * inserção acontecem na mesma transação `BEGIN IMMEDIATE`, então duas
 * chamadas simultâneas (mesmo de instâncias diferentes do módulo) nunca
 * criam duas execuções: o `teams_profile` só aceita um Edge por vez.
 */
export function tentarCriarExportacao(db: DatabaseSync, grupoNome: string, agoraIso: string): number | null {
  return transacao(
    db,
    () => {
      if (uma(db, "SELECT id FROM exportacoes WHERE status = 'em_andamento' LIMIT 1")) return null;
      const grupoId = obterOuCriarGrupo(db, grupoNome);
      const r = db
        .prepare("INSERT INTO exportacoes (grupo_id, status, etapa, iniciada_em) VALUES (?, 'em_andamento', 'iniciando', ?)")
        .run(grupoId, agoraIso);
      return Number(r.lastInsertRowid);
    },
    true
  );
}

export function atualizarExportacao(db: DatabaseSync, id: number, campos: CamposExportacao): void {
  const chaves = (Object.keys(campos) as (keyof CamposExportacao)[]).filter((k) => campos[k] !== undefined);
  if (chaves.length === 0) return;
  const sql = `UPDATE exportacoes SET ${chaves.map((k) => `${COLUNAS[k]} = ?`).join(", ")} WHERE id = ?`;
  db.prepare(sql).run(...chaves.map((k) => (campos[k] ?? null) as Parametro), id);
}

export function obterExportacao(db: DatabaseSync, id: number): Exportacao | null {
  const l = uma(db, `${SELECT_EXPORTACAO} WHERE e.id = ?`, id);
  return l ? mapearExportacao(l) : null;
}

export function listarExportacoes(db: DatabaseSync, limite = 50): Exportacao[] {
  return todas(db, `${SELECT_EXPORTACAO} ORDER BY e.id DESC LIMIT ?`, limite).map(mapearExportacao);
}

/** Execuções que ficaram `em_andamento` de uma sessão anterior do servidor. */
export function reconciliarInterrompidas(db: DatabaseSync, agoraIso: string): number {
  const r = db
    .prepare(
      `UPDATE exportacoes
          SET status = 'erro', finalizada_em = ?,
              erro_msg = 'Interrompida: o servidor foi reiniciado durante a exportação.'
        WHERE status = 'em_andamento'`
    )
    .run(agoraIso);
  return Number(r.changes);
}

// -------------------------------------------------------------- mensagens

export function inserirMensagens(
  db: DatabaseSync,
  grupoId: number,
  exportacaoId: number | null,
  mensagens: MensagemParaInserir[]
): { lidas: number; novas: number } {
  const inserir = db.prepare(
    `INSERT OR IGNORE INTO mensagens (grupo_id, exportacao_id, autor, data_hora, data_hora_original, texto)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  const novas = transacao(db, () => {
    let total = 0;
    for (const m of mensagens) {
      total += Number(inserir.run(grupoId, exportacaoId, m.autor, m.dataHora, m.dataHoraOriginal, m.texto).changes);
    }
    return total;
  });
  return { lidas: mensagens.length, novas };
}

function escaparLike(texto: string): string {
  return texto.replace(/[\\%_]/g, "\\$&");
}

function montarWhere(f: FiltrosMensagens): { where: string; params: Parametro[] } {
  const cond = ["grupo_id = ?"];
  const params: Parametro[] = [f.grupoId];
  if (f.autor) {
    cond.push("autor = ?");
    params.push(f.autor);
  }
  if (f.de) {
    cond.push("substr(data_hora, 1, 10) >= ?");
    params.push(f.de);
  }
  if (f.ate) {
    cond.push("substr(data_hora, 1, 10) <= ?");
    params.push(f.ate);
  }
  if (f.texto) {
    cond.push("texto LIKE ? ESCAPE '\\'");
    params.push(`%${escaparLike(f.texto)}%`);
  }
  return { where: cond.join(" AND "), params };
}

export function consultarMensagens(
  db: DatabaseSync,
  filtros: FiltrosMensagens,
  pagina: number,
  porPagina: number
): { itens: Mensagem[]; total: number } {
  const { where, params } = montarWhere(filtros);
  const total = Number(uma(db, `SELECT COUNT(*) AS n FROM mensagens WHERE ${where}`, ...params)!.n);
  const itens = todas(
    db,
    `SELECT id, grupo_id, autor, data_hora, data_hora_original, texto
       FROM mensagens WHERE ${where}
      ORDER BY data_hora IS NULL, data_hora, id
      LIMIT ? OFFSET ?`,
    ...params,
    porPagina,
    (pagina - 1) * porPagina
  ).map((l) => ({
    id: Number(l.id),
    grupoId: Number(l.grupo_id),
    autor: String(l.autor),
    dataHora: (l.data_hora as string | null) ?? null,
    dataHoraOriginal: String(l.data_hora_original),
    texto: String(l.texto),
  }));
  return { itens, total };
}

export function dadosParaKpis(db: DatabaseSync, filtros: FiltrosMensagens): LinhaKpi[] {
  const { where, params } = montarWhere(filtros);
  return todas(db, `SELECT autor, data_hora FROM mensagens WHERE ${where}`, ...params).map((l) => ({
    autor: String(l.autor),
    dataHora: (l.data_hora as string | null) ?? null,
  }));
}
```

- [ ] **Step 6: Criar `app/src/lib/db/conexao.ts`**

```ts
import "server-only";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { aplicarEsquema } from "./migracoes";
import { reconciliarInterrompidas } from "./repositorio";

/**
 * Banco local em SQLite, usando o módulo nativo do Node (24+). Guarda os
 * grupos, o histórico de exportações e as mensagens.
 *
 * O singleton mora em `globalThis`: em desenvolvimento o Next recarrega
 * módulos e cada instância abriria a sua própria conexão.
 */
const g = globalThis as unknown as { __extratorBanco?: DatabaseSync };

export function caminhoDoBanco(): string {
  return process.env.EXTRATOR_DB || path.join(process.cwd(), "data", "extrator.db");
}

export function obterBanco(): DatabaseSync {
  if (g.__extratorBanco) return g.__extratorBanco;

  const caminho = caminhoDoBanco();
  mkdirSync(path.dirname(caminho), { recursive: true });
  const db = new DatabaseSync(caminho);

  // WAL deixa leitura e escrita concorrentes viáveis: as telas continuam
  // lendo enquanto uma exportação grava.
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA synchronous = NORMAL");
  aplicarEsquema(db);

  // Uma execução `em_andamento` que sobrou de antes deste boot não tem mais
  // processo por trás: vira erro em vez de bloquear novas exportações.
  reconciliarInterrompidas(db, new Date().toISOString());

  g.__extratorBanco = db;
  return db;
}
```

- [ ] **Step 7: Rodar e ver passar**

Run: `npx vitest run src/lib/db/repositorio.test.ts` → todos passam. Run: `npx tsc --noEmit` → sem erros.

- [ ] **Step 8: Commit**

```bash
git add app
git commit -m "Adiciona tipos e camada SQLite (grupos, exportacoes, mensagens)"
```

---

### Task 5: Data em português, parser do `.txt` e parser de progresso

**Files:**
- Create: `app/src/lib/dataPt.ts`, `app/src/lib/parseTxt.ts`, `app/src/lib/parseProgresso.ts`
- Test: `app/src/lib/dataPt.test.ts`, `app/src/lib/parseTxt.test.ts`, `app/src/lib/parseProgresso.test.ts`

**Interfaces:**
- Produces: `interpretarDataHoraPt(original: string): string | null` (`"YYYY-MM-DDTHH:MM"`); `parseTxt(conteudo: string): { grupo: string | null; totalDeclarado: number | null; mensagens: MensagemBruta[] }`; `interpretarLinha(linha: string): EventoProgresso | null` com `EventoProgresso { etapa?: EtapaExportacao; contador?: number; grupoAberto?: string; arquivoTxt?: string }`.

- [ ] **Step 1: Testes que falham**

`app/src/lib/dataPt.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { interpretarDataHoraPt } from "./dataPt";

describe("interpretarDataHoraPt", () => {
  it("interpreta o formato do Teams", () => {
    expect(interpretarDataHoraPt("terça-feira, 8 de setembro de 2026 11:09")).toBe("2026-09-08T11:09");
    expect(interpretarDataHoraPt("segunda-feira, 20 de outubro de 2025 15:12")).toBe("2025-10-20T15:12");
  });

  it("aceita março com e sem cedilha (\\w do JS não casa 'ç')", () => {
    expect(interpretarDataHoraPt("domingo, 1 de março de 2026 09:05")).toBe("2026-03-01T09:05");
    expect(interpretarDataHoraPt("domingo, 1 de marco de 2026 09:05")).toBe("2026-03-01T09:05");
  });

  it("ignora maiúsculas no mês", () => {
    expect(interpretarDataHoraPt("terça-feira, 8 de SETEMBRO de 2026 11:09")).toBe("2026-09-08T11:09");
  });

  it("devolve null para texto que não é data, mês desconhecido ou data impossível", () => {
    expect(interpretarDataHoraPt("sem data")).toBeNull();
    expect(interpretarDataHoraPt("terça, 8 de setembr de 2026 11:09")).toBeNull();
    expect(interpretarDataHoraPt("sábado, 31 de fevereiro de 2026 11:09")).toBeNull();
    expect(interpretarDataHoraPt("terça, 8 de setembro de 2026 25:09")).toBeNull();
  });
});
```

`app/src/lib/parseTxt.test.ts` (fixture **sintética**):

```ts
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseTxt } from "./parseTxt";

const CABECALHO = [
  "Histórico do chat: Grupo de Teste",
  "Exportado em: 21/09/2026 09:23",
  "Total de mensagens: 3",
  "============================================================",
  "",
].join("\n");

const CORPO = [
  "[segunda-feira, 7 de setembro de 2026 10:00] Ana Teste:",
  "Primeira mensagem",
  "",
  "[terça-feira, 8 de setembro de 2026 11:09] Bruno Teste:",
  "Linha um",
  "",
  "Linha três depois de uma linha em branco",
  "",
  "[terça-feira, 8 de setembro de 2026 11:10] Ana Teste:",
  "Termina com reação. 1 Curtir reação.",
  "",
].join("\n");

describe("parseTxt", () => {
  it("lê cabeçalho e mensagens", () => {
    const r = parseTxt(CABECALHO + "\n" + CORPO);
    expect(r.grupo).toBe("Grupo de Teste");
    expect(r.totalDeclarado).toBe(3);
    expect(r.mensagens).toHaveLength(3);
    expect(r.mensagens[0]).toEqual({
      autor: "Ana Teste",
      dataHoraOriginal: "segunda-feira, 7 de setembro de 2026 10:00",
      texto: "Primeira mensagem",
    });
  });

  it("preserva linhas em branco dentro de uma mensagem", () => {
    const r = parseTxt(CABECALHO + "\n" + CORPO);
    expect(r.mensagens[1].texto).toBe("Linha um\n\nLinha três depois de uma linha em branco");
  });

  it("aceita CRLF (o Python no Windows grava assim) e BOM", () => {
    const crlf = "\uFEFF" + (CABECALHO + "\n" + CORPO).replace(/\n/g, "\r\n");
    const r = parseTxt(crlf);
    expect(r.grupo).toBe("Grupo de Teste");
    expect(r.mensagens).toHaveLength(3);
    expect(r.mensagens[1].texto).toBe("Linha um\n\nLinha três depois de uma linha em branco");
  });

  it("sem cabeçalho de arquivo, devolve grupo nulo", () => {
    const r = parseTxt(CORPO);
    expect(r.grupo).toBeNull();
    expect(r.totalDeclarado).toBeNull();
    expect(r.mensagens).toHaveLength(3);
  });

  it("texto sem nenhuma mensagem devolve lista vazia", () => {
    expect(parseTxt("qualquer coisa\noutra linha").mensagens).toEqual([]);
  });
});

// Validação com dado real: só roda se existir um export do CAPAG em ../exports
// (a pasta é ignorada pelo git — o conteúdo nunca vai para o repositório).
const pastaExports = path.resolve(process.cwd(), "..", "exports");
const arquivoReal = existsSync(pastaExports)
  ? readdirSync(pastaExports).find((n) => n.startsWith("Projetos_CAPAG") && n.endsWith(".txt"))
  : undefined;

describe.skipIf(!arquivoReal)("parseTxt com o export real do CAPAG", () => {
  it("lê exatamente o total declarado no cabeçalho", () => {
    const r = parseTxt(readFileSync(path.join(pastaExports, arquivoReal!), "utf8"));
    expect(r.totalDeclarado).not.toBeNull();
    expect(r.mensagens.length).toBe(r.totalDeclarado);
  });
});
```

`app/src/lib/parseProgresso.test.ts`:

```ts
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
```

Run (em `app/`): `npx vitest run src/lib/dataPt.test.ts src/lib/parseTxt.test.ts src/lib/parseProgresso.test.ts`
Expected: FAIL (módulos inexistentes).

- [ ] **Step 2: Implementar `dataPt.ts`**

```ts
const MESES: Record<string, number> = {
  janeiro: 1,
  fevereiro: 2,
  março: 3,
  marco: 3,
  abril: 4,
  maio: 5,
  junho: 6,
  julho: 7,
  agosto: 8,
  setembro: 9,
  outubro: 10,
  novembro: 11,
  dezembro: 12,
};

// `\p{L}` e não `\w`: em JS o `\w` só casa ASCII e deixaria "março" de fora.
const PADRAO = /,\s*(\d{1,2})\s+de\s+(\p{L}+)\s+de\s+(\d{4})\s+(\d{1,2}):(\d{2})/u;

const dois = (n: number) => String(n).padStart(2, "0");

/**
 * Converte o texto de data do Teams ("terça-feira, 8 de setembro de 2026
 * 11:09") em ISO local sem fuso (`2026-09-08T11:09`). Devolve `null` quando o
 * texto não é uma data interpretável — o chamador guarda o original.
 */
export function interpretarDataHoraPt(original: string): string | null {
  const m = PADRAO.exec(original);
  if (!m) return null;

  const dia = Number(m[1]);
  const mes = MESES[m[2].toLowerCase()];
  const ano = Number(m[3]);
  const hora = Number(m[4]);
  const minuto = Number(m[5]);
  if (!mes || hora > 23 || minuto > 59) return null;

  // Rejeita datas que só existem no papel (31 de fevereiro).
  const teste = new Date(Date.UTC(ano, mes - 1, dia));
  if (teste.getUTCFullYear() !== ano || teste.getUTCMonth() !== mes - 1 || teste.getUTCDate() !== dia) {
    return null;
  }

  return `${ano}-${dois(mes)}-${dois(dia)}T${dois(hora)}:${dois(minuto)}`;
}
```

- [ ] **Step 3: Implementar `parseTxt.ts`**

```ts
import type { MensagemBruta } from "@/types/dominio";

export interface ResultadoTxt {
  grupo: string | null;
  totalDeclarado: number | null;
  mensagens: MensagemBruta[];
}

/**
 * Cabeçalho de uma mensagem: `[<data do Teams>] <autor>:`. Reconhecido por
 * regex e não por linha em branco, porque o texto de uma mensagem pode ter
 * linhas em branco no meio.
 */
const CABECALHO_MENSAGEM = /^\[([^\]]*\d{1,2}\s+de\s+\p{L}+\s+de\s+\d{4}\s+\d{1,2}:\d{2})\]\s+(.+):$/u;

interface Bloco {
  autor: string;
  dataHoraOriginal: string;
  linhas: string[];
}

/**
 * Lê o `.txt` produzido por `teams_chat_export.py`. Aceita CRLF (o Python no
 * Windows grava assim) e BOM.
 */
export function parseTxt(conteudo: string): ResultadoTxt {
  const linhas = conteudo.replace(/^\uFEFF/, "").split(/\r\n|\n|\r/);
  let grupo: string | null = null;
  let totalDeclarado: number | null = null;
  const blocos: Bloco[] = [];

  for (const linha of linhas) {
    const cabecalho = CABECALHO_MENSAGEM.exec(linha);
    if (cabecalho) {
      blocos.push({ dataHoraOriginal: cabecalho[1], autor: cabecalho[2], linhas: [] });
      continue;
    }
    if (blocos.length > 0) {
      blocos[blocos.length - 1].linhas.push(linha);
      continue;
    }
    // Antes da primeira mensagem: cabeçalho do arquivo.
    const g = /^Histórico do chat:\s*(.+)$/u.exec(linha);
    if (g) grupo = g[1].trim();
    const t = /^Total de mensagens:\s*(\d+)/u.exec(linha);
    if (t) totalDeclarado = Number(t[1]);
  }

  return {
    grupo,
    totalDeclarado,
    mensagens: blocos.map((b) => ({
      autor: b.autor,
      dataHoraOriginal: b.dataHoraOriginal,
      // O script termina cada mensagem com uma linha em branco separadora.
      texto: b.linhas.join("\n").replace(/\n+$/, ""),
    })),
  };
}
```

- [ ] **Step 4: Implementar `parseProgresso.ts`**

```ts
import type { EtapaExportacao } from "@/types/dominio";

export interface EventoProgresso {
  etapa?: EtapaExportacao;
  contador?: number;
  grupoAberto?: string;
  arquivoTxt?: string;
}

/**
 * Converte uma linha da saída do `teams_chat_export.py` num evento de
 * progresso. Linhas desconhecidas devolvem `null` — só entram no log.
 */
export function interpretarLinha(linha: string): EventoProgresso | null {
  const l = linha.trim();
  if (!l) return null;

  if (l.startsWith(">> Uma janela do navegador foi aberta")) return { etapa: "aguardando_login" };
  if (l.startsWith(">> Login detectado")) return { etapa: "login_concluido" };
  if (l.startsWith(">> Procurando o grupo/chat")) return { etapa: "procurando_grupo" };
  if (l.startsWith(">> Lendo o histórico")) return { etapa: "lendo_historico" };

  const aberto = /^>> Abrindo: "(.*)"$/u.exec(l);
  if (aberto) return { etapa: "grupo_aberto", grupoAberto: aberto[1] };

  const parcial = /^\.\.\. (\d+) mensagens únicas encontradas/u.exec(l);
  if (parcial) return { contador: Number(parcial[1]) };

  const total = /^>> Total de mensagens únicas capturadas: (\d+)/u.exec(l);
  if (total) return { contador: Number(total[1]) };

  const pronto = /^>> Pronto! Arquivo salvo em: (.+)$/u.exec(l);
  if (pronto) return { etapa: "salvando", arquivoTxt: pronto[1] };

  return null;
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run src/lib/dataPt.test.ts src/lib/parseTxt.test.ts src/lib/parseProgresso.test.ts`
Expected: tudo passa. O teste "com o export real do CAPAG" **roda** se `exports/Projetos_CAPAG*.txt` existir (nesta máquina existe): deve passar com `mensagens.length === totalDeclarado` (1527). Se aparecer como `skipped`, o arquivo não está em `../exports`.

- [ ] **Step 6: Commit**

```bash
git add app
git commit -m "Adiciona interpretacao de data pt-BR, parser do txt e parser de progresso"
```

---

### Task 6: Validação de grupo, KPIs, caminhos e formatação

**Files:**
- Create: `app/src/lib/validarGrupo.ts`, `app/src/lib/kpis.ts`, `app/src/lib/exportacao/caminhos.ts`, `app/src/lib/formatacao.ts`
- Test: `app/src/lib/validarGrupo.test.ts`, `app/src/lib/kpis.test.ts`, `app/src/lib/exportacao/caminhos.test.ts`, `app/src/lib/formatacao.test.ts`

**Interfaces:**
- Produces: `validarGrupo(bruto: unknown): { ok: true; nome: string } | { ok: false; motivo: string }`; `calcularKpis(linhas: LinhaKpi[]): Kpis` com `Kpis { total; autores; semData; primeiraData; ultimaData; dias; mediaPorDia; porAutor: {autor;total}[]; porDia: {dia;total}[] }`; `estaDentro(base: string, alvo: string): boolean`; `formatarNumero(n)`, `formatarDataHora(iso, original)`, `formatarDia(iso)`, `formatarInstante(iso)`, `formatarDuracao(inicioIso, fimIso | null)`.

- [ ] **Step 1: Testes que falham**

`app/src/lib/validarGrupo.test.ts`:

```ts
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
```

`app/src/lib/kpis.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { calcularKpis } from "./kpis";

describe("calcularKpis", () => {
  it("conta total, autores, período e média por dia", () => {
    const k = calcularKpis([
      { autor: "Ana", dataHora: "2026-09-08T09:00" },
      { autor: "Ana", dataHora: "2026-09-08T10:00" },
      { autor: "Bruno", dataHora: "2026-09-10T09:00" },
      { autor: "Bruno", dataHora: null },
    ]);
    expect(k.total).toBe(4);
    expect(k.autores).toBe(2);
    expect(k.semData).toBe(1);
    expect(k.primeiraData).toBe("2026-09-08");
    expect(k.ultimaData).toBe("2026-09-10");
    expect(k.dias).toBe(3);
    expect(k.mediaPorDia).toBe(1); // 3 mensagens com data / 3 dias
    expect(k.porAutor).toEqual([
      { autor: "Ana", total: 2 },
      { autor: "Bruno", total: 2 },
    ]);
    expect(k.porDia).toEqual([
      { dia: "2026-09-08", total: 2 },
      { dia: "2026-09-10", total: 1 },
    ]);
  });

  it("ordena autores por total (desc) e depois por nome", () => {
    const k = calcularKpis([
      { autor: "Zé", dataHora: "2026-09-08T09:00" },
      { autor: "Ana", dataHora: "2026-09-08T09:01" },
      { autor: "Zé", dataHora: "2026-09-08T09:02" },
    ]);
    expect(k.porAutor.map((a) => a.autor)).toEqual(["Zé", "Ana"]);
  });

  it("lista vazia ou sem nenhuma data não quebra", () => {
    expect(calcularKpis([])).toMatchObject({ total: 0, autores: 0, dias: 0, mediaPorDia: 0, primeiraData: null });
    expect(calcularKpis([{ autor: "Ana", dataHora: null }])).toMatchObject({
      total: 1,
      semData: 1,
      dias: 0,
      mediaPorDia: 0,
      porDia: [],
    });
  });
});
```

`app/src/lib/exportacao/caminhos.test.ts`:

```ts
import path from "node:path";
import { describe, expect, it } from "vitest";
import { estaDentro } from "./caminhos";

const base = path.resolve("/tmp/x/exports");

describe("estaDentro", () => {
  it("aceita arquivo dentro da pasta base", () => {
    expect(estaDentro(base, path.join(base, "a.txt"))).toBe(true);
    expect(estaDentro(base, path.join(base, "sub", "a.txt"))).toBe(true);
  });

  it("recusa a própria pasta, irmãs e travessia com ..", () => {
    expect(estaDentro(base, base)).toBe(false);
    expect(estaDentro(base, path.resolve("/tmp/x/exports2/a.txt"))).toBe(false);
    expect(estaDentro(base, path.join(base, "..", "segredo.txt"))).toBe(false);
  });
});
```

`app/src/lib/formatacao.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatarDataHora, formatarDia, formatarDuracao, formatarNumero } from "./formatacao";

describe("formatação", () => {
  it("formata data/hora ISO local e cai no original quando não há ISO", () => {
    expect(formatarDataHora("2026-09-08T11:09", "x")).toBe("08/09/2026 11:09");
    expect(formatarDataHora(null, "terça, sem data")).toBe("terça, sem data");
  });

  it("formata dia e número em pt-BR", () => {
    expect(formatarDia("2026-09-08")).toBe("08/09/2026");
    expect(formatarNumero(1527)).toBe("1.527");
  });

  it("formata duração", () => {
    expect(formatarDuracao("2026-09-21T10:00:00.000Z", "2026-09-21T10:00:42.000Z")).toBe("42 s");
    expect(formatarDuracao("2026-09-21T10:00:00.000Z", "2026-09-21T10:03:05.000Z")).toBe("3 min 5 s");
  });
});
```

Run: `npx vitest run src/lib/validarGrupo.test.ts src/lib/kpis.test.ts src/lib/exportacao/caminhos.test.ts src/lib/formatacao.test.ts` → FAIL.

- [ ] **Step 2: Implementar**

`app/src/lib/validarGrupo.ts`:

```ts
export const TAMANHO_MAXIMO_GRUPO = 200;

export type ResultadoGrupo = { ok: true; nome: string } | { ok: false; motivo: string };

/**
 * O nome vai para a linha de comando do script (sem shell, então não é
 * interpretado) e para a busca do Teams. Recusa o que não é texto de uma
 * linha só.
 */
export function validarGrupo(bruto: unknown): ResultadoGrupo {
  if (typeof bruto !== "string") return { ok: false, motivo: "Informe o nome do grupo." };
  const nome = bruto.trim();
  if (nome.length === 0) return { ok: false, motivo: "Informe o nome do grupo." };
  if (nome.length > TAMANHO_MAXIMO_GRUPO) {
    return { ok: false, motivo: `O nome do grupo deve ter no máximo ${TAMANHO_MAXIMO_GRUPO} caracteres.` };
  }
  if (/[\u0000-\u001f\u007f]/.test(nome)) {
    return { ok: false, motivo: "O nome do grupo tem caracteres inválidos." };
  }
  return { ok: true, nome };
}
```

`app/src/lib/kpis.ts`:

```ts
import type { LinhaKpi } from "@/types/dominio";

export interface Kpis {
  total: number;
  autores: number;
  /** Mensagens cuja data não foi interpretável; contam no total mas não nas séries. */
  semData: number;
  primeiraData: string | null;
  ultimaData: string | null;
  /** Dias corridos entre a primeira e a última mensagem, inclusive. */
  dias: number;
  /** Mensagens com data ÷ `dias`. */
  mediaPorDia: number;
  porAutor: { autor: string; total: number }[];
  porDia: { dia: string; total: number }[];
}

const MS_POR_DIA = 24 * 60 * 60 * 1000;

function diasEntre(inicio: string, fim: string): number {
  const a = Date.parse(`${inicio}T00:00:00Z`);
  const b = Date.parse(`${fim}T00:00:00Z`);
  return Math.round((b - a) / MS_POR_DIA) + 1;
}

export function calcularKpis(linhas: LinhaKpi[]): Kpis {
  const porAutor = new Map<string, number>();
  const porDia = new Map<string, number>();
  let semData = 0;

  for (const l of linhas) {
    porAutor.set(l.autor, (porAutor.get(l.autor) ?? 0) + 1);
    if (!l.dataHora) {
      semData++;
      continue;
    }
    const dia = l.dataHora.slice(0, 10);
    porDia.set(dia, (porDia.get(dia) ?? 0) + 1);
  }

  const dias = [...porDia.keys()].sort();
  const primeiraData = dias[0] ?? null;
  const ultimaData = dias[dias.length - 1] ?? null;
  const span = primeiraData && ultimaData ? diasEntre(primeiraData, ultimaData) : 0;

  return {
    total: linhas.length,
    autores: porAutor.size,
    semData,
    primeiraData,
    ultimaData,
    dias: span,
    mediaPorDia: span > 0 ? (linhas.length - semData) / span : 0,
    porAutor: [...porAutor.entries()]
      .map(([autor, total]) => ({ autor, total }))
      .sort((a, b) => b.total - a.total || a.autor.localeCompare(b.autor, "pt-BR")),
    porDia: dias.map((dia) => ({ dia, total: porDia.get(dia)! })),
  };
}
```

`app/src/lib/exportacao/caminhos.ts`:

```ts
import path from "node:path";

/**
 * `alvo` está estritamente dentro de `base`? Usa `path.relative`, que no
 * Windows ignora diferença de maiúsculas na letra do drive — um `startsWith`
 * simples falharia com `c:\` contra `C:\`.
 */
export function estaDentro(base: string, alvo: string): boolean {
  const relativo = path.relative(path.resolve(base), path.resolve(alvo));
  return relativo !== "" && !relativo.startsWith("..") && !path.isAbsolute(relativo);
}
```

`app/src/lib/formatacao.ts`:

```ts
export function formatarNumero(n: number): string {
  return new Intl.NumberFormat("pt-BR").format(n);
}

/** ISO local (`2026-09-08T11:09`) para `08/09/2026 11:09`; sem ISO, devolve o texto original do Teams. */
export function formatarDataHora(iso: string | null, original: string): string {
  if (!iso) return original;
  const [data, hora] = iso.split("T");
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano} ${hora}`;
}

/** `2026-09-08` para `08/09/2026`. */
export function formatarDia(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

/** Instante ISO (UTC) para data e hora locais. */
export function formatarInstante(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function formatarDuracao(inicioIso: string, fimIso: string | null): string {
  const ms = (fimIso ? Date.parse(fimIso) : Date.now()) - Date.parse(inicioIso);
  const segundos = Math.max(0, Math.round(ms / 1000));
  const minutos = Math.floor(segundos / 60);
  return minutos > 0 ? `${minutos} min ${segundos % 60} s` : `${segundos} s`;
}
```

- [ ] **Step 3: Rodar e ver passar**

Run: `npx vitest run src/lib/validarGrupo.test.ts src/lib/kpis.test.ts src/lib/exportacao/caminhos.test.ts src/lib/formatacao.test.ts`
Expected: tudo passa.

- [ ] **Step 4: Commit**

```bash
git add app
git commit -m "Adiciona validacao de grupo, KPIs, checagem de caminho e formatacao"
```

---

### Task 7: Importação de mensagens (`.json` do script e `.txt` antigo)

**Files:**
- Create: `app/src/lib/importacao.ts`
- Test: `app/src/lib/importacao.test.ts`

**Interfaces:**
- Consumes: `interpretarDataHoraPt` (Task 5), `parseTxt` (Task 5), `obterOuCriarGrupo`, `inserirMensagens`, `marcarUltimaExportacao` (Task 4).
- Produces:
  - `class ErroImportacao extends Error`
  - `importarMensagens(db, { grupoNome, exportacaoId, mensagens, agoraIso? }): { grupo; lidas; novas }`
  - `importarTxt(db, conteudo, grupoInformado?): { grupo; lidas; novas; totalDeclarado: number | null; divergencia: boolean }`
  - `importarJson(db, exportacaoId, dado: unknown): { grupo; lidas; novas }`

- [ ] **Step 1: Escrever o teste que falha (`app/src/lib/importacao.test.ts`)**

```ts
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";
import { aplicarEsquema } from "./db/migracoes";
import { consultarMensagens, listarGrupos, tentarCriarExportacao } from "./db/repositorio";
import { ErroImportacao, importarJson, importarTxt } from "./importacao";

let db: DatabaseSync;

beforeEach(() => {
  db = new DatabaseSync(":memory:");
  aplicarEsquema(db);
});

const TXT = [
  "Histórico do chat: Grupo de Teste",
  "Exportado em: 21/09/2026 09:23",
  "Total de mensagens: 2",
  "============================================================",
  "",
  "[segunda-feira, 7 de setembro de 2026 10:00] Ana Teste:",
  "Primeira",
  "",
  "[terça-feira, 8 de setembro de 2026 11:09] Bruno Teste:",
  "Segunda",
  "",
].join("\n");

describe("importarTxt", () => {
  it("cria o grupo, interpreta as datas e é idempotente", () => {
    const r = importarTxt(db, TXT);
    expect(r).toMatchObject({ grupo: "Grupo de Teste", lidas: 2, novas: 2, totalDeclarado: 2, divergencia: false });

    const grupo = listarGrupos(db)[0];
    const { itens } = consultarMensagens(db, { grupoId: grupo.id }, 1, 50);
    expect(itens.map((m) => m.dataHora)).toEqual(["2026-09-07T10:00", "2026-09-08T11:09"]);

    expect(importarTxt(db, TXT)).toMatchObject({ lidas: 2, novas: 0 });
  });

  it("sinaliza divergência entre o total declarado e o lido", () => {
    const r = importarTxt(db, TXT.replace("Total de mensagens: 2", "Total de mensagens: 5"));
    expect(r.divergencia).toBe(true);
    expect(r.totalDeclarado).toBe(5);
  });

  it("sem cabeçalho exige o nome do grupo", () => {
    const semCabecalho = TXT.split("\n").slice(5).join("\n");
    expect(() => importarTxt(db, semCabecalho)).toThrow(ErroImportacao);
    expect(importarTxt(db, semCabecalho, "Meu grupo").grupo).toBe("Meu grupo");
  });

  it("o nome informado prevalece sobre o do cabeçalho", () => {
    expect(importarTxt(db, TXT, "Outro nome").grupo).toBe("Outro nome");
  });

  it("arquivo sem mensagens é recusado", () => {
    expect(() => importarTxt(db, "Histórico do chat: X\n", undefined)).toThrow(ErroImportacao);
  });
});

describe("importarJson", () => {
  const json = {
    grupo: "Grupo JSON",
    exportado_em: "2026-09-21T09:23:00",
    mensagens: [
      { autor: "Ana", data_hora_original: "terça-feira, 8 de setembro de 2026 11:09", texto: "Oi" },
      { autor: "Bruno", data_hora_original: "sem data", texto: "Tchau" },
    ],
  };

  it("grava as mensagens ligadas à exportação e marca a última exportação do grupo", () => {
    const id = tentarCriarExportacao(db, "Grupo JSON", "2026-09-21T10:00:00.000Z")!;
    const r = importarJson(db, id, json);
    expect(r).toEqual({ grupo: "Grupo JSON", lidas: 2, novas: 2 });

    const linha = db.prepare("SELECT exportacao_id, data_hora FROM mensagens ORDER BY id").all() as unknown as {
      exportacao_id: number;
      data_hora: string | null;
    }[];
    expect(linha.map((l) => l.exportacao_id)).toEqual([id, id]);
    expect(linha.map((l) => l.data_hora)).toEqual(["2026-09-08T11:09", null]);

    const grupo = db.prepare("SELECT ultima_exportacao_em FROM grupos").get() as unknown as {
      ultima_exportacao_em: string | null;
    };
    expect(grupo.ultima_exportacao_em).not.toBeNull();
  });

  it("recusa estrutura inválida", () => {
    expect(() => importarJson(db, 1, null)).toThrow(ErroImportacao);
    expect(() => importarJson(db, 1, { grupo: "G", mensagens: "x" })).toThrow(ErroImportacao);
    expect(() => importarJson(db, 1, { grupo: "G", mensagens: [{ autor: 1 }] })).toThrow(ErroImportacao);
    expect(() => importarJson(db, 1, { mensagens: [] })).toThrow(ErroImportacao);
  });
});

// Validação com dado real: só roda se existir um export do CAPAG em ../exports.
const pastaExports = path.resolve(process.cwd(), "..", "exports");
const arquivoReal = existsSync(pastaExports)
  ? readdirSync(pastaExports).find((n) => n.startsWith("Projetos_CAPAG") && n.endsWith(".txt"))
  : undefined;

describe.skipIf(!arquivoReal)("importarTxt com o export real do CAPAG", () => {
  it("importa todas as mensagens declaradas, sem perder nenhuma", () => {
    const r = importarTxt(db, readFileSync(path.join(pastaExports, arquivoReal!), "utf8"));
    expect(r.divergencia).toBe(false);
    expect(r.lidas).toBe(r.totalDeclarado);
    expect(r.novas).toBe(r.lidas);
    const semData = db.prepare("SELECT COUNT(*) AS n FROM mensagens WHERE data_hora IS NULL").get() as unknown as {
      n: number;
    };
    expect(semData.n).toBe(0);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run (em `app/`): `npx vitest run src/lib/importacao.test.ts`
Expected: FAIL (`Cannot find module './importacao'`).

- [ ] **Step 3: Implementar `app/src/lib/importacao.ts`**

```ts
import type { DatabaseSync } from "node:sqlite";
import type { MensagemBruta } from "@/types/dominio";
import { interpretarDataHoraPt } from "./dataPt";
import { inserirMensagens, marcarUltimaExportacao, obterOuCriarGrupo } from "./db/repositorio";
import { parseTxt } from "./parseTxt";

/** Erro esperado de uma importação (entrada inválida) — a API o devolve como 400. */
export class ErroImportacao extends Error {}

export interface ResultadoImportacao {
  grupo: string;
  lidas: number;
  novas: number;
}

export function importarMensagens(
  db: DatabaseSync,
  params: { grupoNome: string; exportacaoId: number | null; mensagens: MensagemBruta[]; agoraIso?: string }
): ResultadoImportacao {
  const { grupoNome, exportacaoId, mensagens } = params;
  const grupoId = obterOuCriarGrupo(db, grupoNome);
  const { lidas, novas } = inserirMensagens(
    db,
    grupoId,
    exportacaoId,
    mensagens.map((m) => ({ ...m, dataHora: interpretarDataHoraPt(m.dataHoraOriginal) }))
  );
  // Só uma exportação de verdade conta como "última exportação" do grupo;
  // importar um .txt antigo não.
  if (exportacaoId !== null) marcarUltimaExportacao(db, grupoId, params.agoraIso ?? new Date().toISOString());
  return { grupo: grupoNome, lidas, novas };
}

export interface ResultadoImportacaoTxt extends ResultadoImportacao {
  totalDeclarado: number | null;
  /** O "Total de mensagens" do cabeçalho não bate com o que foi lido. */
  divergencia: boolean;
}

/** Importa um `.txt` produzido pelo script. O nome informado prevalece sobre o do cabeçalho. */
export function importarTxt(db: DatabaseSync, conteudo: string, grupoInformado?: string): ResultadoImportacaoTxt {
  const lido = parseTxt(conteudo);
  const grupo = grupoInformado?.trim() || lido.grupo;
  if (!grupo) {
    throw new ErroImportacao(
      'O arquivo não tem o cabeçalho "Histórico do chat: ...". Informe o nome do grupo.'
    );
  }
  if (lido.mensagens.length === 0) {
    throw new ErroImportacao("Nenhuma mensagem encontrada no arquivo.");
  }

  const r = importarMensagens(db, { grupoNome: grupo, exportacaoId: null, mensagens: lido.mensagens });
  return {
    ...r,
    totalDeclarado: lido.totalDeclarado,
    divergencia: lido.totalDeclarado !== null && lido.totalDeclarado !== lido.mensagens.length,
  };
}

function ehTexto(valor: unknown): valor is string {
  return typeof valor === "string";
}

/** Importa o `.json` do `--json-out` de uma exportação. */
export function importarJson(db: DatabaseSync, exportacaoId: number, dado: unknown): ResultadoImportacao {
  if (typeof dado !== "object" || dado === null) throw new ErroImportacao("JSON de exportação inválido.");
  const { grupo, mensagens } = dado as { grupo?: unknown; mensagens?: unknown };
  if (!ehTexto(grupo) || !grupo.trim()) throw new ErroImportacao('JSON de exportação sem o campo "grupo".');
  if (!Array.isArray(mensagens)) throw new ErroImportacao('JSON de exportação sem a lista "mensagens".');

  const lidas: MensagemBruta[] = mensagens.map((m, i) => {
    const { autor, data_hora_original, texto } = (m ?? {}) as Record<string, unknown>;
    if (!ehTexto(autor) || !ehTexto(data_hora_original) || !ehTexto(texto)) {
      throw new ErroImportacao(`Mensagem ${i + 1} do JSON está incompleta.`);
    }
    return { autor, dataHoraOriginal: data_hora_original, texto };
  });

  return importarMensagens(db, { grupoNome: grupo.trim(), exportacaoId, mensagens: lidas });
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/importacao.test.ts`
Expected: tudo passa. O teste com o export real do CAPAG roda nesta máquina e prova que nenhuma das 1527 mensagens se perde (nem fica sem data).

- [ ] **Step 5: Commit**

```bash
git add app
git commit -m "Adiciona importacao de mensagens (json do script e txt antigo)"
```

---

### Task 8: Orquestrador da exportação (processo filho)

**Files:**
- Create: `app/src/lib/exportacao/config.ts`, `app/src/lib/exportacao/encerrarArvore.ts`, `app/src/lib/exportacao/orquestrador.ts`, `app/src/lib/exportacao/__fixtures__/fake-teams.mjs`
- Test: `app/src/lib/exportacao/config.test.ts`, `app/src/lib/exportacao/orquestrador.test.ts`

**Interfaces:**
- Consumes: `tentarCriarExportacao`, `atualizarExportacao`, `obterExportacao` (Task 4), `importarJson` (Task 7), `interpretarLinha` (Task 5), `validarGrupo` (Task 6).
- Produces:
  - `interface ConfigExportacao { python; script; cwd; exportsDir; timeoutMs }` e `lerConfigExportacao(env?, base?): ConfigExportacao`
  - `encerrarArvore(pid: number | undefined): void`
  - `interface DepsOrquestrador { db: DatabaseSync; config: ConfigExportacao; agora?: () => Date }`
  - `iniciarExportacao(deps, grupoBruto: unknown): { ok: true; id: number } | { ok: false; codigo: "GRUPO_INVALIDO" | "EM_ANDAMENTO" | "PYTHON_AUSENTE"; mensagem: string }`
  - `cancelarExportacao(id: number): boolean`

- [ ] **Step 1: Teste da config (falha) e implementação**

`app/src/lib/exportacao/config.test.ts`:

```ts
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
});
```

Rodar → FAIL. Criar `app/src/lib/exportacao/config.ts`:

```ts
import path from "node:path";

export interface ConfigExportacao {
  python: string;
  script: string;
  /** Pasta de trabalho do script: a raiz do projeto, onde ficam `teams_profile/` e `exports/`. */
  cwd: string;
  exportsDir: string;
  timeoutMs: number;
}

const TIMEOUT_PADRAO_MIN = 30;

/**
 * Lê a configuração do ambiente. `base` é a pasta `app/` (o `cwd` do servidor
 * Next); os padrões apontam para a raiz do projeto, um nível acima. Variável
 * vazia conta como ausente: `KEY=` num `.env` chega como string vazia.
 */
export function lerConfigExportacao(env: NodeJS.ProcessEnv = process.env, base: string = process.cwd()): ConfigExportacao {
  const raiz = path.resolve(base, "..");
  const pythonPadrao =
    process.platform === "win32" ? path.join(".venv", "Scripts", "python.exe") : path.join(".venv", "bin", "python");
  const minutos = Number(env.EXTRATOR_TIMEOUT_MIN);

  return {
    python: env.TEAMS_PYTHON ? path.resolve(base, env.TEAMS_PYTHON) : path.join(raiz, pythonPadrao),
    script: env.TEAMS_SCRIPT ? path.resolve(base, env.TEAMS_SCRIPT) : path.join(raiz, "teams_chat_export.py"),
    cwd: raiz,
    exportsDir: path.join(raiz, "exports"),
    timeoutMs: (Number.isFinite(minutos) && minutos > 0 ? minutos : TIMEOUT_PADRAO_MIN) * 60_000,
  };
}
```

Rodar → 3 passam.

- [ ] **Step 2: `encerrarArvore.ts`**

```ts
import { spawnSync } from "node:child_process";

/**
 * Encerra o processo e todos os descendentes. Só matar o Python deixaria o
 * Edge órfão segurando o `teams_profile`, e a próxima exportação falharia.
 * No Windows usa `taskkill /T /F`; no POSIX o processo foi criado com
 * `detached` (grupo próprio), então o sinal vai para o grupo inteiro.
 */
export function encerrarArvore(pid: number | undefined): void {
  if (!pid) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { windowsHide: true });
    return;
  }
  try {
    process.kill(-pid, "SIGKILL");
  } catch {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // Já terminou.
    }
  }
}
```

- [ ] **Step 3: Script falso para os testes (`__fixtures__/fake-teams.mjs`)**

O teste aponta `python` para o executável do Node e `script` para este arquivo, então o orquestrador roda exatamente como rodaria o Python real, sem abrir o Teams.

```js
// Simula teams_chat_export.py: imprime as mesmas linhas de progresso e grava o --json-out.
// Modo (env FAKE_MODO): "sucesso" (padrão), "erro" (sai com código 1) ou "lento" (dorme 60 s).
import { writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const grupo = args[0];
const saida = args[args.indexOf("--json-out") + 1];
const modo = process.env.FAKE_MODO ?? "sucesso";
const dormir = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

console.log("\n>> Uma janela do navegador foi aberta.");
console.log(">> Login detectado, continuando...\n");
console.log(`>> Procurando o grupo/chat "${grupo}"...`);
console.log(`>> Abrindo: "${grupo}Ana, Bruno, +2"`);
console.log(">> Lendo o histórico da conversa (isso pode levar alguns minutos em grupos grandes)...");

if (modo === "lento") await dormir(60_000);
if (modo === "erro") {
  console.error("RuntimeError: Nenhum resultado encontrado");
  process.exit(1);
}

console.log("   ... 2 mensagens únicas encontradas até agora (iteração 10)");
console.log(">> Total de mensagens únicas capturadas: 2");
writeFileSync(
  saida,
  JSON.stringify({
    grupo,
    exportado_em: "2026-09-21T09:23:00",
    mensagens: [
      { autor: "Ana", data_hora_original: "terça-feira, 8 de setembro de 2026 11:09", texto: "Primeira" },
      { autor: "Bruno", data_hora_original: "terça-feira, 8 de setembro de 2026 11:10", texto: "Segunda" },
    ],
  })
);
console.log(`>> JSON salvo em: ${saida}`);
console.log(">> Pronto! Arquivo salvo em: C:\\fake\\arquivo.txt");
```

- [ ] **Step 4: Teste do orquestrador (falha) — `orquestrador.test.ts`**

```ts
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { aplicarEsquema } from "@/lib/db/migracoes";
import { consultarMensagens, listarGrupos, obterExportacao } from "@/lib/db/repositorio";
import type { ConfigExportacao } from "./config";
import { cancelarExportacao, iniciarExportacao } from "./orquestrador";

const FAKE = path.resolve(import.meta.dirname, "__fixtures__", "fake-teams.mjs");

let db: DatabaseSync;
let tmp: string;
let config: ConfigExportacao;

beforeEach(() => {
  db = new DatabaseSync(":memory:");
  aplicarEsquema(db);
  tmp = mkdtempSync(path.join(tmpdir(), "extrator-"));
  config = { python: process.execPath, script: FAKE, cwd: tmp, exportsDir: tmp, timeoutMs: 20_000 };
});

afterEach(() => {
  delete process.env.FAKE_MODO;
  rmSync(tmp, { recursive: true, force: true });
});

async function aguardar(condicao: () => boolean, ms = 15_000): Promise<void> {
  const fim = Date.now() + ms;
  while (!condicao()) {
    if (Date.now() > fim) throw new Error("tempo esgotado esperando a condição do teste");
    await new Promise((r) => setTimeout(r, 50));
  }
}

const terminou = (id: number) => obterExportacao(db, id)!.status !== "em_andamento";

function iniciar(grupo: unknown) {
  const r = iniciarExportacao({ db, config }, grupo);
  if (!r.ok) throw new Error(`não iniciou: ${r.mensagem}`);
  return r.id;
}

describe("iniciarExportacao", () => {
  it("sucesso: acompanha o progresso e importa as mensagens", async () => {
    const id = iniciar("Grupo X");
    await aguardar(() => terminou(id));

    const e = obterExportacao(db, id)!;
    expect(e).toMatchObject({
      status: "concluida",
      etapa: "salvando",
      grupo: "Grupo X",
      grupoAberto: "Grupo XAna, Bruno, +2",
      contador: 2,
      totalMensagens: 2,
      arquivoTxt: "C:\\fake\\arquivo.txt",
      erroMsg: null,
    });
    expect(e.finalizadaEm).not.toBeNull();
    expect(e.logTail).toContain("Pronto! Arquivo salvo em");

    const grupo = listarGrupos(db).find((g) => g.nome === "Grupo X")!;
    expect(consultarMensagens(db, { grupoId: grupo.id }, 1, 50).itens.map((m) => m.texto)).toEqual([
      "Primeira",
      "Segunda",
    ]);
  });

  it("erro do script: status erro com código e última linha", async () => {
    process.env.FAKE_MODO = "erro";
    const id = iniciar("Grupo X");
    await aguardar(() => terminou(id));

    const e = obterExportacao(db, id)!;
    expect(e.status).toBe("erro");
    expect(e.erroMsg).toContain("código 1");
    expect(e.erroMsg).toContain("RuntimeError");
    expect(e.logTail).toContain("RuntimeError");
    expect(listarGrupos(db).find((g) => g.nome === "Grupo X")!.total).toBe(0);
  });

  it("recusa a segunda exportação enquanto a primeira roda (EM_ANDAMENTO)", async () => {
    process.env.FAKE_MODO = "lento";
    const id = iniciar("Grupo A");
    const segunda = iniciarExportacao({ db, config }, "Grupo B");
    expect(segunda).toMatchObject({ ok: false, codigo: "EM_ANDAMENTO" });

    cancelarExportacao(id);
    await aguardar(() => terminou(id));
  }, 20_000);

  it("cancelar encerra o processo e marca cancelada, sem importar nada", async () => {
    process.env.FAKE_MODO = "lento";
    const id = iniciar("Grupo A");
    await aguardar(() => obterExportacao(db, id)!.etapa === "lendo_historico");

    expect(cancelarExportacao(id)).toBe(true);
    await aguardar(() => terminou(id));

    expect(obterExportacao(db, id)!.status).toBe("cancelada");
    expect(listarGrupos(db).find((g) => g.nome === "Grupo A")!.total).toBe(0);
    expect(cancelarExportacao(id)).toBe(false);
  }, 20_000);

  it("estourar o tempo limite encerra e marca erro", async () => {
    process.env.FAKE_MODO = "lento";
    config = { ...config, timeoutMs: 800 };
    const id = iniciar("Grupo A");
    await aguardar(() => terminou(id));

    const e = obterExportacao(db, id)!;
    expect(e.status).toBe("erro");
    expect(e.erroMsg).toMatch(/Tempo esgotado/);
  }, 20_000);

  it("Python ou script ausente: PYTHON_AUSENTE, sem criar execução", () => {
    const r = iniciarExportacao({ db, config: { ...config, python: path.join(tmp, "nao-existe.exe") } }, "G");
    expect(r).toMatchObject({ ok: false, codigo: "PYTHON_AUSENTE" });
    expect(obterExportacao(db, 1)).toBeNull();
  });

  it("nome de grupo inválido: GRUPO_INVALIDO", () => {
    expect(iniciarExportacao({ db, config }, "")).toMatchObject({ ok: false, codigo: "GRUPO_INVALIDO" });
    expect(iniciarExportacao({ db, config }, "a\nb")).toMatchObject({ ok: false, codigo: "GRUPO_INVALIDO" });
  });
});
```

Run (em `app/`): `npx vitest run src/lib/exportacao` → FAIL (`Cannot find module './orquestrador'`).

- [ ] **Step 5: Implementar `orquestrador.ts`**

```ts
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline";
import type { DatabaseSync } from "node:sqlite";
import { atualizarExportacao, tentarCriarExportacao, type CamposExportacao } from "@/lib/db/repositorio";
import { importarJson } from "@/lib/importacao";
import { interpretarLinha } from "@/lib/parseProgresso";
import { validarGrupo } from "@/lib/validarGrupo";
import type { ConfigExportacao } from "./config";
import { encerrarArvore } from "./encerrarArvore";

export interface DepsOrquestrador {
  db: DatabaseSync;
  config: ConfigExportacao;
  agora?: () => Date;
}

export type ResultadoInicio =
  | { ok: true; id: number }
  | { ok: false; codigo: "GRUPO_INVALIDO" | "EM_ANDAMENTO" | "PYTHON_AUSENTE"; mensagem: string };

interface Execucao {
  child: ChildProcess;
  timer: NodeJS.Timeout;
  cancelada: boolean;
  expirou: boolean;
}

/**
 * Registro dos processos vivos, em `globalThis`: o Next pode carregar este
 * módulo em mais de uma instância (rotas e recarga a quente), e cancelar só
 * funciona se todas enxergarem o mesmo mapa.
 */
const g = globalThis as unknown as { __extratorExecucoes?: Map<number, Execucao> };
const execucoes = (g.__extratorExecucoes ??= new Map<number, Execucao>());

const LINHAS_DE_LOG = 50;

function mensagemDe(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro);
}

function descreverLimite(ms: number): string {
  return ms >= 60_000 ? `${Math.round(ms / 60_000)} min` : `${Math.round(ms / 1000)} s`;
}

/**
 * Valida o grupo, reserva a vaga (uma exportação por vez) e dispara o script
 * em segundo plano. Devolve na hora; o andamento é lido do banco.
 */
export function iniciarExportacao(deps: DepsOrquestrador, grupoBruto: unknown): ResultadoInicio {
  const { db, config } = deps;
  const agora = deps.agora ?? (() => new Date());

  const grupo = validarGrupo(grupoBruto);
  if (!grupo.ok) return { ok: false, codigo: "GRUPO_INVALIDO", mensagem: grupo.motivo };

  if (!existsSync(config.python) || !existsSync(config.script)) {
    return {
      ok: false,
      codigo: "PYTHON_AUSENTE",
      mensagem:
        "Python do venv ou script de exportação não encontrado. Rode scripts\\setup.ps1 na raiz do projeto " +
        "(ou ajuste TEAMS_PYTHON / TEAMS_SCRIPT em app/.env.local).",
    };
  }

  const id = tentarCriarExportacao(db, grupo.nome, agora().toISOString());
  if (id === null) {
    return { ok: false, codigo: "EM_ANDAMENTO", mensagem: "Já existe uma exportação em andamento. Aguarde ou cancele." };
  }

  mkdirSync(config.exportsDir, { recursive: true });
  const arquivoJson = path.join(config.exportsDir, `exportacao_${id}.json`);
  atualizarExportacao(db, id, { arquivoJson });

  executar(deps, id, grupo.nome, arquivoJson);
  return { ok: true, id };
}

/** Encerra a árvore de processos de uma exportação. `false` se ela não está rodando. */
export function cancelarExportacao(id: number): boolean {
  const execucao = execucoes.get(id);
  if (!execucao) return false;
  execucao.cancelada = true;
  encerrarArvore(execucao.child.pid);
  return true;
}

function executar(deps: DepsOrquestrador, id: number, grupo: string, arquivoJson: string): void {
  const { db, config } = deps;
  const agora = deps.agora ?? (() => new Date());
  const linhas: string[] = [];
  let finalizado = false;

  /** Grava o estado final uma única vez, seja qual for o caminho que chegou aqui. */
  const finalizar = (campos: CamposExportacao) => {
    if (finalizado) return;
    finalizado = true;
    const execucao = execucoes.get(id);
    if (execucao) clearTimeout(execucao.timer);
    execucoes.delete(id);
    atualizarExportacao(db, id, { ...campos, finalizadaEm: agora().toISOString(), logTail: linhas.join("\n") });
  };

  let child: ChildProcess;
  try {
    child = spawn(config.python, [config.script, grupo, "--json-out", arquivoJson], {
      cwd: config.cwd,
      env: { ...process.env, PYTHONUNBUFFERED: "1", PYTHONIOENCODING: "utf-8" },
      stdio: ["ignore", "pipe", "pipe"],
      detached: process.platform !== "win32",
    });
  } catch (erro) {
    finalizar({ status: "erro", erroMsg: `Não foi possível iniciar o script: ${mensagemDe(erro)}` });
    return;
  }

  const execucao: Execucao = {
    child,
    cancelada: false,
    expirou: false,
    timer: setTimeout(() => {
      execucao.expirou = true;
      encerrarArvore(child.pid);
    }, config.timeoutMs),
  };
  execucoes.set(id, execucao);

  const tratarLinha = (linha: string) => {
    if (!linha.trim()) return;
    linhas.push(linha);
    if (linhas.length > LINHAS_DE_LOG) linhas.shift();

    const evento = interpretarLinha(linha);
    const campos: CamposExportacao = { logTail: linhas.join("\n") };
    if (evento?.etapa) campos.etapa = evento.etapa;
    if (evento?.contador !== undefined) campos.contador = evento.contador;
    if (evento?.grupoAberto !== undefined) campos.grupoAberto = evento.grupoAberto;
    if (evento?.arquivoTxt !== undefined) campos.arquivoTxt = evento.arquivoTxt;
    atualizarExportacao(db, id, campos);
  };

  child.stdout!.setEncoding("utf8");
  child.stderr!.setEncoding("utf8");
  const saida = createInterface({ input: child.stdout! });
  const erros = createInterface({ input: child.stderr! });
  saida.on("line", tratarLinha);
  erros.on("line", tratarLinha);
  // O 'close' do processo pode chegar antes da última linha ser lida.
  const leituraCompleta = Promise.all([
    new Promise<void>((resolver) => saida.on("close", resolver)),
    new Promise<void>((resolver) => erros.on("close", resolver)),
  ]);

  child.on("error", (erro) => {
    finalizar({ status: "erro", erroMsg: `Falha ao executar o script: ${mensagemDe(erro)}` });
  });

  child.on("close", async (codigo) => {
    await leituraCompleta;

    if (execucao.cancelada) return finalizar({ status: "cancelada", erroMsg: null });
    if (execucao.expirou) {
      return finalizar({
        status: "erro",
        erroMsg: `Tempo esgotado (limite de ${descreverLimite(config.timeoutMs)}). A exportação foi encerrada.`,
      });
    }
    if (codigo !== 0) {
      const ultima = [...linhas].reverse().find((l) => l.trim());
      return finalizar({
        status: "erro",
        erroMsg: `O script terminou com código ${codigo}.${ultima ? ` Última linha: ${ultima}` : ""}`,
      });
    }

    try {
      const resultado = importarJson(db, id, JSON.parse(readFileSync(arquivoJson, "utf8")));
      finalizar({ status: "concluida", totalMensagens: resultado.lidas, contador: resultado.lidas, erroMsg: null });
    } catch (erro) {
      finalizar({
        status: "erro",
        erroMsg: `O script terminou, mas a importação falhou: ${mensagemDe(erro)}. Os arquivos foram mantidos em exports/.`,
      });
    }
  });
}
```

- [ ] **Step 6: Rodar e ver passar**

Run: `npx vitest run src/lib/exportacao`
Expected: `config` (3) e `orquestrador` (7) passam. Se algum teste de cancelar/timeout ficar pendurado, há um processo `node` do `fake-teams.mjs` sobrando: `taskkill /IM node.exe /F` **não** — feche só o terminal do teste e investigue a árvore com `Get-CimInstance Win32_Process -Filter "CommandLine like '%fake-teams%'"`.
Run: `npx tsc --noEmit` → sem erros.

- [ ] **Step 7: Commit**

```bash
git add app
git commit -m "Adiciona orquestrador da exportacao (processo filho, progresso, cancelar e timeout)"
```

---

### Task 9: Rotas de API

**Files:**
- Modify: `app/next.config.ts` (limite de corpo do proxy)
- Create: `app/src/lib/api.ts`, `app/src/lib/parametros.ts`
- Test: `app/src/lib/parametros.test.ts`
- Create: `app/src/app/api/exportacoes/route.ts`, `app/src/app/api/exportacoes/[id]/route.ts`, `app/src/app/api/exportacoes/[id]/cancelar/route.ts`, `app/src/app/api/exportacoes/[id]/download/route.ts`, `app/src/app/api/grupos/route.ts`, `app/src/app/api/mensagens/route.ts`, `app/src/app/api/analise/route.ts`, `app/src/app/api/importar/route.ts`

**Interfaces:**
- Consumes: tudo das Tasks 4–8.
- Produces (respostas JSON; erros sempre `{error:{code,message}}`):
  - `POST /api/exportacoes {grupo}` → 202 `{id}` | 400 `GRUPO_INVALIDO` | 409 `EM_ANDAMENTO` | 500 `PYTHON_AUSENTE`
  - `GET /api/exportacoes` → `{exportacoes: Exportacao[]}`; `GET /api/exportacoes/[id]` → `{exportacao}` | 404
  - `POST /api/exportacoes/[id]/cancelar` → `{ok: boolean}`; `GET /api/exportacoes/[id]/download` → `.txt` anexo | 404
  - `GET /api/grupos` → `{grupos: GrupoResumo[]}`
  - `GET /api/mensagens?grupoId&autor&de&ate&q&pagina&porPagina` → `{itens, total, pagina, porPagina, autores}`
  - `GET /api/analise?grupoId&autor&de&ate&q` → `{kpis: Kpis}`
  - `POST /api/importar` (multipart: `arquivo` .txt, `grupo` opcional) → `{grupo, lidas, novas, totalDeclarado, divergencia}`
  - Helpers: `erroApi(code, message, status)`, `okJson(dados, status?)`; `inteiro(valor)`, `dataIso(valor)`, `limitar(n, min, max, padrao)`, `lerFiltros(searchParams)`.

- [ ] **Step 1: Teste dos parâmetros (falha) — `app/src/lib/parametros.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { dataIso, inteiro, lerFiltros, limitar } from "./parametros";

describe("parâmetros de consulta", () => {
  it("inteiro só aceita número inteiro", () => {
    expect(inteiro("12")).toBe(12);
    expect(inteiro("1.5")).toBeNull();
    expect(inteiro("abc")).toBeNull();
    expect(inteiro("")).toBeNull();
    expect(inteiro(null)).toBeNull();
  });

  it("dataIso só aceita AAAA-MM-DD", () => {
    expect(dataIso("2026-09-08")).toBe("2026-09-08");
    expect(dataIso("08/09/2026")).toBeUndefined();
    expect(dataIso(null)).toBeUndefined();
  });

  it("limitar respeita o intervalo e cai no padrão", () => {
    expect(limitar(500, 10, 200, 50)).toBe(200);
    expect(limitar(1, 10, 200, 50)).toBe(10);
    expect(limitar(null, 10, 200, 50)).toBe(50);
  });

  it("lerFiltros exige grupoId e ignora valores inválidos", () => {
    expect(lerFiltros(new URLSearchParams(""))).toEqual({ erro: "Informe o grupo (grupoId)." });
    expect(lerFiltros(new URLSearchParams("grupoId=3&autor=Ana&de=2026-09-01&ate=lixo&q=%20oi%20"))).toEqual({
      filtros: { grupoId: 3, autor: "Ana", de: "2026-09-01", ate: undefined, texto: "oi" },
    });
  });
});
```

Run (em `app/`): `npx vitest run src/lib/parametros.test.ts` → FAIL.

- [ ] **Step 2: Criar `app/src/lib/parametros.ts`**

```ts
import type { FiltrosMensagens } from "@/types/dominio";

export function inteiro(valor: string | null): number | null {
  if (valor === null || valor.trim() === "") return null;
  const n = Number(valor);
  return Number.isInteger(n) ? n : null;
}

/** Só `AAAA-MM-DD`; qualquer outra coisa é ignorada em vez de virar erro. */
export function dataIso(valor: string | null): string | undefined {
  return valor && /^\d{4}-\d{2}-\d{2}$/.test(valor) ? valor : undefined;
}

export function limitar(n: number | null, minimo: number, maximo: number, padrao: number): number {
  if (n === null) return padrao;
  return Math.min(maximo, Math.max(minimo, n));
}

/** Filtros de mensagens a partir da query string, compartilhados por /api/mensagens e /api/analise. */
export function lerFiltros(params: URLSearchParams): { filtros: FiltrosMensagens } | { erro: string } {
  const grupoId = inteiro(params.get("grupoId"));
  if (grupoId === null) return { erro: "Informe o grupo (grupoId)." };
  const autor = params.get("autor")?.trim();
  const texto = params.get("q")?.trim().slice(0, 200);
  return {
    filtros: {
      grupoId,
      autor: autor || undefined,
      de: dataIso(params.get("de")),
      ate: dataIso(params.get("ate")),
      texto: texto || undefined,
    },
  };
}
```

Rodar → passa.

- [ ] **Step 3: `api.ts` e limite de corpo no `next.config.ts`**

`app/src/lib/api.ts`:

```ts
import { NextResponse } from "next/server";

/**
 * `private` NÃO É NEGOCIÁVEL. Estas rotas devolvem conversas atrás da
 * barreira de sessão; com `public`, um cache compartilhado no caminho poderia
 * guardar a resposta de uma sessão autenticada e entregá-la a quem nunca
 * passou pelo login.
 */
export const CABECALHOS_PRIVADOS = { "Cache-Control": "private, no-store" } as const;

export function erroApi(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status, headers: CABECALHOS_PRIVADOS });
}

export function okJson<T>(dados: T, status = 200) {
  return NextResponse.json(dados, { status, headers: CABECALHOS_PRIVADOS });
}
```

Em `app/next.config.ts`, acrescentar dentro de `nextConfig` (o proxy do Next bufferiza o corpo das requisições e, por padrão, corta em 10 MB — o upload aceita até 20 MB):

```ts
  experimental: {
    // Com o proxy de sessão ativo o Next copia o corpo da requisição na
    // memória e, sem isto, truncaria em silêncio um upload acima de 10 MB.
    // 21 MB = limite de 20 MB do arquivo + o envelope do multipart.
    proxyClientMaxBodySize: "21mb",
  },
```

- [ ] **Step 4: Rotas de exportação**

`app/src/app/api/exportacoes/route.ts`:

```ts
import type { NextRequest } from "next/server";
import { erroApi, okJson } from "@/lib/api";
import { obterBanco } from "@/lib/db/conexao";
import { listarExportacoes } from "@/lib/db/repositorio";
import { lerConfigExportacao } from "@/lib/exportacao/config";
import { iniciarExportacao } from "@/lib/exportacao/orquestrador";

export const dynamic = "force-dynamic";

export async function GET() {
  return okJson({ exportacoes: listarExportacoes(obterBanco()) });
}

const STATUS_POR_CODIGO = { GRUPO_INVALIDO: 400, EM_ANDAMENTO: 409, PYTHON_AUSENTE: 500 } as const;

export async function POST(request: NextRequest) {
  let grupo: unknown;
  try {
    grupo = ((await request.json()) as { grupo?: unknown }).grupo;
  } catch {
    grupo = undefined;
  }

  const resultado = iniciarExportacao({ db: obterBanco(), config: lerConfigExportacao() }, grupo);
  if (resultado.ok) return okJson({ id: resultado.id }, 202);
  return erroApi(resultado.codigo, resultado.mensagem, STATUS_POR_CODIGO[resultado.codigo]);
}
```

`app/src/app/api/exportacoes/[id]/route.ts`:

```ts
import type { NextRequest } from "next/server";
import { erroApi, okJson } from "@/lib/api";
import { obterBanco } from "@/lib/db/conexao";
import { obterExportacao } from "@/lib/db/repositorio";
import { inteiro } from "@/lib/parametros";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = inteiro((await params).id);
  if (id === null) return erroApi("ID_INVALIDO", "Identificador inválido.", 400);
  const exportacao = obterExportacao(obterBanco(), id);
  if (!exportacao) return erroApi("NAO_ENCONTRADA", "Exportação não encontrada.", 404);
  return okJson({ exportacao });
}
```

`app/src/app/api/exportacoes/[id]/cancelar/route.ts`:

```ts
import type { NextRequest } from "next/server";
import { erroApi, okJson } from "@/lib/api";
import { cancelarExportacao } from "@/lib/exportacao/orquestrador";
import { inteiro } from "@/lib/parametros";

export const dynamic = "force-dynamic";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = inteiro((await params).id);
  if (id === null) return erroApi("ID_INVALIDO", "Identificador inválido.", 400);
  return okJson({ ok: cancelarExportacao(id) });
}
```

`app/src/app/api/exportacoes/[id]/download/route.ts`:

```ts
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { NextRequest } from "next/server";
import { CABECALHOS_PRIVADOS, erroApi } from "@/lib/api";
import { obterBanco } from "@/lib/db/conexao";
import { obterExportacao } from "@/lib/db/repositorio";
import { lerConfigExportacao } from "@/lib/exportacao/config";
import { estaDentro } from "@/lib/exportacao/caminhos";
import { inteiro } from "@/lib/parametros";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = inteiro((await params).id);
  if (id === null) return erroApi("ID_INVALIDO", "Identificador inválido.", 400);

  // O caminho vem do banco, nunca do cliente, e ainda precisa estar dentro de
  // exports/ — defesa em profundidade contra um registro adulterado.
  const exportacao = obterExportacao(obterBanco(), id);
  const caminho = exportacao?.arquivoTxt ? path.resolve(exportacao.arquivoTxt) : null;
  if (!caminho || !estaDentro(lerConfigExportacao().exportsDir, caminho) || !existsSync(caminho)) {
    return erroApi("ARQUIVO_NAO_ENCONTRADO", "O arquivo desta exportação não está disponível.", 404);
  }

  return new Response(readFileSync(caminho, "utf8"), {
    headers: {
      ...CABECALHOS_PRIVADOS,
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${path.basename(caminho)}"`,
    },
  });
}
```

- [ ] **Step 5: Rotas de leitura e importação**

`app/src/app/api/grupos/route.ts`:

```ts
import { okJson } from "@/lib/api";
import { obterBanco } from "@/lib/db/conexao";
import { listarGrupos } from "@/lib/db/repositorio";

export const dynamic = "force-dynamic";

export async function GET() {
  return okJson({ grupos: listarGrupos(obterBanco()) });
}
```

`app/src/app/api/mensagens/route.ts`:

```ts
import type { NextRequest } from "next/server";
import { erroApi, okJson } from "@/lib/api";
import { obterBanco } from "@/lib/db/conexao";
import { consultarMensagens, listarAutores } from "@/lib/db/repositorio";
import { inteiro, lerFiltros, limitar } from "@/lib/parametros";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const lido = lerFiltros(params);
  if ("erro" in lido) return erroApi("PARAMETRO_INVALIDO", lido.erro, 400);

  const pagina = limitar(inteiro(params.get("pagina")), 1, 1_000_000, 1);
  const porPagina = limitar(inteiro(params.get("porPagina")), 10, 200, 50);
  const db = obterBanco();
  const { itens, total } = consultarMensagens(db, lido.filtros, pagina, porPagina);
  return okJson({ itens, total, pagina, porPagina, autores: listarAutores(db, lido.filtros.grupoId) });
}
```

`app/src/app/api/analise/route.ts`:

```ts
import type { NextRequest } from "next/server";
import { erroApi, okJson } from "@/lib/api";
import { obterBanco } from "@/lib/db/conexao";
import { dadosParaKpis } from "@/lib/db/repositorio";
import { calcularKpis } from "@/lib/kpis";
import { lerFiltros } from "@/lib/parametros";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const lido = lerFiltros(request.nextUrl.searchParams);
  if ("erro" in lido) return erroApi("PARAMETRO_INVALIDO", lido.erro, 400);
  return okJson({ kpis: calcularKpis(dadosParaKpis(obterBanco(), lido.filtros)) });
}
```

`app/src/app/api/importar/route.ts`:

```ts
import type { NextRequest } from "next/server";
import { erroApi, okJson } from "@/lib/api";
import { obterBanco } from "@/lib/db/conexao";
import { ErroImportacao, importarTxt } from "@/lib/importacao";

export const dynamic = "force-dynamic";

const LIMITE_BYTES = 20 * 1024 * 1024;

export async function POST(request: NextRequest) {
  let formulario: FormData;
  try {
    formulario = await request.formData();
  } catch {
    return erroApi("CORPO_INVALIDO", "Envie o arquivo como multipart/form-data.", 400);
  }

  const arquivo = formulario.get("arquivo");
  if (!(arquivo instanceof File)) return erroApi("SEM_ARQUIVO", "Envie um arquivo .txt no campo \"arquivo\".", 400);
  if (!arquivo.name.toLowerCase().endsWith(".txt")) return erroApi("TIPO_INVALIDO", "Só arquivos .txt são aceitos.", 400);
  if (arquivo.size > LIMITE_BYTES) return erroApi("ARQUIVO_GRANDE", "O arquivo passa do limite de 20 MB.", 413);

  const grupo = formulario.get("grupo");
  try {
    const resultado = importarTxt(
      obterBanco(),
      await arquivo.text(),
      typeof grupo === "string" ? grupo : undefined
    );
    return okJson(resultado);
  } catch (erro) {
    if (erro instanceof ErroImportacao) return erroApi("IMPORTACAO_INVALIDA", erro.message, 400);
    throw erro;
  }
}
```

- [ ] **Step 6: Verificar com `curl`**

Run (em `app/`): `npx tsc --noEmit` (sem erros) e `npx vitest run` (tudo passa). Depois `npm run dev` em segundo plano e, com `EXTRATOR_SENHA=senha-local-de-teste` em `app/.env.local`:

```bash
B=http://127.0.0.1:51794
curl -s -c jar.txt -X POST -H "Content-Type: application/json" -d '{"senha":"senha-local-de-teste"}' $B/api/auth/login
curl -s -b jar.txt $B/api/grupos
curl -s -b jar.txt -X POST -H "Content-Type: application/json" -d '{"grupo":""}' $B/api/exportacoes
curl -s -b jar.txt -F "arquivo=@../exports/$(ls ../exports | grep CAPAG | grep txt | head -1)" $B/api/importar
curl -s -b jar.txt "$B/api/mensagens?grupoId=1&porPagina=10" | head -c 400
curl -s -b jar.txt "$B/api/analise?grupoId=1" | head -c 400
```

Expected: login `{"ok":true}`; `/api/grupos` `{"grupos":[]}` na primeira vez; `POST` com grupo vazio → `{"error":{"code":"GRUPO_INVALIDO",...}}`; a importação devolve `lidas`/`novas` iguais ao total declarado (1527 no export atual); `mensagens` traz `itens` e `total`; `analise` traz `kpis`. Parar o servidor e apagar `jar.txt`. O banco criado em `app/data/` é ignorado pelo git.

- [ ] **Step 7: Commit**

```bash
git add app
git commit -m "Adiciona rotas de API (exportacoes, grupos, mensagens, analise e importacao)"
```

---

### Task 10: Shell da interface (tema, navegação, estados e hooks)

**Files:**
- Create: `app/src/contexts/TemaContext.tsx`, `app/src/components/layout/theme-toggle.tsx`, `app/src/components/layout/navbar.tsx`, `app/src/components/layout/app-shell.tsx`, `app/src/components/states/empty-state.tsx`, `app/src/components/states/error-state.tsx`, `app/src/app/error.tsx`
- Create (cópia do Click Up): `app/src/hooks/cacheLru.ts`, `app/src/hooks/useRecursoRemoto.ts`
- Modify: `app/src/app/layout.tsx` (versão final)

**Interfaces:**
- Produces: `TemaProvider({ temaInicial, children })` e `useTema(): { tema; alternarTema }`; `<AppShell>` (esconde a navegação em `/login`); `<EmptyState title? description? icon? />`; `<ErrorState title? message onRetry? />`; `useRecursoRemoto<T>(url | null, { manterDadoAnterior? }): { dados?; erro?; carregando; recarregar }`, `invalidarCache(prefixo?)`, `ErroApi`.

- [ ] **Step 1: Copiar os hooks e o estado vazio do Click Up**

```bash
SRC="C:/Users/Cristiam.Ieda/Desktop/Claude/Click Up"
cd app
mkdir -p src/hooks src/components/states src/components/layout src/contexts
cp "$SRC/src/hooks/cacheLru.ts" "$SRC/src/hooks/useRecursoRemoto.ts" src/hooks/
cp "$SRC/src/components/states/empty-state.tsx" src/components/states/
cp "$SRC/src/components/layout/theme-toggle.tsx" src/components/layout/
cp "$SRC/src/components/layout/app-shell.tsx" src/components/layout/
```

`theme-toggle.tsx` e `app-shell.tsx` funcionam sem alteração (o `app-shell` só importa `./navbar`, criado abaixo).

- [ ] **Step 2: Criar `app/src/contexts/TemaContext.tsx`**

```tsx
"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type Tema = "light" | "dark";

const NOME_COOKIE = "tema";

/** Um ano: a preferência de aparência não deve expirar sozinha. */
const VALIDADE_COOKIE_S = 31536000;

interface TemaContextValor {
  tema: Tema;
  alternarTema: () => void;
}

const TemaContext = createContext<TemaContextValor | null>(null);

/**
 * O tema inicial vem do servidor (cookie lido em layout.tsx), não de um script
 * no `<head>`: assim o `<html>` já nasce com a classe certa e não há flash de
 * tema na carga da página.
 */
export function TemaProvider({ temaInicial, children }: { temaInicial: Tema; children: ReactNode }) {
  const [tema, setTema] = useState<Tema>(temaInicial);

  const alternarTema = useCallback(() => {
    const proximo: Tema = tema === "dark" ? "light" : "dark";
    document.documentElement.classList.toggle("dark", proximo === "dark");
    document.cookie = `${NOME_COOKIE}=${proximo}; path=/; max-age=${VALIDADE_COOKIE_S}; SameSite=Lax`;
    setTema(proximo);
  }, [tema]);

  return <TemaContext.Provider value={{ tema, alternarTema }}>{children}</TemaContext.Provider>;
}

export function useTema(): TemaContextValor {
  const contexto = useContext(TemaContext);
  if (!contexto) throw new Error("useTema precisa ser usado dentro de um TemaProvider");
  return contexto;
}
```

- [ ] **Step 3: Criar `navbar.tsx`**

```tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Activity, Download, LogOut, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./theme-toggle";

const ITENS = [
  { href: "/", label: "Exportações", icon: Download },
  { href: "/conversas", label: "Conversas", icon: MessageSquare },
  { href: "/analise", label: "Análise", icon: Activity },
];

function itemAtivo(href: string, pathname: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();

  async function sair() {
    await fetch("/api/auth/login", { method: "DELETE" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 w-full max-w-[1600px] items-center gap-6 px-4 md:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="Extrator Teams">
          <span className="flex size-8 items-center justify-center rounded bg-primary text-primary-foreground">
            <Download className="size-4" />
          </span>
          <span className="text-sm font-semibold tracking-tight">
            Extrator <span className="text-primary">Teams</span>
          </span>
        </Link>

        <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
          {ITENS.map(({ href, label, icon: Icon }) => {
            const ativo = itemAtivo(href, pathname);
            return (
              <Link
                key={href}
                href={href}
                aria-current={ativo ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  ativo ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-1">
          <ThemeToggle />
          <Button variant="ghost" size="icon-lg" onClick={sair} aria-label="Sair" title="Sair">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Estado de erro, `error.tsx` e layout final**

`app/src/components/states/error-state.tsx`:

```tsx
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function ErrorState({
  title = "Algo deu errado",
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <Alert variant="destructive" className="max-w-xl">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>{message}</p>
        {onRetry && (
          <Button size="sm" variant="outline" onClick={onRetry}>
            <RefreshCw className="h-3.5 w-3.5" />
            Tentar novamente
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
```

`app/src/app/error.tsx`:

```tsx
"use client";

import { ErrorState } from "@/components/states/error-state";

export default function Erro({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorState message={error.message || "Erro inesperado ao carregar a tela."} onRetry={reset} />;
}
```

`app/src/app/layout.tsx` (substitui o provisório):

```tsx
import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import "./globals.css";
import { AppShell } from "@/components/layout/app-shell";
import { TemaProvider } from "@/contexts/TemaContext";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Extrator Teams",
  description: "Exporta, lê e analisa conversas do Microsoft Teams",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const temaInicial = cookieStore.get("tema")?.value === "dark" ? "dark" : "light";

  return (
    <html lang="pt-BR" className={`${geistSans.variable} h-full antialiased ${temaInicial === "dark" ? "dark" : ""}`}>
      <body className="min-h-full flex flex-col bg-background">
        <TemaProvider temaInicial={temaInicial}>
          <AppShell>{children}</AppShell>
        </TemaProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 5: Verificar**

Run (em `app/`): `npx tsc --noEmit` → sem erros (se um ícone do `lucide-react` não existir na versão instalada, o erro aponta o nome; trocar por um equivalente, ex.: `Activity` → `ChartColumn`).
Run: `npm run build` → conclui.

- [ ] **Step 6: Commit**

```bash
cd ..
git add app
git commit -m "Adiciona shell da interface (tema, navbar, estados de erro/vazio e hooks de dados)"
```

---

### Task 11: Tela Exportações

**Files:**
- Create: `app/src/components/exportacoes/etapas.ts`, `app/src/components/exportacoes/status-exportacao-badge.tsx`, `app/src/components/exportacoes/formulario-exportacao.tsx`, `app/src/components/exportacoes/card-progresso.tsx`, `app/src/components/exportacoes/tabela-exportacoes.tsx`, `app/src/components/exportacoes/importar-txt.tsx`, `app/src/hooks/useExportacoes.ts`
- Test: `app/src/components/exportacoes/etapas.test.ts`
- Modify: `app/src/app/page.tsx` (substitui a provisória)

**Interfaces:**
- Consumes: `Exportacao`, `EtapaExportacao`, `StatusExportacao` (Task 4); `formatarInstante`, `formatarDuracao`, `formatarNumero` (Task 6); `invalidarCache` (Task 10); API da Task 9.
- Produces: `ETAPAS: { id; rotulo }[]` e `indiceDaEtapa(etapa): number` (`-1` para `iniciando`); `useExportacoes(): { exportacoes: Exportacao[] | null; erro; recarregar }`.

- [ ] **Step 1: Teste das etapas (falha) e implementação**

`app/src/components/exportacoes/etapas.test.ts`:

```ts
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
```

Rodar `npx vitest run src/components/exportacoes/etapas.test.ts` → FAIL. Criar `etapas.ts`:

```ts
import type { EtapaExportacao } from "@/types/dominio";

/** Etapas visíveis do fluxo, na ordem em que o script as percorre. */
export const ETAPAS: { id: EtapaExportacao; rotulo: string }[] = [
  { id: "aguardando_login", rotulo: "Aguardando login no Teams" },
  { id: "login_concluido", rotulo: "Login concluído" },
  { id: "procurando_grupo", rotulo: "Procurando o grupo" },
  { id: "grupo_aberto", rotulo: "Grupo aberto" },
  { id: "lendo_historico", rotulo: "Lendo o histórico" },
  { id: "salvando", rotulo: "Salvando e importando" },
];

/** Posição da etapa em `ETAPAS`; `-1` para "iniciando" (ainda antes da primeira). */
export function indiceDaEtapa(etapa: EtapaExportacao): number {
  return ETAPAS.findIndex((e) => e.id === etapa);
}
```

Rodar → passa.

- [ ] **Step 2: Hook `useExportacoes.ts`**

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Exportacao } from "@/types/dominio";
import { invalidarCache } from "./useRecursoRemoto";

const INTERVALO_MS = 2000;

/**
 * Lista de exportações, com polling de 2 s enquanto alguma está em andamento.
 * Usa fetch próprio e não o cache de `useRecursoRemoto`: o andamento muda a
 * cada poucos segundos e não pode ficar preso num cache.
 */
export function useExportacoes() {
  const [exportacoes, setExportacoes] = useState<Exportacao[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const recarregar = useCallback(async () => {
    try {
      const resposta = await fetch("/api/exportacoes");
      const corpo = await resposta.json();
      if (!resposta.ok) throw new Error(corpo?.error?.message ?? "Erro ao carregar as exportações.");
      setExportacoes(corpo.exportacoes as Exportacao[]);
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha de rede.");
    }
  }, []);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  const emAndamento = exportacoes?.some((e) => e.status === "em_andamento") ?? false;

  useEffect(() => {
    if (!emAndamento) return;
    const timer = setInterval(() => void recarregar(), INTERVALO_MS);
    return () => clearInterval(timer);
  }, [emAndamento, recarregar]);

  // Quando uma exportação termina, o que as outras telas têm em cache
  // (grupos, mensagens, análise) ficou velho.
  const estavaEmAndamento = useRef(false);
  useEffect(() => {
    if (estavaEmAndamento.current && !emAndamento) invalidarCache("/api/");
    estavaEmAndamento.current = emAndamento;
  }, [emAndamento]);

  return { exportacoes, erro, recarregar };
}
```

- [ ] **Step 3: Badge de status e formulário**

`status-exportacao-badge.tsx`:

```tsx
import { Badge } from "@/components/ui/badge";
import type { StatusExportacao } from "@/types/dominio";

const ESTILO: Record<StatusExportacao, { rotulo: string; cor: string }> = {
  em_andamento: { rotulo: "Em andamento", cor: "var(--chart-1)" },
  concluida: { rotulo: "Concluída", cor: "var(--status-good)" },
  erro: { rotulo: "Erro", cor: "var(--status-critical)" },
  cancelada: { rotulo: "Cancelada", cor: "var(--status-warning)" },
};

export function StatusExportacaoBadge({ status }: { status: StatusExportacao }) {
  const { rotulo, cor } = ESTILO[status];
  return (
    <Badge variant="outline" style={{ borderColor: cor, color: cor }}>
      {rotulo}
    </Badge>
  );
}
```

`formulario-exportacao.tsx`:

```tsx
"use client";

import { useState } from "react";
import { AlertTriangle, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function FormularioExportacao({
  desabilitado,
  onIniciada,
}: {
  desabilitado: boolean;
  onIniciada: () => void;
}) {
  const [grupo, setGrupo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function exportar(evento: React.FormEvent) {
    evento.preventDefault();
    setEnviando(true);
    setErro(null);
    try {
      const resposta = await fetch("/api/exportacoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grupo }),
      });
      if (!resposta.ok) {
        const corpo = await resposta.json().catch(() => null);
        setErro(corpo?.error?.message ?? "Não foi possível iniciar a exportação.");
        return;
      }
      setGrupo("");
      onIniciada();
    } catch {
      setErro("Falha de rede. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Nova exportação</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <form onSubmit={exportar} className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={grupo}
            onChange={(e) => setGrupo(e.target.value)}
            placeholder="Nome do grupo, exatamente como aparece no Teams"
            aria-label="Nome do grupo"
            disabled={desabilitado}
          />
          <Button type="submit" disabled={desabilitado || enviando || grupo.trim().length === 0}>
            <Download className="mr-1.5 size-4" />
            {enviando ? "Iniciando..." : "Exportar"}
          </Button>
        </form>

        {erro && (
          <p className="flex items-start gap-1.5 text-xs leading-tight" style={{ color: "var(--status-critical)" }} role="alert">
            <AlertTriangle className="mt-px size-3 shrink-0" />
            {erro}
          </p>
        )}

        <p className="text-xs text-muted-foreground">
          {desabilitado
            ? "Há uma exportação em andamento. Aguarde ou cancele para iniciar outra."
            : "Uma janela do Edge vai abrir. Se o Teams pedir login, entre nela e aguarde — o processo continua sozinho."}
        </p>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Card de progresso**

`card-progresso.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Check, Circle, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatarNumero } from "@/lib/formatacao";
import { cn } from "@/lib/utils";
import type { Exportacao } from "@/types/dominio";
import { ETAPAS, indiceDaEtapa } from "./etapas";

export function CardProgresso({ exportacao, onCancelada }: { exportacao: Exportacao; onCancelada: () => void }) {
  const [cancelando, setCancelando] = useState(false);
  const atual = indiceDaEtapa(exportacao.etapa);

  async function cancelar() {
    setCancelando(true);
    try {
      await fetch(`/api/exportacoes/${exportacao.id}/cancelar`, { method: "POST" });
      onCancelada();
    } finally {
      setCancelando(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-sm font-medium">Exportando: {exportacao.grupo}</CardTitle>
        <Button size="sm" variant="outline" onClick={cancelar} disabled={cancelando}>
          <X className="mr-1 size-3.5" />
          {cancelando ? "Cancelando..." : "Cancelar"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {exportacao.etapa === "aguardando_login" && (
          <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
            Faça o login do Teams na janela do Edge que abriu. Este painel continua sozinho quando o login for detectado.
          </p>
        )}

        <ol className="space-y-1.5">
          {ETAPAS.map((etapa, indice) => {
            const feita = indice < atual;
            const corrente = indice === atual;
            return (
              <li
                key={etapa.id}
                className={cn("flex items-center gap-2 text-sm", !feita && !corrente && "text-muted-foreground")}
                aria-current={corrente ? "step" : undefined}
              >
                {feita ? (
                  <Check className="size-4" style={{ color: "var(--status-good)" }} />
                ) : corrente ? (
                  <RefreshCw className="size-4 animate-spin" style={{ color: "var(--chart-1)" }} />
                ) : (
                  <Circle className="size-4" />
                )}
                <span className={cn(corrente && "font-medium")}>{etapa.rotulo}</span>
                {corrente && etapa.id === "lendo_historico" && (
                  <span className="text-muted-foreground tabular-nums">
                    — {formatarNumero(exportacao.contador)} mensagens até agora
                  </span>
                )}
              </li>
            );
          })}
        </ol>

        {exportacao.grupoAberto && (
          <p className="text-xs text-muted-foreground">Chat aberto no Teams: {exportacao.grupoAberto}</p>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 5: Tabela do histórico e importação de `.txt`**

`tabela-exportacoes.tsx`:

```tsx
import { Download } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/states/empty-state";
import { formatarDuracao, formatarInstante, formatarNumero } from "@/lib/formatacao";
import type { Exportacao } from "@/types/dominio";
import { StatusExportacaoBadge } from "./status-exportacao-badge";

export function TabelaExportacoes({ exportacoes }: { exportacoes: Exportacao[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Histórico</CardTitle>
      </CardHeader>
      <CardContent>
        {exportacoes.length === 0 ? (
          <EmptyState
            title="Nenhuma exportação ainda"
            description="Informe o nome de um grupo acima e clique em Exportar, ou importe um .txt antigo."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Grupo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Início</TableHead>
                <TableHead>Duração</TableHead>
                <TableHead className="text-right">Mensagens</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {exportacoes.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="max-w-[320px] whitespace-normal break-words font-medium">{e.grupo}</TableCell>
                  <TableCell className="space-y-1 whitespace-normal">
                    <StatusExportacaoBadge status={e.status} />
                    {e.status === "erro" && e.erroMsg && (
                      <p className="max-w-[320px] text-xs text-muted-foreground">{e.erroMsg}</p>
                    )}
                  </TableCell>
                  <TableCell className="tabular-nums">{formatarInstante(e.iniciadaEm)}</TableCell>
                  <TableCell className="tabular-nums">{formatarDuracao(e.iniciadaEm, e.finalizadaEm)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {e.totalMensagens !== null ? formatarNumero(e.totalMensagens) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {e.status === "concluida" && e.arquivoTxt && (
                      <a
                        href={`/api/exportacoes/${e.id}/download`}
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                      >
                        <Download className="mr-1 size-3.5" />
                        .txt
                      </a>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
```

`importar-txt.tsx`:

```tsx
"use client";

import { useState } from "react";
import { AlertTriangle, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { invalidarCache } from "@/hooks/useRecursoRemoto";

interface ResultadoImportacao {
  grupo: string;
  lidas: number;
  novas: number;
  totalDeclarado: number | null;
  divergencia: boolean;
}

export function ImportarTxt() {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [grupo, setGrupo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null);

  async function importar(evento: React.FormEvent) {
    evento.preventDefault();
    if (!arquivo) return;
    setEnviando(true);
    setErro(null);
    setResultado(null);
    try {
      const formulario = new FormData();
      formulario.set("arquivo", arquivo);
      if (grupo.trim()) formulario.set("grupo", grupo.trim());
      const resposta = await fetch("/api/importar", { method: "POST", body: formulario });
      const corpo = await resposta.json().catch(() => null);
      if (!resposta.ok) {
        setErro(corpo?.error?.message ?? "Não foi possível importar o arquivo.");
        return;
      }
      setResultado(corpo as ResultadoImportacao);
      invalidarCache("/api/");
    } catch {
      setErro("Falha de rede. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Importar .txt antigo</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <form onSubmit={importar} className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            type="file"
            accept=".txt"
            aria-label="Arquivo .txt"
            onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
          />
          <Input
            value={grupo}
            onChange={(e) => setGrupo(e.target.value)}
            placeholder="Nome do grupo (só se o arquivo não tiver cabeçalho)"
            aria-label="Nome do grupo para importação"
          />
          <Button type="submit" variant="outline" disabled={!arquivo || enviando}>
            <Upload className="mr-1.5 size-4" />
            {enviando ? "Importando..." : "Importar"}
          </Button>
        </form>

        {erro && (
          <p className="flex items-start gap-1.5 text-xs leading-tight" style={{ color: "var(--status-critical)" }} role="alert">
            <AlertTriangle className="mt-px size-3 shrink-0" />
            {erro}
          </p>
        )}

        {resultado && (
          <div className="space-y-1 text-sm" role="status">
            <p>
              Importadas {resultado.novas} novas de {resultado.lidas} lidas no grupo “{resultado.grupo}”.
            </p>
            {resultado.divergencia && (
              <p className="text-xs" style={{ color: "var(--status-warning)" }}>
                O cabeçalho declara {resultado.totalDeclarado} mensagens, mas foram lidas {resultado.lidas}.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 6: Página `app/src/app/page.tsx`**

```tsx
"use client";

import { CardProgresso } from "@/components/exportacoes/card-progresso";
import { FormularioExportacao } from "@/components/exportacoes/formulario-exportacao";
import { ImportarTxt } from "@/components/exportacoes/importar-txt";
import { TabelaExportacoes } from "@/components/exportacoes/tabela-exportacoes";
import { ErrorState } from "@/components/states/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useExportacoes } from "@/hooks/useExportacoes";

export default function ExportacoesPage() {
  const { exportacoes, erro, recarregar } = useExportacoes();
  const ativa = exportacoes?.find((e) => e.status === "em_andamento");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Exportações</h1>
        <p className="text-sm text-muted-foreground">
          Exporte o histórico de um grupo do Teams e leia as mensagens nas telas Conversas e Análise.
        </p>
      </div>

      {erro && <ErrorState message={erro} onRetry={() => void recarregar()} />}

      <FormularioExportacao desabilitado={Boolean(ativa)} onIniciada={() => void recarregar()} />

      {ativa && <CardProgresso exportacao={ativa} onCancelada={() => void recarregar()} />}

      {exportacoes === null ? <Skeleton className="h-40 w-full" /> : <TabelaExportacoes exportacoes={exportacoes} />}

      <ImportarTxt />
    </div>
  );
}
```

- [ ] **Step 7: Verificar**

Run (em `app/`): `npx vitest run` → tudo passa; `npx tsc --noEmit` → sem erros (nomes de export de `Table`/`Card` que não existirem aparecem aqui — corrigir conforme o arquivo em `components/ui/`).
Verificação visual: `npm run dev`, abrir `http://127.0.0.1:51794`, entrar com a senha de `app/.env.local`. Deve aparecer **Exportações** com o formulário, o histórico vazio ("Nenhuma exportação ainda") e o cartão "Importar .txt antigo". Importar `../exports/Projetos_CAPAG_*.txt` e conferir a mensagem "Importadas … de … lidas no grupo “Projetos | CAPAG - Etapa 4 - SaaS”". Alternar tema e sair pelo botão da navbar. Parar o servidor.

- [ ] **Step 8: Commit**

```bash
cd ..
git add app
git commit -m "Adiciona tela Exportacoes (formulario, progresso, historico e importacao de txt)"
```

---

### Task 12: Tela Conversas

**Files:**
- Create: `app/src/components/shared/select-nativo.tsx`, `app/src/components/shared/seletor-grupo.tsx`, `app/src/hooks/useGrupos.ts`, `app/src/components/conversas/linha-mensagem.tsx`, `app/src/components/conversas/conversas-view.tsx`, `app/src/app/conversas/page.tsx`

**Interfaces:**
- Consumes: `useRecursoRemoto` (Task 10), `GrupoResumo`, `Mensagem` (Task 4), `formatarDataHora`, `formatarNumero` (Task 6), `EmptyState`/`ErrorState` (Task 10), `GET /api/grupos` e `GET /api/mensagens` (Task 9).
- Produces: `<SelectNativo />` (props de `<select>`), `<SeletorGrupo grupos valor onChange />`, `useGrupos(): { grupos?: GrupoResumo[]; erro?; carregando }`.

- [ ] **Step 1: Componentes compartilhados e hook**

`app/src/components/shared/select-nativo.tsx`:

```tsx
import { cn } from "@/lib/utils";

/** `<select>` nativo com o visual do `Input` — evita a API do Select do base-ui para uma lista simples. */
export function SelectNativo({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 dark:bg-input/30",
        className
      )}
      {...props}
    />
  );
}
```

`app/src/components/shared/seletor-grupo.tsx`:

```tsx
import { formatarNumero } from "@/lib/formatacao";
import type { GrupoResumo } from "@/types/dominio";
import { SelectNativo } from "./select-nativo";

export function SeletorGrupo({
  grupos,
  valor,
  onChange,
}: {
  grupos: GrupoResumo[];
  valor: number | null;
  onChange: (id: number) => void;
}) {
  return (
    <SelectNativo aria-label="Grupo" value={valor ?? ""} onChange={(e) => onChange(Number(e.target.value))}>
      {grupos.map((g) => (
        <option key={g.id} value={g.id}>
          {g.nome} ({formatarNumero(g.total)})
        </option>
      ))}
    </SelectNativo>
  );
}
```

`app/src/hooks/useGrupos.ts`:

```ts
"use client";

import type { GrupoResumo } from "@/types/dominio";
import { useRecursoRemoto } from "./useRecursoRemoto";

export function useGrupos() {
  const { dados, erro, carregando } = useRecursoRemoto<{ grupos: GrupoResumo[] }>("/api/grupos");
  return { grupos: dados?.grupos, erro, carregando };
}
```

- [ ] **Step 2: Linha de mensagem**

`app/src/components/conversas/linha-mensagem.tsx`:

```tsx
"use client";

import { useState } from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { formatarDataHora } from "@/lib/formatacao";
import { cn } from "@/lib/utils";
import type { Mensagem } from "@/types/dominio";

const LIMITE_CARACTERES = 400;
const LIMITE_LINHAS = 6;

export function LinhaMensagem({ mensagem }: { mensagem: Mensagem }) {
  const [aberta, setAberta] = useState(false);
  const longa = mensagem.texto.length > LIMITE_CARACTERES || mensagem.texto.split("\n").length > LIMITE_LINHAS;

  return (
    <TableRow>
      <TableCell className="whitespace-nowrap align-top tabular-nums text-muted-foreground">
        {formatarDataHora(mensagem.dataHora, mensagem.dataHoraOriginal)}
      </TableCell>
      <TableCell className="whitespace-nowrap align-top font-medium">{mensagem.autor}</TableCell>
      <TableCell className="whitespace-normal align-top">
        <div className={cn("whitespace-pre-wrap break-words", longa && !aberta && "line-clamp-6")}>{mensagem.texto}</div>
        {longa && (
          <button
            type="button"
            className="mt-1 text-xs text-primary hover:underline"
            onClick={() => setAberta(!aberta)}
          >
            {aberta ? "Ver menos" : "Ver mais"}
          </button>
        )}
      </TableCell>
    </TableRow>
  );
}
```

- [ ] **Step 3: View e página**

`app/src/components/conversas/conversas-view.tsx`:

```tsx
"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { SelectNativo } from "@/components/shared/select-nativo";
import { SeletorGrupo } from "@/components/shared/seletor-grupo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useGrupos } from "@/hooks/useGrupos";
import { useRecursoRemoto } from "@/hooks/useRecursoRemoto";
import { formatarNumero } from "@/lib/formatacao";
import type { Mensagem } from "@/types/dominio";
import { LinhaMensagem } from "./linha-mensagem";

interface RespostaMensagens {
  itens: Mensagem[];
  total: number;
  pagina: number;
  porPagina: number;
  autores: string[];
}

const FILTROS_VAZIOS = { autor: "", de: "", ate: "", q: "" };

function montarQuery(grupoId: number, filtros: typeof FILTROS_VAZIOS, pagina: number): string {
  const params = new URLSearchParams({ grupoId: String(grupoId), pagina: String(pagina) });
  if (filtros.autor) params.set("autor", filtros.autor);
  if (filtros.de) params.set("de", filtros.de);
  if (filtros.ate) params.set("ate", filtros.ate);
  if (filtros.q.trim()) params.set("q", filtros.q.trim());
  return params.toString();
}

export function ConversasView() {
  const { grupos, erro: erroGrupos, carregando: carregandoGrupos } = useGrupos();
  const [grupoEscolhido, setGrupoEscolhido] = useState<number | null>(null);
  // O rascunho é o que se digita; o aplicado é o que vai para a URL. Assim
  // digitar não dispara uma busca por tecla.
  const [rascunho, setRascunho] = useState(FILTROS_VAZIOS);
  const [aplicado, setAplicado] = useState(FILTROS_VAZIOS);
  const [pagina, setPagina] = useState(1);

  const grupoId = grupoEscolhido ?? grupos?.[0]?.id ?? null;
  const url = grupoId === null ? null : `/api/mensagens?${montarQuery(grupoId, aplicado, pagina)}`;
  const { dados, erro, carregando, recarregar } = useRecursoRemoto<RespostaMensagens>(url, {
    manterDadoAnterior: true,
  });

  function trocarGrupo(id: number) {
    setGrupoEscolhido(id);
    setRascunho(FILTROS_VAZIOS);
    setAplicado(FILTROS_VAZIOS);
    setPagina(1);
  }

  function filtrar(evento: React.FormEvent) {
    evento.preventDefault();
    setAplicado(rascunho);
    setPagina(1);
  }

  function limpar() {
    setRascunho(FILTROS_VAZIOS);
    setAplicado(FILTROS_VAZIOS);
    setPagina(1);
  }

  if (carregandoGrupos) return <Skeleton className="h-64 w-full" />;
  if (erroGrupos) return <ErrorState message={erroGrupos.message} />;
  if (!grupos || grupos.length === 0) {
    return (
      <EmptyState
        title="Nenhuma conversa ainda"
        description="Exporte um grupo do Teams ou importe um .txt na tela Exportações."
      />
    );
  }

  const totalPaginas = dados ? Math.max(1, Math.ceil(dados.total / dados.porPagina)) : 1;

  return (
    <div className="space-y-4">
      <form onSubmit={filtrar} className="grid gap-2 md:grid-cols-[2fr_1fr_1fr_1fr_2fr_auto]">
        <SeletorGrupo grupos={grupos} valor={grupoId} onChange={trocarGrupo} />
        <SelectNativo
          aria-label="Autor"
          value={rascunho.autor}
          onChange={(e) => setRascunho({ ...rascunho, autor: e.target.value })}
        >
          <option value="">Todos os autores</option>
          {(dados?.autores ?? []).map((autor) => (
            <option key={autor} value={autor}>
              {autor}
            </option>
          ))}
        </SelectNativo>
        <Input type="date" aria-label="De" value={rascunho.de} onChange={(e) => setRascunho({ ...rascunho, de: e.target.value })} />
        <Input type="date" aria-label="Até" value={rascunho.ate} onChange={(e) => setRascunho({ ...rascunho, ate: e.target.value })} />
        <Input
          aria-label="Buscar no texto"
          placeholder="Buscar no texto"
          value={rascunho.q}
          onChange={(e) => setRascunho({ ...rascunho, q: e.target.value })}
        />
        <div className="flex gap-1">
          <Button type="submit">
            <Search className="mr-1 size-4" />
            Filtrar
          </Button>
          <Button type="button" variant="ghost" size="icon" onClick={limpar} aria-label="Limpar filtros" title="Limpar filtros">
            <X className="size-4" />
          </Button>
        </div>
      </form>

      {erro && <ErrorState message={erro.message} onRetry={() => void recarregar()} />}

      <Card>
        <CardContent className="pt-4">
          {carregando && !dados ? (
            <Skeleton className="h-64 w-full" />
          ) : dados && dados.itens.length === 0 ? (
            <EmptyState title="Nenhuma mensagem com esses filtros" />
          ) : dados ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-40">Data e hora</TableHead>
                  <TableHead className="w-56">Autor</TableHead>
                  <TableHead>Mensagem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dados.itens.map((m) => (
                  <LinhaMensagem key={m.id} mensagem={m} />
                ))}
              </TableBody>
            </Table>
          ) : null}
        </CardContent>
      </Card>

      {dados && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{formatarNumero(dados.total)} mensagens</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setPagina(pagina - 1)} disabled={pagina <= 1}>
              <ChevronLeft className="size-4" />
              Anterior
            </Button>
            <span className="tabular-nums">
              Página {pagina} de {totalPaginas}
            </span>
            <Button size="sm" variant="outline" onClick={() => setPagina(pagina + 1)} disabled={pagina >= totalPaginas}>
              Próxima
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
```

`app/src/app/conversas/page.tsx`:

```tsx
import { ConversasView } from "@/components/conversas/conversas-view";

export default function ConversasPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Conversas</h1>
        <p className="text-sm text-muted-foreground">Leia, filtre e busque as mensagens dos grupos exportados.</p>
      </div>
      <ConversasView />
    </div>
  );
}
```

- [ ] **Step 4: Verificar**

Run (em `app/`): `npx tsc --noEmit` → sem erros. `npm run dev`, entrar, ir em **Conversas**: com o CAPAG importado, deve listar mensagens em ordem cronológica, mostrar "N mensagens" e paginar; filtrar por autor e por texto; a mensagem longa (resumo colado numa linha só) aparece cortada com "Ver mais". Parar o servidor.

- [ ] **Step 5: Commit**

```bash
cd ..
git add app
git commit -m "Adiciona tela Conversas (filtros, busca e paginacao no servidor)"
```

---

### Task 13: Tela Análise

**Files:**
- Create: `app/src/components/analise/kpi-cards-analise.tsx`, `app/src/components/analise/grafico-por-dia.tsx`, `app/src/components/analise/ranking-autores.tsx`, `app/src/components/analise/analise-view.tsx`, `app/src/app/analise/page.tsx`

**Interfaces:**
- Consumes: `Kpis` de `@/lib/kpis` (Task 6), `SeletorGrupo`/`useGrupos` (Task 12), `useRecursoRemoto` (Task 10), `GET /api/analise` (Task 9).

- [ ] **Step 1: Cards, gráfico e ranking**

`app/src/components/analise/kpi-cards-analise.tsx`:

```tsx
import { Card, CardContent } from "@/components/ui/card";
import { formatarDia, formatarNumero } from "@/lib/formatacao";
import type { Kpis } from "@/lib/kpis";

export function KpiCardsAnalise({ kpis }: { kpis: Kpis }) {
  const itens = [
    {
      rotulo: "Mensagens",
      valor: formatarNumero(kpis.total),
      detalhe: kpis.semData > 0 ? `${formatarNumero(kpis.semData)} sem data` : undefined,
    },
    { rotulo: "Autores", valor: formatarNumero(kpis.autores) },
    {
      rotulo: "Período",
      valor:
        kpis.primeiraData && kpis.ultimaData
          ? `${formatarDia(kpis.primeiraData)} a ${formatarDia(kpis.ultimaData)}`
          : "—",
      detalhe: kpis.dias > 0 ? `${formatarNumero(kpis.dias)} dias` : undefined,
    },
    { rotulo: "Média por dia", valor: kpis.mediaPorDia.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {itens.map((item) => (
        <Card key={item.rotulo}>
          <CardContent className="space-y-1 pt-4">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{item.rotulo}</p>
            <p className="text-xl font-semibold tabular-nums">{item.valor}</p>
            {item.detalhe && <p className="text-xs text-muted-foreground">{item.detalhe}</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

`app/src/components/analise/grafico-por-dia.tsx`:

```tsx
"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { EmptyState } from "@/components/states/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatarDia } from "@/lib/formatacao";
import type { Kpis } from "@/lib/kpis";

export function GraficoPorDia({ porDia }: { porDia: Kpis["porDia"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Mensagens por dia</CardTitle>
      </CardHeader>
      <CardContent>
        {porDia.length === 0 ? (
          <EmptyState title="Sem datas interpretáveis" description="Nenhuma mensagem deste filtro tem data conhecida." />
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={porDia}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="dia" tickFormatter={formatarDia} minTickGap={32} tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} width={36} tick={{ fontSize: 11 }} />
                <Tooltip
                  labelFormatter={(dia) => formatarDia(String(dia))}
                  formatter={(valor) => [String(valor), "Mensagens"]}
                />
                <Bar dataKey="total" fill="var(--chart-1)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

`app/src/components/analise/ranking-autores.tsx`:

```tsx
import { EmptyState } from "@/components/states/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatarNumero } from "@/lib/formatacao";
import type { Kpis } from "@/lib/kpis";

export function RankingAutores({ porAutor }: { porAutor: Kpis["porAutor"] }) {
  const maximo = porAutor[0]?.total ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Autores</CardTitle>
      </CardHeader>
      <CardContent>
        {porAutor.length === 0 ? (
          <EmptyState title="Nenhum autor neste filtro" />
        ) : (
          <ol className="space-y-2">
            {porAutor.map((a) => (
              <li key={a.autor} className="space-y-1">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="truncate font-medium">{a.autor}</span>
                  <span className="tabular-nums text-muted-foreground">{formatarNumero(a.total)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted">
                  <div
                    className="h-1.5 rounded-full"
                    style={{ width: `${(a.total / maximo) * 100}%`, background: "var(--chart-1)" }}
                  />
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: View e página**

`app/src/components/analise/analise-view.tsx`:

```tsx
"use client";

import { useState } from "react";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { SeletorGrupo } from "@/components/shared/seletor-grupo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useGrupos } from "@/hooks/useGrupos";
import { useRecursoRemoto } from "@/hooks/useRecursoRemoto";
import type { Kpis } from "@/lib/kpis";
import { GraficoPorDia } from "./grafico-por-dia";
import { KpiCardsAnalise } from "./kpi-cards-analise";
import { RankingAutores } from "./ranking-autores";

const PERIODO_VAZIO = { de: "", ate: "" };

export function AnaliseView() {
  const { grupos, erro: erroGrupos, carregando: carregandoGrupos } = useGrupos();
  const [grupoEscolhido, setGrupoEscolhido] = useState<number | null>(null);
  const [rascunho, setRascunho] = useState(PERIODO_VAZIO);
  const [aplicado, setAplicado] = useState(PERIODO_VAZIO);

  const grupoId = grupoEscolhido ?? grupos?.[0]?.id ?? null;
  let url: string | null = null;
  if (grupoId !== null) {
    const params = new URLSearchParams({ grupoId: String(grupoId) });
    if (aplicado.de) params.set("de", aplicado.de);
    if (aplicado.ate) params.set("ate", aplicado.ate);
    url = `/api/analise?${params.toString()}`;
  }
  const { dados, erro, carregando, recarregar } = useRecursoRemoto<{ kpis: Kpis }>(url, { manterDadoAnterior: true });

  if (carregandoGrupos) return <Skeleton className="h-64 w-full" />;
  if (erroGrupos) return <ErrorState message={erroGrupos.message} />;
  if (!grupos || grupos.length === 0) {
    return (
      <EmptyState
        title="Nenhuma conversa ainda"
        description="Exporte um grupo do Teams ou importe um .txt na tela Exportações."
      />
    );
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setAplicado(rascunho);
        }}
        className="grid gap-2 md:grid-cols-[2fr_1fr_1fr_auto]"
      >
        <SeletorGrupo
          grupos={grupos}
          valor={grupoId}
          onChange={(id) => {
            setGrupoEscolhido(id);
            setRascunho(PERIODO_VAZIO);
            setAplicado(PERIODO_VAZIO);
          }}
        />
        <Input type="date" aria-label="De" value={rascunho.de} onChange={(e) => setRascunho({ ...rascunho, de: e.target.value })} />
        <Input type="date" aria-label="Até" value={rascunho.ate} onChange={(e) => setRascunho({ ...rascunho, ate: e.target.value })} />
        <Button type="submit">Aplicar período</Button>
      </form>

      {erro && <ErrorState message={erro.message} onRetry={() => void recarregar()} />}

      {carregando && !dados ? (
        <Skeleton className="h-96 w-full" />
      ) : dados ? (
        <>
          <KpiCardsAnalise kpis={dados.kpis} />
          <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
            <GraficoPorDia porDia={dados.kpis.porDia} />
            <RankingAutores porAutor={dados.kpis.porAutor} />
          </div>
        </>
      ) : null}
    </div>
  );
}
```

`app/src/app/analise/page.tsx`:

```tsx
import { AnaliseView } from "@/components/analise/analise-view";

export default function AnalisePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Análise</h1>
        <p className="text-sm text-muted-foreground">Volume de mensagens por dia e por autor em cada grupo.</p>
      </div>
      <AnaliseView />
    </div>
  );
}
```

- [ ] **Step 3: Verificar**

Run (em `app/`): `npx tsc --noEmit` → sem erros. `npm run dev`, abrir **Análise**: com o CAPAG importado, os quatro cards (Mensagens 1.527, Autores, Período de 20/10/2025 a 18/09/2026, Média por dia), o gráfico de barras por dia e o ranking de autores. Aplicar um período (por exemplo, só setembro/2026) e ver os números mudarem. Parar o servidor.

- [ ] **Step 4: Commit**

```bash
cd ..
git add app
git commit -m "Adiciona tela Analise (cards, grafico por dia e ranking de autores)"
```

---

### Task 14: Smoke E2E, scripts de setup/start, documentação e verificação final

**Files:**
- Create: `app/playwright.config.ts`, `app/e2e/smoke.spec.ts`, `app/src/app/icon.svg`, `app/README.md`
- Create: `scripts/setup.ps1`, `scripts/start.ps1`, `scripts/stop.ps1`, `iniciar.bat`
- Modify: `LEIA-ME_teams_export.md`, `docs/superpowers/specs/2026-09-21-extrator-teams-app-design.md`

- [ ] **Step 1: Ícone (evita um 404 de `/favicon.ico` no console)**

`app/src/app/icon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#2a5db0"/><path d="M16 7v12m0 0-5-5m5 5 5-5M9 24h14" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
```

- [ ] **Step 2: `app/playwright.config.ts`**

```ts
import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

/**
 * Smoke test de ponta a ponta: sobe o servidor de verdade (`next dev`, não um
 * mock), entra com a senha real de `.env.local` e navega pelas telas.
 *
 * Usa o Microsoft Edge instalado (`channel: "msedge"`) — o mesmo navegador do
 * script de exportação, e sem baixar outro. Porta 3101 e banco `data/e2e.db`
 * próprios, para não tocar nos dados reais.
 *
 * O Next 16 não deixa dois `next dev` rodarem na mesma pasta: pare o servidor
 * de desenvolvimento (porta 51794) antes de rodar `npm run test:e2e`.
 */

const PORTA = 3101;
const BASE_URL = `http://127.0.0.1:${PORTA}`;

// O Playwright não lê `.env.local` sozinho, e o processo dos testes precisa da
// senha para conseguir logar.
try {
  process.loadEnvFile(path.resolve(__dirname, ".env.local"));
} catch {
  // Sem .env.local (ambiente que define as variáveis pelo shell) não é erro:
  // o teste que precisa da senha falha com uma mensagem clara.
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  timeout: 30_000,
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "edge", use: { ...devices["Desktop Edge"], channel: "msedge" } }],
  webServer: {
    command: `npx next dev -H 127.0.0.1 -p ${PORTA}`,
    url: `${BASE_URL}/login`,
    env: { EXTRATOR_DB: "data/e2e.db" },
    reuseExistingServer: false,
    timeout: 90_000,
  },
});
```

- [ ] **Step 3: `app/e2e/smoke.spec.ts`**

```ts
import { expect, test, type Page } from "@playwright/test";

/**
 * Smoke test: login real, navegação pelas três telas, importação de um `.txt`
 * SINTÉTICO (nunca conversa real) e leitura do resultado em Conversas e
 * Análise. Não dispara uma exportação de verdade: isso abre o Edge no Teams e
 * exige o login da pessoa, então o teste real com o Teams é manual.
 */

const SENHA = process.env.EXTRATOR_SENHA;

const TXT_SINTETICO = [
  "Histórico do chat: Grupo de Teste E2E",
  "Exportado em: 21/09/2026 09:00",
  "Total de mensagens: 2",
  "============================================================",
  "",
  "[segunda-feira, 7 de setembro de 2026 10:00] Ana Teste:",
  "Mensagem de teste um",
  "",
  "[terça-feira, 8 de setembro de 2026 11:09] Bruno Teste:",
  "Mensagem de teste dois",
  "",
].join("\n");

test.beforeAll(() => {
  if (!SENHA) {
    throw new Error(
      "EXTRATOR_SENHA não encontrada (nem no ambiente, nem em app/.env.local). O smoke test precisa da senha para logar — veja .env.example."
    );
  }
});

async function login(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByPlaceholder("Senha").fill(SENHA!);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL("/");
}

test("login e navegação pelas três telas, sem erro de console", async ({ page }) => {
  const errosDeConsole: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errosDeConsole.push(`[console] ${msg.text()}`);
  });
  page.on("pageerror", (erro) => errosDeConsole.push(`[pageerror] ${erro.message}`));

  await login(page);
  for (const { path, heading } of [
    { path: "/", heading: "Exportações" },
    { path: "/conversas", heading: "Conversas" },
    { path: "/analise", heading: "Análise" },
  ]) {
    await test.step(`abre ${path}`, async () => {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    });
  }

  expect(errosDeConsole, `Erros de console durante a navegação:\n${errosDeConsole.join("\n")}`).toEqual([]);
});

test("recusa senha incorreta e mantém a pessoa na tela de login", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder("Senha").fill("senha-propositalmente-errada");
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(page.getByText(/senha incorreta/i)).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test("a API recusa requisição sem sessão", async ({ request }) => {
  const resposta = await request.get("/api/exportacoes");
  expect(resposta.status()).toBe(401);
});

test("importa um .txt e o lê em Conversas e Análise", async ({ page }) => {
  await login(page);

  await page.setInputFiles('input[type="file"]', {
    name: "chat-e2e.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(TXT_SINTETICO, "utf8"),
  });
  await page.getByRole("button", { name: "Importar" }).click();
  await expect(page.getByRole("status")).toContainText("lidas");

  await page.getByRole("link", { name: "Conversas" }).click();
  await expect(page.getByText("Mensagem de teste dois")).toBeVisible();

  await page.getByRole("link", { name: "Análise" }).click();
  await expect(page.getByText("Média por dia")).toBeVisible();
  await expect(page.getByText("Ana Teste")).toBeVisible();
});
```

- [ ] **Step 4: Rodar o smoke**

Pare qualquer `npm run dev` da porta 51794. Em `app/`: `npm run test:e2e`.
Expected: 4 testes passam. Se o Edge não abrir (`channel "msedge" not found`), rode `npx playwright install msedge`.

- [ ] **Step 5: Scripts de setup, start e stop (raiz do projeto)**

As mensagens são ASCII de propósito: o Windows PowerShell 5.1 lê `.ps1` sem BOM como ANSI e estragaria acentos.

`scripts/setup.ps1`:

```powershell
# Prepara o ambiente: venv Python, dependencias, e o .env.local do app.
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

if (-not (Test-Path ".venv\Scripts\python.exe")) {
    Write-Host "Criando o ambiente virtual Python (.venv)..."
    python -m venv .venv
    if ($LASTEXITCODE -ne 0) { throw "Falha ao criar o venv. O Python 3 esta instalado e no PATH?" }
}

Write-Host "Instalando dependencias Python..."
& .\.venv\Scripts\python.exe -m pip install -r requirements.txt
if ($LASTEXITCODE -ne 0) { throw "Falha no pip install." }

$edge = @(
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $edge) {
    Write-Warning "Microsoft Edge nao encontrado. O script de exportacao usa o Edge (channel msedge)."
}

Write-Host "Instalando dependencias do app (npm install)..."
Push-Location app
npm install
if ($LASTEXITCODE -ne 0) { Pop-Location; throw "Falha no npm install." }
if (-not (Test-Path ".env.local")) {
    Copy-Item ".env.example" ".env.local"
    Write-Host "Criado app\.env.local. ABRA-O e troque EXTRATOR_SENHA antes de iniciar."
}
Pop-Location

Write-Host "Pronto. Depois de ajustar a senha, rode scripts\start.ps1 (ou de dois cliques em iniciar.bat)."
```

`scripts/start.ps1`:

```powershell
# Sobe o app em http://127.0.0.1:51794. Gera o build na primeira vez;
# use -Rebuild depois de mudar o codigo.
param([switch]$Rebuild)
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..\app")

if (-not (Test-Path ".env.local")) { Write-Error "Falta app\.env.local - rode scripts\setup.ps1 primeiro."; exit 1 }
if (-not (Test-Path "node_modules")) { Write-Error "Faltam dependencias - rode scripts\setup.ps1 primeiro."; exit 1 }

if ($Rebuild -or -not (Test-Path ".next\BUILD_ID")) {
    Write-Host "Gerando o build..."
    npm run build
    if ($LASTEXITCODE -ne 0) { exit 1 }
}

Write-Host "Servidor em http://127.0.0.1:51794  (Ctrl+C para parar)"
npm run start
```

`scripts/stop.ps1`:

```powershell
# Para o servidor da porta 51794 e tudo que ele iniciou (exportacao em andamento incluida).
$conexoes = Get-NetTCPConnection -LocalPort 51794 -State Listen -ErrorAction SilentlyContinue
if (-not $conexoes) {
    Write-Host "Nada escutando na porta 51794."
    exit 0
}
foreach ($processo in ($conexoes | Select-Object -ExpandProperty OwningProcess -Unique)) {
    Write-Host "Encerrando o processo $processo e seus filhos..."
    taskkill /PID $processo /T /F | Out-Null
}
```

`iniciar.bat`:

```bat
@echo off
setlocal
cd /d "%~dp0"

echo ===============================================
echo  Extrator Teams - iniciar
echo ===============================================
echo.
echo Na primeira vez o build leva alguns instantes;
echo se o navegador abrir antes, atualize a pagina.
echo.

start "Extrator Teams - servidor" powershell -NoExit -ExecutionPolicy Bypass -File "scripts\start.ps1"
timeout /t 8 /nobreak >nul
start "" "http://127.0.0.1:51794"

endlocal
```

- [ ] **Step 6: `app/README.md`**

```markdown
# Extrator Teams — app web

Painel local para exportar, ler e analisar conversas do Microsoft Teams. Ele
envolve o `teams_chat_export.py` (na pasta acima): o backend dispara o script,
acompanha o progresso e guarda as mensagens num banco SQLite.

- **Exportações:** informe o nome do grupo e clique em Exportar. Uma janela do
  Edge abre para o login do Teams (você faz o login; o app nunca vê a senha).
  Também importa `.txt` antigos.
- **Conversas:** leia as mensagens de um grupo, filtre por autor e período,
  busque no texto.
- **Análise:** total de mensagens, autores, média por dia, gráfico por dia e
  ranking de autores.

## Requisitos

Windows com Node 24+, Python 3 e Microsoft Edge. O app roda só na sua máquina
(`127.0.0.1:51794`), porque o Edge precisa de tela para o login do Teams.

## Como usar

Na raiz do projeto (a pasta acima):

    scripts\setup.ps1        # uma vez: venv Python, dependências e app\.env.local
    # abra app\.env.local e troque EXTRATOR_SENHA
    iniciar.bat              # ou: scripts\start.ps1

Abra http://127.0.0.1:51794 e entre com a senha. Para parar: `scripts\stop.ps1`.
Depois de mudar o código, `scripts\start.ps1 -Rebuild`.

## Configuração (`app/.env.local`, veja `.env.example`)

| Variável | Para quê |
|---|---|
| `EXTRATOR_SENHA` | Senha única de acesso. Sem ela nenhum login é aceito. |
| `EXTRATOR_SEGREDO_SESSAO` | Segredo do cookie de sessão (opcional). |
| `TEAMS_PYTHON`, `TEAMS_SCRIPT` | Python do venv e script. Vazio = `../.venv` e `../teams_chat_export.py`. |
| `EXTRATOR_TIMEOUT_MIN` | Tempo máximo de uma exportação (padrão 30). |
| `EXTRATOR_DB` | Caminho do SQLite (padrão `app/data/extrator.db`). |

## Desenvolvimento

    npm run dev          # servidor de desenvolvimento na 51794
    npm test             # Vitest (regras puras, banco em memória, orquestrador com script falso)
    npm run test:e2e     # Playwright no Edge; pare o `npm run dev` antes
    npm run lint

Regras de negócio ficam em `src/lib/` sem I/O quando possível (parsers, KPIs,
datas). O orquestrador (`src/lib/exportacao/`) é testado com um script Node
falso que imita a saída do Python, sem abrir o Teams. O teste real com o Teams
é manual: exige o seu login.

## Limitações conhecidas

- O sufixo "N reação." pode vir colado ao texto de mensagens com reação.
- Mensagens idênticas do mesmo autor no mesmo minuto colapsam numa só (é a
  chave de deduplicação do script).
- Se a data de uma mensagem não puder ser interpretada, ela aparece com o texto
  original do Teams e fica fora dos gráficos por dia.
- Uma exportação por vez: o `teams_profile` só aceita um Edge.
```

- [ ] **Step 7: Atualizar o `LEIA-ME_teams_export.md`**

Substituir (Edit) o trecho de instalação:

````
```
pip install -r requirements.txt
playwright install chromium
```

Se preferir usar o Claude Code, pode simplesmente abrir esta pasta nele e
pedir para ele rodar esses dois comandos por você.
````

por:

````
```
pip install -r requirements.txt
```

O script usa o **Microsoft Edge** já instalado no Windows (não é preciso
baixar o Chromium). Se preferir usar o Claude Code, pode simplesmente abrir
esta pasta nele e pedir para ele rodar esse comando por você.

Quer usar por uma interface web em vez da linha de comando? Veja `app/README.md`
(rode `scripts\setup.ps1` e depois `iniciar.bat`).
````

E acrescentar depois do item `--headless` da seção **Opções**:

```
- `--json-out CAMINHO` — além do `.txt`, grava um `.json` com as mensagens
  estruturadas (é o que o app web em `app/` usa).
```

- [ ] **Step 8: Sincronizar o spec com os ajustes do plano**

Acrescentar ao final de `docs/superpowers/specs/2026-09-21-extrator-teams-app-design.md`:

```markdown

## Ajustes definidos no plano de implementação

Decididos ao detalhar o plano; valem no lugar do texto acima onde divergirem.

- **Lock de exportação única:** em vez de portar `lockSincronizacao`, a checagem é atômica no banco (`BEGIN IMMEDIATE` + existência de linha `em_andamento`). Mesmo comportamento, sem depender de variável de módulo.
- **Tabela de conversas:** `Table` do shadcn com paginação no servidor, sem TanStack (filtro e paginação já são do backend).
- **Importar `.txt`:** cartão na tela Exportações, não um modal.
- **Porta:** fixa (51794) nos scripts; `EXTRATOR_PORTA` foi removida.
- **Selects:** `<select>` nativo estilizado, sem o Select do base-ui.
- **Upload:** `experimental.proxyClientMaxBodySize = "21mb"` no `next.config.ts`, porque o proxy de sessão faz o Next bufferizar o corpo e cortar em 10 MB por padrão.
- **Setup:** o script usa o Edge instalado (`channel="msedge"`); `scripts\setup.ps1` não baixa o Chromium.
```

- [ ] **Step 9: Verificação final (tudo, do zero)**

Run (em `app/`), nesta ordem, e todos precisam passar:

```bash
npx vitest run            # todos os testes unitários
npx tsc --noEmit          # sem erros de tipo
npm run lint              # sem erros
npm run build             # build de produção conclui e lista /, /conversas, /analise, /login e as rotas /api/*
npm run test:e2e          # 4 testes do smoke (com o dev da 51794 parado)
```

Run (na raiz): `.venv\Scripts\python.exe -m unittest discover -s tests -t . -v` → 3 testes ok.

Se o `lint` acusar `react-hooks/set-state-in-effect` em `useExportacoes.ts`, mover a primeira chamada `void recarregar()` do efeito para dentro de uma função `carregarInicial` assíncrona chamada pelo efeito (o `setState` deve ocorrer só depois de um `await`), e rodar o lint de novo.

**Teste real com o Teams (manual, feito pelo usuário):** `scripts\setup.ps1` → ajustar `EXTRATOR_SENHA` → `iniciar.bat` → em **Exportações**, informar `Projetos | CAPAG - Etapa 4 - SaaS` e clicar em Exportar → fazer o login do Teams na janela do Edge, se pedir → acompanhar as etapas até "Concluída" → conferir o total de mensagens, baixar o `.txt` e abrir **Conversas** e **Análise**. Cancelar uma exportação no meio deve deixar o status "Cancelada" e nenhum Edge órfão (`Get-Process msedge` sem a janela do Playwright).

- [ ] **Step 10: Commit**

```bash
git add app scripts iniciar.bat LEIA-ME_teams_export.md docs
git commit -m "Adiciona smoke E2E, scripts de setup/start, README e sincroniza o spec"
```

---

## Self-Review

**Cobertura do spec** — cada seção do spec e a tarefa que a implementa:
- Mudança no script (`--json-out`, `build_json`, autor `(desconhecido)`): Task 1.
- Dados (`grupos`, `exportacoes`, `mensagens`, chave única pela data original, `INSERT OR IGNORE`): Task 4.
- Backend, rotas: login/sessão (Task 3), exportações, cancelar, download, grupos, mensagens, análise, importar (Task 9).
- Execução do script (spawn sem shell, validação do grupo, caminhos por variável, `PYTHONUNBUFFERED`/`utf-8`, registro em `globalThis`): Tasks 6 (validação) e 8.
- Progresso (tabela de linhas → etapas): Task 5. Término, erro, timeout, cancelar em árvore, reinício reconciliando, lock: Tasks 4 e 8.
- Parser do `.txt` legado (regex de cabeçalho, total declarado como aviso): Task 5; importação: Task 7.
- Frontend: navegação e tema (Task 10), Exportações (Task 11), Conversas (Task 12), Análise (Task 13); limitações mostradas na tela: README (Task 14) e mensagens de importação (Task 11).
- Regras puras com Vitest (`dataPt`, `parseTxt`, `parseProgresso`, `validarGrupo`, `kpis`, sessão): Tasks 3, 5 e 6.
- Segurança (senha obrigatória, `127.0.0.1`, download por id, upload só `.txt` ≤ 20 MB, `.gitignore`): Tasks 3, 9 e o `.gitignore` já commitado.
- Testes (orquestrador com script falso, Playwright smoke, `unittest` do `build_json`, validação de 1527 mensagens): Tasks 1, 5, 7, 8 e 14.
- Entrega (`setup`/`start`/`stop`/`.bat`, `.env.example`, README, ponteiro no LEIA-ME): Tasks 2 e 14.
- Ordem de construção do spec ≈ ordem das Tasks (script → esqueleto/login → banco/parsers/importador → orquestrador/API → telas → smoke/scripts).

**Divergências do spec** (todas registradas no início do plano e no spec, Task 14 Step 8): lock atômico no banco, `Table` sem TanStack, importação em cartão, porta fixa, `<select>` nativo, limite de corpo do proxy, setup sem download do Chromium.

**Consistência de tipos e nomes** — conferidos entre tarefas: `MensagemBruta`/`MensagemParaInserir`/`Mensagem`/`Exportacao` (Task 4) usados em 5, 7, 8, 11, 12; `interpretarDataHoraPt` (5) usado em 7; `parseTxt` (5) em 7; `interpretarLinha`/`EventoProgresso` (5) em 8; `importarJson` (7) em 8; `tentarCriarExportacao`/`atualizarExportacao`/`CamposExportacao` (4) em 8; `ConfigExportacao`/`lerConfigExportacao` (8) em 9; `estaDentro` (6) em 9; `calcularKpis`/`Kpis` (6) em 9 e 13; `lerFiltros`/`inteiro`/`limitar` (9) nas rotas; `invalidarCache`/`useRecursoRemoto` (10) em 11–13; `SeletorGrupo`/`useGrupos` (12) em 13. As chaves do JSON do script (`grupo`, `exportado_em`, `mensagens[].{autor,data_hora_original,texto}`) são as mesmas em `build_json` (Task 1), `fake-teams.mjs` e `importarJson` (Tasks 7–8).

**Placeholders:** nenhum "TBD"/"TODO"/"similar à Task N". Onde um arquivo é copiado do Click Up (`cp`), o comando e a origem exatos estão no passo, e os arquivos copiados são verificados por `tsc`.
