import { spawnSync } from "node:child_process";

/**
 * Encerra o processo e todos os descendentes. Só matar o Python deixaria o
 * Edge órfão segurando o `teams_profile`, e a próxima exportação falharia.
 * No Windows usa `taskkill /T /F`; no POSIX o processo foi criado com
 * `detached` (grupo próprio), então o sinal vai para o grupo inteiro.
 *
 * Devolve `true` se o encerramento foi feito e `false` se não foi possível
 * (pid ausente ou não encontrado, `taskkill` indisponível, kill recusado).
 * Nunca lança: quem chama decide o plano B.
 */
export function encerrarArvore(pid: number | undefined): boolean {
  if (!pid) return false;
  try {
    if (process.platform === "win32") {
      const r = spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { windowsHide: true });
      // r.error: taskkill ausente ou sem permissão para iniciar; status 128: pid não encontrado.
      return !r.error && r.status === 0;
    }
    try {
      process.kill(-pid, "SIGKILL");
      return true;
    } catch {
      process.kill(pid, "SIGKILL");
      return true;
    }
  } catch {
    return false;
  }
}
