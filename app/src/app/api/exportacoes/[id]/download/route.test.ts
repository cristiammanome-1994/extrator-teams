import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { NextRequest } from "next/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// `conexao` importa `server-only`, que lança fora do bundler do Next.
vi.mock("server-only", () => ({}));

const SEGREDO = "CONTEUDO-SECRETO-FORA-DE-EXPORTS";
const CONTEUDO = "Histórico do chat: Grupo Download\n[segunda-feira] Ana Teste:\nOlá\n";

let tmp: string;
let exportsDir: string;
let fora: string;
let GET: (request: NextRequest, contexto: { params: Promise<{ id: string }> }) => Promise<Response>;
let obterBanco: typeof import("@/lib/db/conexao").obterBanco;
let repositorio: typeof import("@/lib/db/repositorio");
let caminhoDb: string;

/** Consegue criar symlink de arquivo sem privilégio? (No Windows, só com modo desenvolvedor/admin.) */
function symlinkDeArquivoPermitido(): boolean {
  const sonda = mkdtempSync(path.join(os.tmpdir(), "extrator-sonda-"));
  try {
    writeFileSync(path.join(sonda, "alvo.txt"), "x");
    symlinkSync(path.join(sonda, "alvo.txt"), path.join(sonda, "link.txt"), "file");
    return true;
  } catch {
    return false;
  } finally {
    rmSync(sonda, { recursive: true, force: true });
  }
}
const podeSymlink = symlinkDeArquivoPermitido();

beforeAll(async () => {
  caminhoDb = path.join(os.tmpdir(), `extrator-rota-download-${process.pid}-${Date.now()}.db`);
  process.env.EXTRATOR_DB = caminhoDb;
  ({ obterBanco } = await import("@/lib/db/conexao"));
  repositorio = await import("@/lib/db/repositorio");
  ({ GET } = await import("./route"));
});

afterAll(() => {
  const g = globalThis as unknown as { __extratorBanco?: { close(): void } };
  g.__extratorBanco?.close();
  delete (g as { __extratorBanco?: unknown }).__extratorBanco;
  for (const sufixo of ["", "-wal", "-shm"]) {
    if (existsSync(caminhoDb + sufixo)) rmSync(caminhoDb + sufixo, { force: true });
  }
});

beforeEach(() => {
  tmp = mkdtempSync(path.join(os.tmpdir(), "extrator-download-"));
  exportsDir = path.join(tmp, "exports");
  fora = path.join(tmp, "fora");
  mkdirSync(path.join(tmp, "app"), { recursive: true });
  mkdirSync(exportsDir);
  mkdirSync(fora);
  writeFileSync(path.join(tmp, "segredo.txt"), SEGREDO);
  writeFileSync(path.join(fora, "segredo.txt"), SEGREDO);
  writeFileSync(path.join(tmp, "app", "package.json"), SEGREDO);
  // As rotas resolvem a pasta de exportações a partir de process.cwd(): sem isto, apontariam para o
  // exports/ real do projeto.
  vi.spyOn(process, "cwd").mockReturnValue(path.join(tmp, "app"));
});

afterEach(() => {
  vi.restoreAllMocks();
  rmSync(tmp, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});

/** Cria uma exportação já concluída com `arquivoTxt` (só uma pode estar em andamento por vez). */
function criarExportacao(arquivoTxt: string | null): number {
  const db = obterBanco();
  const id = repositorio.tentarCriarExportacao(db, "Grupo Download", new Date().toISOString());
  if (id === null) throw new Error("já havia uma exportação em andamento");
  repositorio.atualizarExportacao(db, id, { arquivoTxt, status: "concluida" });
  return id;
}

async function baixar(id: number | string) {
  const resposta = await GET(null as unknown as NextRequest, { params: Promise.resolve({ id: String(id) }) });
  return { resposta, texto: await resposta.text() };
}

async function esperar404(arquivoTxt: string | null) {
  const { resposta, texto } = await baixar(criarExportacao(arquivoTxt));
  expect(resposta.status).toBe(404);
  expect(JSON.parse(texto)).toMatchObject({ error: { code: "ARQUIVO_NAO_ENCONTRADO" } });
  expect(resposta.headers.get("cache-control")).toBe("private, no-store");
  expect(texto).not.toContain(SEGREDO);
}

describe("GET /api/exportacoes/[id]/download", () => {
  it("entrega um arquivo legítimo de exports/ com os cabeçalhos corretos", async () => {
    const arquivo = path.join(exportsDir, "Grupo Download_2026.txt");
    writeFileSync(arquivo, CONTEUDO);

    const { resposta, texto } = await baixar(criarExportacao(arquivo));

    expect(resposta.status).toBe(200);
    expect(texto).toBe(CONTEUDO);
    expect(resposta.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(resposta.headers.get("content-disposition")).toBe('attachment; filename="Grupo Download_2026.txt"');
    expect(resposta.headers.get("cache-control")).toBe("private, no-store");
  });

  it("entrega um arquivo em subpasta de exports/", async () => {
    mkdirSync(path.join(exportsDir, "sub"));
    const arquivo = path.join(exportsDir, "sub", "a.txt");
    writeFileSync(arquivo, CONTEUDO);
    const { resposta, texto } = await baixar(criarExportacao(arquivo));
    expect(resposta.status).toBe(200);
    expect(texto).toBe(CONTEUDO);
  });

  describe("caminhos fora de exports/", () => {
    it("relativo com .. (resolvido contra o cwd)", async () => {
      await esperar404(path.join("..", "segredo.txt"));
      await esperar404(path.join("..", "app", "package.json"));
    });

    it("com .. escapando de dentro de exports/", async () => {
      await esperar404(path.join(exportsDir, "..", "segredo.txt"));
      await esperar404(path.join(exportsDir, "sub", "..", "..", "segredo.txt"));
    });

    it("absoluto para um arquivo real fora de exports/", async () => {
      await esperar404(path.join(tmp, "segredo.txt"));
    });

    it("prefixo parecido com exports/ (exports-outro)", async () => {
      mkdirSync(path.join(tmp, "exports-outro"));
      writeFileSync(path.join(tmp, "exports-outro", "a.txt"), SEGREDO);
      await esperar404(path.join(tmp, "exports-outro", "a.txt"));
    });

    it.skipIf(process.platform !== "win32")("UNC", async () => {
      await esperar404("\\\\localhost\\c$\\Windows\\win.ini");
    });

    it("com byte NUL", async () => {
      await esperar404(path.join(exportsDir, "a" + String.fromCharCode(0) + ".txt"));
    });

    it("vazio e nulo", async () => {
      await esperar404("");
      await esperar404(null);
    });

    it("arquivo que não existe dentro de exports/", async () => {
      await esperar404(path.join(exportsDir, "nao-existe.txt"));
    });

    it("exports/ que não existe", async () => {
      rmSync(exportsDir, { recursive: true });
      await esperar404(path.join(exportsDir, "a.txt"));
    });
  });

  it("uma pasta dentro de exports/ dá 404, não 500", async () => {
    mkdirSync(path.join(exportsDir, "pasta.txt"));
    await esperar404(path.join(exportsDir, "pasta.txt"));
  });

  it("a própria pasta exports/ dá 404", async () => {
    await esperar404(exportsDir);
  });

  it("uma junction dentro de exports/ apontando para fora não vaza o conteúdo", async () => {
    const link = path.join(exportsDir, "atalho");
    symlinkSync(fora, link, "junction");
    await esperar404(path.join(link, "segredo.txt"));
  });

  it.skipIf(!podeSymlink)("um symlink de arquivo dentro de exports/ apontando para fora não vaza o conteúdo", async () => {
    const link = path.join(exportsDir, "link.txt");
    symlinkSync(path.join(fora, "segredo.txt"), link, "file");
    await esperar404(link);
  });

  it("um symlink/junction que aponta para DENTRO de exports/ continua funcionando", async () => {
    mkdirSync(path.join(exportsDir, "real"));
    writeFileSync(path.join(exportsDir, "real", "a.txt"), CONTEUDO);
    const link = path.join(exportsDir, "apelido");
    symlinkSync(path.join(exportsDir, "real"), link, "junction");
    const { resposta, texto } = await baixar(criarExportacao(path.join(link, "a.txt")));
    expect(resposta.status).toBe(200);
    expect(texto).toBe(CONTEUDO);
  });

  describe("nome do arquivo no cabeçalho", () => {
    it("nome com caracteres fora de ASCII vira um filename seguro mais filename*", async () => {
      const nome = "Relatório – 日本.txt";
      const arquivo = path.join(exportsDir, nome);
      writeFileSync(arquivo, CONTEUDO);

      const { resposta, texto } = await baixar(criarExportacao(arquivo));

      expect(resposta.status).toBe(200);
      expect(texto).toBe(CONTEUDO);
      const disposicao = resposta.headers.get("content-disposition")!;
      expect(disposicao).toMatch(/^attachment; filename="[\x20-\x7e]+"; filename\*=UTF-8''[A-Za-z0-9%._-]+$/);
      expect(disposicao).toContain("filename*=UTF-8''" + encodeURIComponent(nome));
      expect(disposicao.match(/"/g)).toHaveLength(2);
    });
  });

  describe("identificador", () => {
    it.each(["abc", "1.5", "-1", "1e3", "0x10", " 12 ", "99999999999999999999"])("%j dá 400 ID_INVALIDO", async (id) => {
      const { resposta, texto } = await baixar(id);
      expect(resposta.status).toBe(400);
      expect(JSON.parse(texto)).toMatchObject({ error: { code: "ID_INVALIDO" } });
      expect(resposta.headers.get("cache-control")).toBe("private, no-store");
    });

    it("id numérico que não existe dá 404", async () => {
      const { resposta, texto } = await baixar(999_999);
      expect(resposta.status).toBe(404);
      expect(JSON.parse(texto)).toMatchObject({ error: { code: "ARQUIVO_NAO_ENCONTRADO" } });
      expect(resposta.headers.get("cache-control")).toBe("private, no-store");
    });
  });
});
