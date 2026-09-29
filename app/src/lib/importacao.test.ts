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

  it("não marca a última exportação do grupo (só uma exportação de verdade marca)", () => {
    importarTxt(db, TXT);
    const grupo = db.prepare("SELECT ultima_exportacao_em FROM grupos WHERE nome = ?").get("Grupo de Teste") as unknown as {
      ultima_exportacao_em: string | null;
    };
    expect(grupo.ultima_exportacao_em).toBeNull();
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

  it("recusa nome de grupo comprido (informado ou do cabeçalho) em vez de fundir com outro grupo por corte silencioso", () => {
    const comprido = "x".repeat(300);
    expect(() => importarTxt(db, TXT, comprido)).toThrow(ErroImportacao);
    const cabecalhoComprido = TXT.replace("Histórico do chat: Grupo de Teste", `Histórico do chat: ${comprido}`);
    expect(() => importarTxt(db, cabecalhoComprido)).toThrow(ErroImportacao);
  });

  it("recusa nome de grupo com caractere de controle, como a exportação já recusa", () => {
    expect(() => importarTxt(db, TXT, `Grupo${String.fromCharCode(9)}Com Tab`)).toThrow(ErroImportacao);
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

  it("é idempotente: importar o mesmo JSON duas vezes não duplica mensagens", () => {
    const id = tentarCriarExportacao(db, "Grupo JSON", "2026-09-21T10:00:00.000Z")!;
    expect(importarJson(db, id, json)).toEqual({ grupo: "Grupo JSON", lidas: 2, novas: 2 });
    const antes = db.prepare("SELECT COUNT(*) AS n FROM mensagens").get() as unknown as { n: number };

    expect(importarJson(db, id, json)).toEqual({ grupo: "Grupo JSON", lidas: 2, novas: 0 });
    const depois = db.prepare("SELECT COUNT(*) AS n FROM mensagens").get() as unknown as { n: number };
    expect(depois.n).toBe(antes.n);
    expect(depois.n).toBe(2);
  });

  it("lista de mensagens vazia: cria o grupo, lê 0 e marca a última exportação", () => {
    const id = tentarCriarExportacao(db, "Grupo Vazio", "2026-09-21T10:00:00.000Z")!;
    const r = importarJson(db, id, { grupo: "Grupo Vazio", mensagens: [] });
    expect(r).toEqual({ grupo: "Grupo Vazio", lidas: 0, novas: 0 });

    const grupo = db.prepare("SELECT nome, ultima_exportacao_em FROM grupos WHERE nome = ?").get("Grupo Vazio") as unknown as {
      nome: string;
      ultima_exportacao_em: string | null;
    };
    expect(grupo.nome).toBe("Grupo Vazio");
    expect(grupo.ultima_exportacao_em).not.toBeNull();
    expect(listarGrupos(db).find((g) => g.nome === "Grupo Vazio")!.total).toBe(0);
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
