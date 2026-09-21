import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline";
import type { DatabaseSync } from "node:sqlite";
import { atualizarExportacao, tentarCriarExportacao, type CamposExportacao } from "@/lib/db/repositorio";
import { importarJson } from "@/lib/importacao";
import { interpretarLinha } from "@/lib/parseProgresso";
import { validarGrupo } from "@/lib/validarGrupo";
import type { ConfigExportacao } from "./config";
import { encerrarArvore } from "./encerrarArvore";

export interface DepsOrquestrador {
  db: DatabaseSync;
  config: ConfigExportacao;
  agora?: () => Date;
}

export type ResultadoInicio =
  | { ok: true; id: number }
  | { ok: false; codigo: "GRUPO_INVALIDO" | "EM_ANDAMENTO" | "PYTHON_AUSENTE"; mensagem: string };

interface Execucao {
  child: ChildProcess;
  timer: NodeJS.Timeout;
  cancelada: boolean;
  expirou: boolean;
}

/**
 * Registro dos processos vivos, em `globalThis`: o Next pode carregar este
 * módulo em mais de uma instância (rotas e recarga a quente), e cancelar só
 * funciona se todas enxergarem o mesmo mapa.
 */
const g = globalThis as unknown as { __extratorExecucoes?: Map<number, Execucao> };
const execucoes = (g.__extratorExecucoes ??= new Map<number, Execucao>());

const LINHAS_DE_LOG = 50;

function mensagemDe(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro);
}

function descreverLimite(ms: number): string {
  return ms >= 60_000 ? `${Math.round(ms / 60_000)} min` : `${Math.round(ms / 1000)} s`;
}

/**
 * Valida o grupo, reserva a vaga (uma exportação por vez) e dispara o script
 * em segundo plano. Devolve na hora; o andamento é lido do banco.
 */
export function iniciarExportacao(deps: DepsOrquestrador, grupoBruto: unknown): ResultadoInicio {
  const { db, config } = deps;
  const agora = deps.agora ?? (() => new Date());

  const grupo = validarGrupo(grupoBruto);
  if (!grupo.ok) return { ok: false, codigo: "GRUPO_INVALIDO", mensagem: grupo.motivo };

  if (!existsSync(config.python) || !existsSync(config.script)) {
    return {
      ok: false,
      codigo: "PYTHON_AUSENTE",
      mensagem:
        "Python do venv ou script de exportação não encontrado. Rode scripts\\setup.ps1 na raiz do projeto " +
        "(ou ajuste TEAMS_PYTHON / TEAMS_SCRIPT em app/.env.local).",
    };
  }

  const id = tentarCriarExportacao(db, grupo.nome, agora().toISOString());
  if (id === null) {
    return { ok: false, codigo: "EM_ANDAMENTO", mensagem: "Já existe uma exportação em andamento. Aguarde ou cancele." };
  }

  mkdirSync(config.exportsDir, { recursive: true });
  const arquivoJson = path.join(config.exportsDir, `exportacao_${id}.json`);
  atualizarExportacao(db, id, { arquivoJson });

  executar(deps, id, grupo.nome, arquivoJson);
  return { ok: true, id };
}

/** Encerra a árvore de processos de uma exportação. `false` se ela não está rodando. */
export function cancelarExportacao(id: number): boolean {
  const execucao = execucoes.get(id);
  if (!execucao) return false;
  execucao.cancelada = true;
  encerrarArvore(execucao.child.pid);
  return true;
}

function executar(deps: DepsOrquestrador, id: number, grupo: string, arquivoJson: string): void {
  const { db, config } = deps;
  const agora = deps.agora ?? (() => new Date());
  const linhas: string[] = [];
  let ultimaLinhaStderr: string | undefined;
  let finalizado = false;

  /** Grava o estado final uma única vez, seja qual for o caminho que chegou aqui. */
  const finalizar = (campos: CamposExportacao) => {
    if (finalizado) return;
    finalizado = true;
    const execucao = execucoes.get(id);
    if (execucao) clearTimeout(execucao.timer);
    execucoes.delete(id);
    atualizarExportacao(db, id, { ...campos, finalizadaEm: agora().toISOString(), logTail: linhas.join("\n") });
  };

  let child: ChildProcess;
  try {
    child = spawn(config.python, [config.script, grupo, "--json-out", arquivoJson], {
      cwd: config.cwd,
      env: { ...process.env, PYTHONUNBUFFERED: "1", PYTHONIOENCODING: "utf-8" },
      stdio: ["ignore", "pipe", "pipe"],
      detached: process.platform !== "win32",
    });
  } catch (erro) {
    finalizar({ status: "erro", erroMsg: `Não foi possível iniciar o script: ${mensagemDe(erro)}` });
    return;
  }

  const execucao: Execucao = {
    child,
    cancelada: false,
    expirou: false,
    timer: setTimeout(() => {
      execucao.expirou = true;
      encerrarArvore(child.pid);
    }, config.timeoutMs),
  };
  execucoes.set(id, execucao);

  const tratarLinha = (linha: string) => {
    if (!linha.trim()) return;
    linhas.push(linha);
    if (linhas.length > LINHAS_DE_LOG) linhas.shift();

    const evento = interpretarLinha(linha);
    const campos: CamposExportacao = { logTail: linhas.join("\n") };
    if (evento?.etapa) campos.etapa = evento.etapa;
    if (evento?.contador !== undefined) campos.contador = evento.contador;
    if (evento?.grupoAberto !== undefined) campos.grupoAberto = evento.grupoAberto;
    if (evento?.arquivoTxt !== undefined) campos.arquivoTxt = evento.arquivoTxt;
    atualizarExportacao(db, id, campos);
  };

  child.stdout!.setEncoding("utf8");
  child.stderr!.setEncoding("utf8");
  const saida = createInterface({ input: child.stdout! });
  const erros = createInterface({ input: child.stderr! });
  saida.on("line", tratarLinha);
  erros.on("line", (linha) => {
    if (linha.trim()) ultimaLinhaStderr = linha;
    tratarLinha(linha);
  });
  // O 'close' do processo pode chegar antes da última linha ser lida.
  const leituraCompleta = Promise.all([
    new Promise<void>((resolver) => saida.on("close", resolver)),
    new Promise<void>((resolver) => erros.on("close", resolver)),
  ]);

  child.on("error", (erro) => {
    finalizar({ status: "erro", erroMsg: `Falha ao executar o script: ${mensagemDe(erro)}` });
  });

  child.on("close", async (codigo) => {
    await leituraCompleta;

    if (execucao.cancelada) return finalizar({ status: "cancelada", erroMsg: null });
    if (execucao.expirou) {
      return finalizar({
        status: "erro",
        erroMsg: `Tempo esgotado (limite de ${descreverLimite(config.timeoutMs)}). A exportação foi encerrada.`,
      });
    }
    if (codigo !== 0) {
      // stdout e stderr são pipes separados, sem ordem garantida entre si:
      // a mensagem de erro do script vem do stderr, então ele tem prioridade.
      const ultima = ultimaLinhaStderr ?? [...linhas].reverse().find((l) => l.trim());
      return finalizar({
        status: "erro",
        erroMsg: `O script terminou com código ${codigo}.${ultima ? ` Última linha: ${ultima}` : ""}`,
      });
    }

    try {
      const resultado = importarJson(db, id, JSON.parse(readFileSync(arquivoJson, "utf8")));
      finalizar({ status: "concluida", totalMensagens: resultado.lidas, contador: resultado.lidas, erroMsg: null });
    } catch (erro) {
      finalizar({
        status: "erro",
        erroMsg: `O script terminou, mas a importação falhou: ${mensagemDe(erro)}. Os arquivos foram mantidos em exports/.`,
      });
    }
  });
}
