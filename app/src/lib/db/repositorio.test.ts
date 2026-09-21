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
