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
