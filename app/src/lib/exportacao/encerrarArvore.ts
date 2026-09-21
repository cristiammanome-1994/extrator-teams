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
