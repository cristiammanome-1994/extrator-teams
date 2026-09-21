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
export function lerConfigExportacao(env: Record<string, string | undefined> = process.env, base: string = process.cwd()): ConfigExportacao {
  const raiz = path.resolve(base, "..");
  const pythonPadrao =
    process.platform === "win32" ? path.join(".venv", "Scripts", "python.exe") : path.join(".venv", "bin", "python");
  const minutos = Number(env.EXTRATOR_TIMEOUT_MIN);

  return {
    python: env.TEAMS_PYTHON ? path.resolve(base, env.TEAMS_PYTHON) : path.join(raiz, pythonPadrao),
    script: env.TEAMS_SCRIPT ? path.resolve(base, env.TEAMS_SCRIPT) : path.join(raiz, "teams_chat_export.py"),
    cwd: raiz,
    exportsDir: env.EXTRATOR_EXPORTS_DIR ? path.resolve(base, env.EXTRATOR_EXPORTS_DIR) : path.join(raiz, "exports"),
    timeoutMs: (Number.isFinite(minutos) && minutos > 0 ? minutos : TIMEOUT_PADRAO_MIN) * 60_000,
  };
}
