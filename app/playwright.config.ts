import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

/**
 * Smoke test de ponta a ponta: sobe o servidor de verdade (`next dev`, não um
 * mock), entra com a senha real de `.env.local` e navega pelas telas.
 *
 * Usa o Microsoft Edge instalado (`channel: "msedge"`) — o mesmo navegador do
 * script de exportação, e sem baixar outro. Porta 3101, banco `data/e2e.db` e
 * pasta de exportações `data/e2e-exports` próprios, para não tocar nos dados
 * reais (`app/data/extrator.db`, `exports/`).
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
    env: { EXTRATOR_DB: "data/e2e.db", EXTRATOR_EXPORTS_DIR: "data/e2e-exports" },
    reuseExistingServer: false,
    timeout: 90_000,
  },
});
