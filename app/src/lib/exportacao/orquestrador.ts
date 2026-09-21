import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { createInterface, type Interface } from "node:readline";
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
  /** O processo já saiu (evento `exit`): cancelar ou expirar deixou de fazer sentido. */
  saiu: boolean;
}

/**
 * Encerra a árvore do processo; se isso falhar (pid não encontrado, taskkill ausente) e o filho
 * ainda estiver vivo, cai no kill direto do processo filho, para ao menos a raiz não sobreviver.
 */
function encerrarExecucao(execucao: Execucao): void {
  if (encerrarArvore(execucao.child.pid)) return;
  const filho = execucao.child;
  if (filho.exitCode !== null || filho.signalCode !== null) return;
  try {
    filho.kill("SIGKILL");
  } catch {
    // Já terminou, ou o sistema recusou: não há mais o que tentar.
  }
}

/**
 * Registro dos processos vivos, em `globalThis`: o Next pode carregar este
 * módulo em mais de uma instância (rotas e recarga a quente), e cancelar só
 * funciona se todas enxergarem o mesmo mapa.
 */
const g = globalThis as unknown as { __extratorExecucoes?: Map<number, Execucao> };
const execucoes = (g.__extratorExecucoes ??= new Map<number, Execucao>());

const LINHAS_DE_LOG = 50;
/** Tempo máximo, após o fim do processo, para ler as últimas linhas dos pipes. */
const DRENAGEM_MS = 1500;

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

  // A vaga já foi reservada: qualquer falha daqui em diante precisa liberá-la
  // (senão o registro fica em_andamento sem processo e trava as próximas).
  try {
    mkdirSync(config.exportsDir, { recursive: true });
    const arquivoJson = path.join(config.exportsDir, `exportacao_${id}.json`);
    atualizarExportacao(db, id, { arquivoJson });

    executar(deps, id, grupo.nome, arquivoJson);
  } catch (erro) {
    try {
      atualizarExportacao(db, id, {
        status: "erro",
        erroMsg: `Falha ao iniciar a exportação: ${mensagemDe(erro)}`,
        finalizadaEm: agora().toISOString(),
      });
    } catch (segundo) {
      console.error(`[exportacao ${id}] não foi possível registrar a falha ao iniciar:`, segundo);
    }
    throw erro;
  }
  return { ok: true, id };
}

/**
 * Encerra a árvore de processos de uma exportação. `false` se ela não está rodando — inclusive
 * quando o processo já saiu e só falta ler as últimas linhas: aí o resultado já está decidido
 * (uma exportação bem-sucedida nunca vira `cancelada`) e o pid pode nem existir mais.
 */
export function cancelarExportacao(id: number): boolean {
  const execucao = execucoes.get(id);
  if (!execucao || execucao.saiu) return false;
  execucao.cancelada = true;
  encerrarExecucao(execucao);
  return true;
}

function executar(deps: DepsOrquestrador, id: number, grupo: string, arquivoJson: string): void {
  const { db, config } = deps;
  const agora = deps.agora ?? (() => new Date());
  const linhas: string[] = [];
  let ultimaLinhaStderr: string | undefined;
  let finalizado = false;
  let child: ChildProcess | undefined;
  const leitores: Interface[] = [];

  /**
   * Grava o estado final uma única vez, seja qual for o caminho que chegou aqui.
   * Nunca lança: uma falha no banco é registrada no log, e a limpeza (timer,
   * registro de processos vivos, pipes) roda sempre, para o lock não travar.
   */
  const finalizar = (campos: CamposExportacao) => {
    if (finalizado) return;
    finalizado = true;
    try {
      const gravar = () =>
        atualizarExportacao(db, id, { ...campos, finalizadaEm: agora().toISOString(), logTail: linhas.join("\n") });
      try {
        gravar();
      } catch {
        gravar();
      }
    } catch (erro) {
      console.error(`[exportacao ${id}] não foi possível gravar o estado final:`, erro);
    } finally {
      const execucao = execucoes.get(id);
      if (execucao) clearTimeout(execucao.timer);
      execucoes.delete(id);
      child?.stdout?.destroy();
      child?.stderr?.destroy();
      // Destruir os pipes não faz o readline emitir `close`: sem fechar, uma drenagem que estourou
      // o tempo deixaria as duas interfaces (e a promessa que espera por elas) vivas.
      for (const leitor of leitores) {
        try {
          leitor.close();
        } catch {
          // Já fechado.
        }
      }
    }
  };

  /** Erro inesperado num handler: encerra o processo e fecha o registro como erro. */
  const falharInternamente = (erro: unknown) => {
    finalizar({ status: "erro", erroMsg: `Erro interno ao processar a exportação: ${mensagemDe(erro)}` });
    // Limitação conhecida: descendentes reparentados depois que a raiz (Python) morre de forma anormal
    // não são alcançados pelo `taskkill /T`.
    encerrarArvore(child?.pid);
  };

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
  const filho = child;

  const execucao: Execucao = {
    child: filho,
    cancelada: false,
    expirou: false,
    saiu: false,
    timer: setTimeout(() => {
      if (execucao.saiu) return;
      execucao.expirou = true;
      encerrarExecucao(execucao);
    }, config.timeoutMs),
  };
  execucoes.set(id, execucao);

  const tratarLinha = (linha: string) => {
    if (finalizado || !linha.trim()) return;
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

  filho.stdout!.setEncoding("utf8");
  filho.stderr!.setEncoding("utf8");
  const leitorSaida = createInterface({ input: filho.stdout! });
  const leitorErros = createInterface({ input: filho.stderr! });
  leitores.push(leitorSaida, leitorErros);
  leitorSaida.on("line", (linha) => {
    try {
      tratarLinha(linha);
    } catch (erro) {
      falharInternamente(erro);
    }
  });
  leitorErros.on("line", (linha) => {
    try {
      if (linha.trim()) ultimaLinhaStderr = linha;
      tratarLinha(linha);
    } catch (erro) {
      falharInternamente(erro);
    }
  });
  const leituraCompleta = Promise.all([
    new Promise<void>((resolver) => leitorSaida.on("close", resolver)),
    new Promise<void>((resolver) => leitorErros.on("close", resolver)),
  ]);

  filho.on("error", (erro) => {
    try {
      finalizar({ status: "erro", erroMsg: `Falha ao executar o script: ${mensagemDe(erro)}` });
    } catch (interno) {
      console.error(`[exportacao ${id}] falha no handler de erro:`, interno);
    }
  });

  // Decide no 'exit' (o processo acabou), não no 'close': um descendente que herdou os pipes
  // os manteria abertos e o 'close' nunca chegaria. A leitura das últimas linhas é limitada.
  filho.on("exit", async (codigo, sinal) => {
    // O desfecho é decidido AGORA: cancelar/expirar durante a drenagem chegaria tarde demais
    // (e um pid morto) e não pode transformar uma exportação bem-sucedida em cancelada.
    execucao.saiu = true;
    clearTimeout(execucao.timer);
    const cancelada = execucao.cancelada;
    const expirou = execucao.expirou;
    try {
      let temporizador: NodeJS.Timeout | undefined;
      await Promise.race([
        leituraCompleta,
        new Promise<void>((resolver) => {
          temporizador = setTimeout(resolver, DRENAGEM_MS);
        }),
      ]);
      clearTimeout(temporizador);
      if (finalizado) return;

      if (cancelada) return finalizar({ status: "cancelada", erroMsg: null });
      if (expirou) {
        return finalizar({
          status: "erro",
          erroMsg: `Tempo esgotado (limite de ${descreverLimite(config.timeoutMs)}). A exportação foi encerrada.`,
        });
      }
      if (codigo !== 0) {
        // stdout e stderr são pipes separados, sem ordem garantida entre si:
        // a mensagem de erro do script vem do stderr, então ele tem prioridade.
        const ultima = ultimaLinhaStderr ?? [...linhas].reverse().find((l) => l.trim());
        const inicio = codigo === null ? `O script foi encerrado pelo sinal ${sinal}.` : `O script terminou com código ${codigo}.`;
        return finalizar({ status: "erro", erroMsg: `${inicio}${ultima ? ` Última linha: ${ultima}` : ""}` });
      }

      if (!existsSync(arquivoJson)) {
        return finalizar({ status: "erro", erroMsg: "O script terminou sem gerar o arquivo .json da exportação." });
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
    } catch (erro) {
      falharInternamente(erro);
    }
  });
}
