import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { aplicarEsquema } from "@/lib/db/migracoes";
import { consultarMensagens, listarGrupos, obterExportacao } from "@/lib/db/repositorio";
import { estaDentro } from "./caminhos";
import type { ConfigExportacao } from "./config";
import { cancelarExportacao, iniciarExportacao } from "./orquestrador";

// Envolve `createInterface` (sem alterar o comportamento) só para contar quantas interfaces foram
// criadas e quantas emitiram `close`.
const leitores = vi.hoisted(() => ({ criadas: 0, fechadas: 0 }));
vi.mock("node:readline", async (importarOriginal) => {
  const original = await importarOriginal<typeof import("node:readline")>();
  return {
    ...original,
    createInterface: (...args: Parameters<typeof original.createInterface>) => {
      const interface_ = original.createInterface(...args);
      leitores.criadas++;
      interface_.once("close", () => leitores.fechadas++);
      return interface_;
    },
  };
});

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

const iniciadas: number[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  // Defesa: nenhuma execução (nem neto) pode sobreviver ao teste, mesmo se a asserção falhar.
  for (const id of iniciadas.splice(0)) cancelarExportacao(id);
  const arquivoPid = path.join(tmp, "neto.pid");
  if (existsSync(arquivoPid)) {
    const pid = readFileSync(arquivoPid, "utf8").trim();
    if (process.platform === "win32") spawnSync("taskkill", ["/PID", pid, "/T", "/F"], { windowsHide: true });
    else {
      try {
        process.kill(Number(pid), "SIGKILL");
      } catch {
        // Já terminou.
      }
    }
  }
  delete process.env.FAKE_MODO;
  delete process.env.FAKE_PID_FILE;
  await new Promise((r) => setTimeout(r, 200));
  rmSync(tmp, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
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
  iniciadas.push(r.id);
  return r.id;
}

const arquivoPid = () => path.join(tmp, "neto.pid");

/** Espera o fixture gravar um pid em FAKE_PID_FILE e o devolve. */
async function lerPid(): Promise<number> {
  await aguardar(() => existsSync(arquivoPid()) && /^\d+$/.test(readFileSync(arquivoPid(), "utf8").trim()), 10_000);
  return Number(readFileSync(arquivoPid(), "utf8").trim());
}

function processoVivo(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (erro) {
    return (erro as NodeJS.ErrnoException).code === "EPERM";
  }
}

const aguardarMorte = (pid: number, ms = 5_000) => aguardar(() => !processoVivo(pid), ms);

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
      arquivoTxt: path.join(config.exportsDir, `exportacao_${id}.txt`),
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

  it("passa --output apontando para dentro de exportsDir, e o .txt reportado fica dentro dele (EXTRATOR_EXPORTS_DIR)", async () => {
    const id = iniciar("Grupo X");
    await aguardar(() => terminou(id));

    const e = obterExportacao(db, id)!;
    expect(e.status).toBe("concluida");
    expect(e.arquivoTxt).not.toBeNull();
    // Regressão: sem `--output`, o script escreveria o .txt no seu próprio padrão (cwd),
    // ignorando `config.exportsDir` — o que quebraria o download se os dois divergirem
    // (ex.: EXTRATOR_EXPORTS_DIR configurado para outro lugar).
    expect(estaDentro(config.exportsDir, e.arquivoTxt!)).toBe(true);
    expect(e.arquivoTxt).toMatch(/\.txt$/);
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

describe("robustez do lock de execução única", () => {
  it("falha ao preparar a execução: marca erro, repropaga e não trava o lock", async () => {
    const arquivo = path.join(tmp, "eu-sou-um-arquivo");
    writeFileSync(arquivo, "x");

    expect(() => iniciarExportacao({ db, config: { ...config, exportsDir: arquivo } }, "Grupo X")).toThrow();

    const falha = obterExportacao(db, 1)!;
    expect(falha.status).toBe("erro");
    expect(falha.erroMsg).toContain("Falha ao iniciar");
    expect(falha.finalizadaEm).not.toBeNull();

    const id = iniciar("Grupo X");
    await aguardar(() => terminou(id));
    expect(obterExportacao(db, id)!.status).toBe("concluida");
  });

  it("falha ao gravar o estado final: registra o erro, limpa o registro e não gera rejeição", async () => {
    const erroLog = vi.spyOn(console, "error").mockImplementation(() => {});
    let chamadas = 0;
    // A 1ª chamada é a da criação da execução; as seguintes são as de `finalizar`.
    const agora = () => {
      if (++chamadas > 1) throw new Error("disco cheio");
      return new Date();
    };
    const r = iniciarExportacao({ db, config, agora }, "Grupo X");
    if (!r.ok) throw new Error(r.mensagem);
    iniciadas.push(r.id);

    await aguardar(() => erroLog.mock.calls.length > 0);
    expect(erroLog).toHaveBeenCalledWith(
      expect.stringContaining("não foi possível gravar o estado final"),
      expect.any(Error)
    );
    expect(cancelarExportacao(r.id)).toBe(false);

    // Com outro banco, uma nova exportação roda normalmente.
    const db2 = new DatabaseSync(":memory:");
    aplicarEsquema(db2);
    const r2 = iniciarExportacao({ db: db2, config }, "Grupo Y");
    if (!r2.ok) throw new Error(r2.mensagem);
    iniciadas.push(r2.id);
    await aguardar(() => obterExportacao(db2, r2.id)!.status !== "em_andamento");
    expect(obterExportacao(db2, r2.id)!.status).toBe("concluida");
  });

  it("neto segurando os pipes, script sai com 0: conclui sem esperar o neto", async () => {
    process.env.FAKE_MODO = "neto-pipe";
    process.env.FAKE_PID_FILE = path.join(tmp, "neto.pid");
    const id = iniciar("Grupo X");
    await aguardar(() => terminou(id), 6_000);

    const e = obterExportacao(db, id)!;
    expect(e.status).toBe("concluida");
    expect(e.totalMensagens).toBe(2);
  }, 20_000);

  it("neto segurando os pipes, script sai com 1: marca erro sem esperar o neto", async () => {
    process.env.FAKE_MODO = "neto-pipe-erro";
    process.env.FAKE_PID_FILE = path.join(tmp, "neto.pid");
    const id = iniciar("Grupo X");
    await aguardar(() => terminou(id), 6_000);

    const e = obterExportacao(db, id)!;
    expect(e.status).toBe("erro");
    expect(e.erroMsg).toContain("código 1");
    expect(e.erroMsg).toContain("RuntimeError");
  }, 20_000);
});

describe("limpeza dos leitores de linha", () => {
  it("fecha as interfaces do readline mesmo quando a drenagem estoura o tempo (neto segurando os pipes)", async () => {
    process.env.FAKE_MODO = "neto-pipe";
    process.env.FAKE_PID_FILE = arquivoPid();
    leitores.criadas = 0;
    leitores.fechadas = 0;
    const id = iniciar("Grupo X");
    await aguardar(() => terminou(id), 6_000);

    expect(obterExportacao(db, id)!.status).toBe("concluida");
    expect(leitores.criadas).toBe(2);
    // Sem o `close()` explícito o neto mantém os pipes abertos e nenhuma delas fecharia.
    expect(leitores.fechadas).toBe(2);
  }, 20_000);
});

describe("cancelar na janela de drenagem", () => {
  it("cancelar depois que o processo já saiu devolve false e a exportação bem-sucedida fica concluida", async () => {
    process.env.FAKE_MODO = "neto-pipe";
    process.env.FAKE_PID_FILE = arquivoPid();
    const id = iniciar("Grupo X");

    // O fake imprime a última linha e sai na hora; o neto segura os pipes, então a drenagem
    // (até 1,5 s) começa logo depois. 400 ms após a última linha estamos dentro dela.
    await aguardar(() => obterExportacao(db, id)!.logTail.includes("Pronto! Arquivo salvo"), 10_000);
    await new Promise((r) => setTimeout(r, 400));
    expect(obterExportacao(db, id)!.status).toBe("em_andamento");

    expect(cancelarExportacao(id)).toBe(false);
    await aguardar(() => terminou(id), 6_000);

    const e = obterExportacao(db, id)!;
    expect(e.status).toBe("concluida");
    expect(e.totalMensagens).toBe(2);
    expect(listarGrupos(db).find((g) => g.nome === "Grupo X")!.total).toBe(2);
  }, 20_000);
});

describe("árvore de processos (órfãos)", () => {
  it("cancelar encerra também o neto desacoplado", async () => {
    process.env.FAKE_MODO = "arvore";
    process.env.FAKE_PID_FILE = arquivoPid();
    const id = iniciar("Grupo A");
    const neto = await lerPid();
    await aguardar(() => obterExportacao(db, id)!.etapa === "lendo_historico");
    expect(processoVivo(neto)).toBe(true);

    expect(cancelarExportacao(id)).toBe(true);
    await aguardar(() => terminou(id));

    expect(obterExportacao(db, id)!.status).toBe("cancelada");
    await aguardarMorte(neto);
  }, 30_000);

  it("estourar o tempo limite encerra também o neto desacoplado", async () => {
    process.env.FAKE_MODO = "arvore";
    process.env.FAKE_PID_FILE = arquivoPid();
    config = { ...config, timeoutMs: 800 };
    const id = iniciar("Grupo A");
    const neto = await lerPid();
    await aguardar(() => terminou(id));

    const e = obterExportacao(db, id)!;
    expect(e.status).toBe("erro");
    expect(e.erroMsg).toMatch(/Tempo esgotado/);
    await aguardarMorte(neto);
  }, 30_000);
});

describe("falhas ao iniciar e ao terminar o script", () => {
  async function esperarErroELiberacao(id: number) {
    await aguardar(() => terminou(id), 10_000);
    const e = obterExportacao(db, id)!;
    expect(e.status).toBe("erro");
    expect(e.finalizadaEm).not.toBeNull();
    expect(cancelarExportacao(id)).toBe(false); // nenhuma execução ficou registrada

    // O lock está livre: uma exportação válida começa e conclui.
    const python = config.python;
    config = { ...config, python: process.execPath };
    const novo = iniciarExportacao({ db, config }, "Grupo Y");
    config = { ...config, python };
    if (!novo.ok) throw new Error(`o lock não foi liberado: ${novo.mensagem}`);
    iniciadas.push(novo.id);
    await aguardar(() => terminou(novo.id));
    expect(obterExportacao(db, novo.id)!.status).toBe("concluida");
    return e;
  }

  it("arquivo que não é executável como python: erro mencionando o script e lock livre", async () => {
    const naoExecutavel = path.join(tmp, "nao-executavel.txt");
    writeFileSync(naoExecutavel, "isto não é um programa");
    config = { ...config, python: naoExecutavel };

    const r = iniciarExportacao({ db, config }, "Grupo X");
    if (!r.ok) throw new Error(r.mensagem);
    iniciadas.push(r.id);

    const e = await esperarErroELiberacao(r.id);
    expect(e.erroMsg).toMatch(/Falha ao executar o script|Não foi possível iniciar o script/);
  }, 30_000);

  it("python apontando para uma pasta: erro mencionando o script e lock livre", async () => {
    config = { ...config, python: tmp };

    const r = iniciarExportacao({ db, config }, "Grupo X");
    if (!r.ok) throw new Error(r.mensagem);
    iniciadas.push(r.id);

    const e = await esperarErroELiberacao(r.id);
    expect(e.erroMsg).toMatch(/Falha ao executar o script|Não foi possível iniciar o script/);
  }, 30_000);

  it("código 0 sem gerar o .json: erro com mensagem própria", async () => {
    process.env.FAKE_MODO = "sem-json";
    const id = iniciar("Grupo X");
    await aguardar(() => terminou(id));

    const e = obterExportacao(db, id)!;
    expect(e.status).toBe("erro");
    expect(e.erroMsg).toBe("O script terminou sem gerar o arquivo .json da exportação.");
    expect(listarGrupos(db).find((g) => g.nome === "Grupo X")!.total).toBe(0);
  }, 20_000);

  it("json existe mas a importação falha: erro que manda conferir os arquivos mantidos", async () => {
    process.env.FAKE_MODO = "json-invalido";
    const id = iniciar("Grupo X");
    await aguardar(() => terminou(id));

    const e = obterExportacao(db, id)!;
    expect(e.status).toBe("erro");
    expect(e.erroMsg).toContain("a importação falhou");
    expect(e.erroMsg).toContain("Os arquivos foram mantidos em exports/.");
  }, 20_000);

  it("processo morto por fora (sem cancelar): erro citando a saída do script e lock livre", async () => {
    process.env.FAKE_MODO = "lento";
    process.env.FAKE_PID_FILE = arquivoPid();
    const id = iniciar("Grupo X");
    const pid = await lerPid();

    if (process.platform === "win32") spawnSync("taskkill", ["/PID", String(pid), "/F"], { windowsHide: true });
    else process.kill(pid, "SIGKILL");
    await aguardar(() => terminou(id), 10_000);

    const e = obterExportacao(db, id)!;
    expect(e.status).toBe("erro");
    expect(e.erroMsg).toMatch(/O script (terminou com código \d+|foi encerrado pelo sinal \w+)/);
    expect(cancelarExportacao(id)).toBe(false);

    delete process.env.FAKE_MODO;
    const novo = iniciar("Grupo Y");
    await aguardar(() => terminou(novo));
    expect(obterExportacao(db, novo)!.status).toBe("concluida");
  }, 30_000);
});

describe("idempotência ponta a ponta", () => {
  it("rodar a mesma exportação duas vezes não duplica mensagens", async () => {
    const primeira = iniciar("Grupo X");
    await aguardar(() => terminou(primeira));
    const segunda = iniciar("Grupo X");
    await aguardar(() => terminou(segunda));

    expect(obterExportacao(db, primeira)).toMatchObject({ status: "concluida", totalMensagens: 2 });
    // totalMensagens conta as lidas, não as novas.
    expect(obterExportacao(db, segunda)).toMatchObject({ status: "concluida", totalMensagens: 2 });

    const grupo = listarGrupos(db).find((g) => g.nome === "Grupo X")!;
    expect(grupo.total).toBe(2);
    expect(consultarMensagens(db, { grupoId: grupo.id }, 1, 50).itens.map((m) => m.texto)).toEqual([
      "Primeira",
      "Segunda",
    ]);
  }, 30_000);
});
