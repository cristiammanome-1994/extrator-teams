import { spawn, type ChildProcess } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import { encerrarArvore } from "./encerrarArvore";

const vivos: ChildProcess[] = [];

afterEach(() => {
  for (const c of vivos.splice(0)) {
    try {
      c.kill("SIGKILL");
    } catch {
      // Já terminou.
    }
  }
});

function processoVivo(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (erro) {
    return (erro as NodeJS.ErrnoException).code === "EPERM";
  }
}

async function aguardar(condicao: () => boolean, ms: number): Promise<void> {
  const fim = Date.now() + ms;
  while (!condicao()) {
    if (Date.now() > fim) throw new Error("tempo esgotado esperando a condição do teste");
    await new Promise((r) => setTimeout(r, 50));
  }
}

describe("encerrarArvore", () => {
  it("pid ausente: devolve false sem lançar", () => {
    expect(encerrarArvore(undefined)).toBe(false);
    expect(encerrarArvore(0)).toBe(false);
  });

  it("pid inexistente: devolve false sem lançar", async () => {
    // Um processo que já terminou: o pid deixa de existir (e ninguém o reaproveita em tão pouco tempo).
    const filho = spawn(process.execPath, ["-e", "0"], { stdio: "ignore" });
    const pid = filho.pid!;
    await new Promise((r) => filho.once("exit", r));
    await aguardar(() => !processoVivo(pid), 5_000);

    expect(() => encerrarArvore(pid)).not.toThrow();
    expect(encerrarArvore(pid)).toBe(false);
  });

  it("processo vivo: devolve true e o processo some", async () => {
    const filho = spawn(process.execPath, ["-e", "setTimeout(()=>{},60000)"], { stdio: "ignore" });
    vivos.push(filho);
    const pid = filho.pid!;
    expect(processoVivo(pid)).toBe(true);

    expect(encerrarArvore(pid)).toBe(true);
    await aguardar(() => !processoVivo(pid), 5_000);
  });
});
