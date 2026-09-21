// Verificacao em servidor real (producao) das portas de aceite da API.
//
// Sobe um `next start` de verdade na porta 51795 (a 51794 fica livre para o app do usuario), com banco,
// pasta de exportacoes e senha TEMPORARIOS, e confere por HTTP real: autenticacao de todas as rotas, origem,
// limites reais de upload, travessia de caminho no download (inclusive junction), importacao idempotente,
// concorrencia, cancelamento, timeout, morte de netos e reconciliacao apos queda do servidor.
//
// Uso: `npm run build` e depois `npm run verificar:api` (dentro de app/).
// Nunca toca em exports/ nem em app/data/. Dados 100% sinteticos; nenhum texto de conversa e impresso.
// Sai com 0 so se nada falhou e nada ficou sem prova; 1 se algum check falhou; 2 se algum check foi pulado (SKIP)
// por nao ser possivel prova-lo (ex.: consulta de processos falhou). Sub-casos com limitacao conhecida nao contam.

import { spawn, spawnSync } from "node:child_process";
import { createHmac, randomBytes } from "node:crypto";
import {
  closeSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  rmdirSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import http from "node:http";
import net from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

// ------------------------------------------------------------------ constantes

const HOST = "127.0.0.1";
const PORTA = 51795;
const ORIGEM = `http://${HOST}:${PORTA}`;
const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NEXT_BIN = path.join(APP_DIR, "node_modules", "next", "dist", "bin", "next");
const FIXTURE = path.join(APP_DIR, "src", "lib", "exportacao", "__fixtures__", "fake-teams.mjs");
const MB = 1024 * 1024;
const NUL = String.fromCharCode(0);
const NOME_COOKIE = "extrator_sessao";
const ehWindows = process.platform === "win32";

// ------------------------------------------------------------------ estado da execucao

const E = {
  tmp: "",
  exportsDir: "",
  dbPath: "",
  senha: `senha-${randomBytes(9).toString("hex")}`,
  segredo: `segredo-${randomBytes(12).toString("hex")}`,
  cookie: null,
  servidor: null, // { proc, pid, log, saiu }
  pidFiles: new Set(),
  extras: new Set(), // processos que o proprio script iniciou fora do servidor (controles positivos)
  junction: null,
  alvoDaJunctionIntacto: undefined,
  segredos: [], // marcadores que NUNCA podem aparecer numa resposta
  vazamentos: [],
  resultados: [], // { estado: PASS|FAIL|SKIP, id }
  limpo: false,
};

const dormir = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const aleatorio = (n = 6) => randomBytes(n).toString("hex");

async function sondar(fn, ms, intervalo = 100) {
  const limite = Date.now() + ms;
  for (;;) {
    const valor = await fn();
    if (valor) return valor;
    if (Date.now() >= limite) return null;
    await dormir(intervalo);
  }
}

// ------------------------------------------------------------------ processos

function vivo(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (erro) {
    return erro.code === "EPERM";
  }
}

async function esperarMorte(pid, ms = 5000) {
  return Boolean(await sondar(() => !vivo(pid), ms, 100));
}

function matarArvore(pid) {
  if (!pid) return;
  try {
    if (ehWindows) spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { windowsHide: true, timeout: 15_000 });
    else process.kill(-pid, "SIGKILL");
  } catch {
    // Ja morreu.
  }
}

/** Consulta de processos do Windows (comando PowerShell trocavel so para o teste por mutacao). */
const COMANDO_LISTA_FAKE_TEAMS =
  "Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -like '*fake-teams*' } | Select-Object -ExpandProperty ProcessId";

/**
 * Pids de processos node rodando o fixture. `null` = DESCONHECIDO (a consulta falhou): quem chama nao pode
 * tratar isso como "lista vazia" nem passar o check. No Windows qualquer status != 0, stderr nao vazio,
 * estouro de tempo ou erro ao iniciar o PowerShell vira `null` (um `Get-CimInstance` que falha tambem sai com 1).
 * `pgrep` e o unico caso em que status 1 com stderr vazio significa "nenhum processo".
 */
function pidsFakeTeams() {
  const r = ehWindows
    ? spawnSync("powershell", ["-NoProfile", "-NonInteractive", "-Command", COMANDO_LISTA_FAKE_TEAMS], {
        encoding: "utf8",
        windowsHide: true,
        timeout: 15_000,
      })
    : spawnSync("pgrep", ["-f", "fake-teams"], { encoding: "utf8", timeout: 15_000 });
  if (r.error || r.signal || String(r.stderr ?? "").trim() !== "") return null;
  if (r.status !== 0 && !(!ehWindows && r.status === 1)) return null;
  return String(r.stdout)
    .split(/\s+/)
    .filter((s) => /^\d+$/.test(s))
    .map(Number);
}

/** Pid que escuta a porta do teste (Windows, via netstat); `null` se nao foi possivel saber ou ninguem escuta. */
function pidEscutando() {
  if (!ehWindows) return null;
  const r = spawnSync("netstat", ["-ano", "-p", "TCP"], { encoding: "utf8", windowsHide: true, timeout: 15_000 });
  if (r.error || r.status !== 0) return null;
  for (const linha of String(r.stdout).split(/\r?\n/)) {
    const c = linha.trim().split(/\s+/);
    if (c.length >= 5 && c[3] === "LISTENING" && c[1] === `${HOST}:${PORTA}` && /^\d+$/.test(c[4])) return Number(c[4]);
  }
  return null;
}

function lerPid(arquivo) {
  try {
    const n = Number(readFileSync(arquivo, "utf8").trim());
    return Number.isInteger(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

function novoPidFile(nome) {
  const arquivo = path.join(E.tmp, nome);
  E.pidFiles.add(arquivo);
  rmSync(arquivo, { force: true });
  return arquivo;
}

const esperarPid = (arquivo, ms = 15_000) => sondar(() => lerPid(arquivo), ms, 50);

/** Espera a lista de fake-teams esvaziar. Devolve a lista final (vazia = ok) ou null se a consulta falhou. */
async function esperarSemFakeTeams(ms = 8000) {
  let ultima = pidsFakeTeams();
  const limite = Date.now() + ms;
  while (ultima !== null && ultima.length > 0 && Date.now() < limite) {
    await dormir(500);
    ultima = pidsFakeTeams();
  }
  return ultima;
}

/** Roda a consulta de fake-teams e exige lista vazia. `null` (consulta falhou) PULA o check, nunca o aprova. */
async function semFakeTeams(t, rotulo, ms = 8000) {
  const lista = await esperarSemFakeTeams(ms);
  if (lista === null) {
    t.pular(`consulta de processos falhou (nao da para provar que ${rotulo})`);
    return null;
  }
  t.igual(lista.length, 0, `processos fake-teams restantes (${rotulo})`);
  return lista;
}

/**
 * Controle positivo da consulta: com fixtures COMPROVADAMENTE vivos (pid lido do proprio fixture e
 * `process.kill(pid, 0)` ok), a lista tem de incluir esses pids. Sem isto, "0 restantes" pareceria igual
 * com a consulta funcionando ou cega. Devolve o texto para o "observed", ou null se a consulta falhou (SKIP).
 */
function controlePositivo(t, pids, rotulo) {
  for (const pid of pids) t.ok(vivo(pid), `${rotulo}: pid ${pid} nao esta vivo, o controle nao vale`);
  const lista = pidsFakeTeams();
  if (lista === null) {
    t.pular(`${rotulo}: consulta de processos falhou`);
    return null;
  }
  for (const pid of pids) t.ok(lista.includes(pid), `${rotulo}: a consulta NAO enxerga o pid vivo ${pid} (lista: ${lista.join(",") || "vazia"})`);
  return `controle positivo (${rotulo}): vivos ${pids.join("+")} -> lista [${lista.join(",")}]`;
}

function portaAberta() {
  return new Promise((resolve) => {
    const s = net.connect({ host: HOST, port: PORTA });
    const fim = (valor) => {
      s.destroy();
      resolve(valor);
    };
    s.setTimeout(1000, () => fim(false));
    s.on("connect", () => fim(true));
    s.on("error", () => fim(false));
  });
}

// ------------------------------------------------------------------ servidor

async function iniciarServidor({ rotulo, modo, pidFile, timeoutMin }) {
  if (await portaAberta()) throw new Error(`a porta ${PORTA} esta ocupada antes de iniciar o servidor "${rotulo}"; abortando sem tocar nela`);
  const env = { ...process.env };
  for (const chave of Object.keys(env)) {
    if (/^(EXTRATOR_|TEAMS_|FAKE_)/.test(chave)) delete env[chave];
  }
  Object.assign(env, {
    NODE_ENV: "production",
    NEXT_TELEMETRY_DISABLED: "1",
    EXTRATOR_DB: E.dbPath,
    EXTRATOR_EXPORTS_DIR: E.exportsDir,
    EXTRATOR_SENHA: E.senha,
    EXTRATOR_SEGREDO_SESSAO: E.segredo,
    EXTRATOR_TIMEOUT_MIN: String(timeoutMin),
    TEAMS_PYTHON: process.execPath,
    TEAMS_SCRIPT: FIXTURE,
    FAKE_MODO: modo,
    FAKE_PID_FILE: pidFile,
  });
  const log = path.join(E.tmp, `servidor-${rotulo}.log`);
  const fd = openSync(log, "a");
  const proc = spawn(process.execPath, [NEXT_BIN, "start", "-H", HOST, "-p", String(PORTA)], {
    cwd: APP_DIR,
    env,
    stdio: ["ignore", fd, fd],
    windowsHide: true,
    detached: !ehWindows,
  });
  closeSync(fd);
  const servidor = { proc, pid: proc.pid, log, saiu: false };
  proc.on("exit", () => {
    servidor.saiu = true;
  });
  E.servidor = servidor;

  const pronto = await sondar(
    async () => {
      if (servidor.saiu) return "morreu";
      const r = await requisitar({ caminho: "/login", tempoMs: 3000 });
      return r.status === 200 ? "ok" : null;
    },
    60_000,
    250
  );
  if (pronto !== "ok") {
    let cauda = "(sem log)";
    try {
      cauda = readFileSync(log, "utf8").split(/\r?\n/).slice(-15).join("\n");
    } catch {
      // Sem log.
    }
    throw new Error(`servidor "${rotulo}" nao ficou pronto (${pronto ?? "tempo esgotado"}). Fim do log:\n${cauda}`);
  }
  if (servidor.saiu) throw new Error(`servidor "${rotulo}" (pid ${servidor.pid}) ja tinha saido quando a porta respondeu`);
  const dono = pidEscutando();
  if (dono !== null && dono !== servidor.pid) {
    throw new Error(`a porta ${PORTA} e atendida pelo pid ${dono}, nao pelo servidor "${rotulo}" que este script iniciou (pid ${servidor.pid})`);
  }
  console.log(`INFO  servidor "${rotulo}" (modo ${modo}, timeout ${timeoutMin} min): pid ${servidor.pid} vivo; pid que escuta a porta ${PORTA}: ${dono ?? "desconhecido"}`);
}

async function pararServidor() {
  const servidor = E.servidor;
  if (!servidor) return;
  matarArvore(servidor.pid);
  await sondar(() => servidor.saiu || !vivo(servidor.pid), 8000, 100);
  const livre = await sondar(async () => !(await portaAberta()), 10_000, 200);
  E.servidor = null;
  if (!livre) throw new Error(`a porta ${PORTA} continua aberta depois de encerrar o servidor (pid ${servidor.pid})`);
}

// ------------------------------------------------------------------ HTTP

/**
 * Requisicao crua com node:http (controle exato de cabecalhos). Nunca rejeita: devolve
 * { status, headers, texto, json, erro, incompleto }. `status` 0 = nenhuma resposta (ver `erro`).
 * `fatiar` envia o corpo com Transfer-Encoding: chunked e sem Content-Length.
 */
function requisitar({ metodo = "GET", caminho, cabecalhos = {}, cookie, corpo, fatiar = false, tempoMs = 30_000 }) {
  return new Promise((resolve) => {
    const h = { ...cabecalhos };
    if (cookie !== undefined && cookie !== null) h.Cookie = cookie;
    const dados = corpo === undefined ? undefined : Buffer.isBuffer(corpo) ? corpo : Buffer.from(corpo);
    if (dados && fatiar) h["Transfer-Encoding"] = "chunked";
    else if (dados) h["Content-Length"] = String(dados.length);

    let resposta = null;
    const partes = [];
    let feito = false;
    let relogio = null;
    const concluir = (extra = {}) => {
      if (feito) return;
      feito = true;
      clearTimeout(relogio);
      const bruto = Buffer.concat(partes);
      const texto = bruto.toString("utf8");
      const cabecalhosRecebidos = resposta?.headers ?? {};
      const varredura = bruto.toString("latin1") + "\n" + JSON.stringify(cabecalhosRecebidos);
      for (const marcador of E.segredos) {
        if (varredura.includes(marcador)) E.vazamentos.push(`${metodo} ${caminho} -> ${resposta?.status ?? 0}`);
      }
      let json;
      try {
        json = JSON.parse(texto);
      } catch {
        json = undefined;
      }
      resolve({ status: resposta?.status ?? 0, headers: cabecalhosRecebidos, texto, json, ...extra });
    };

    const req = http.request({ host: HOST, port: PORTA, method: metodo, path: caminho, headers: h, agent: false }, (res) => {
      resposta = { status: res.statusCode, headers: res.headers };
      res.on("data", (c) => partes.push(c));
      res.on("end", () => concluir());
      res.on("close", () => concluir(res.complete ? {} : { incompleto: true }));
      res.on("error", (e) => concluir({ erro: e.code || e.message }));
    });
    relogio = setTimeout(() => {
      req.destroy();
      concluir({ erro: "TEMPO_ESGOTADO" });
    }, tempoMs);
    req.on("error", (e) => concluir(resposta ? {} : { erro: e.code || e.message }));

    if (!dados) return req.end();
    if (!fatiar) return req.end(dados);
    (async () => {
      const TAM = 256 * 1024;
      try {
        for (let o = 0; o < dados.length; o += TAM) {
          if (feito || req.destroyed) return;
          if (!req.write(dados.subarray(o, o + TAM))) {
            await new Promise((ok) => {
              const soltar = () => {
                req.off("drain", soltar);
                req.off("close", soltar);
                req.off("error", soltar);
                ok();
              };
              req.on("drain", soltar);
              req.on("close", soltar);
              req.on("error", soltar);
            });
          }
        }
        if (!feito && !req.destroyed) req.end();
      } catch {
        // O servidor pode fechar a conexao no meio; o resultado sai do 'response'/'error' acima.
      }
    })();
  });
}

const jsonBody = (obj) => ({ corpo: JSON.stringify(obj), cabecalhos: { "Content-Type": "application/json" } });
const codigoDe = (r) => r.json?.error?.code;
const resumo = (r) => `${r.status || "sem resposta"}${codigoDe(r) ? ` ${codigoDe(r)}` : ""}${r.erro ? ` [${r.erro}]` : ""}`;

async function garantirCookie() {
  if (E.cookie) return;
  const r = await requisitar({ metodo: "POST", caminho: "/api/auth/login", ...jsonBody({ senha: E.senha }) });
  const par = [].concat(r.headers["set-cookie"] ?? []).find((c) => c.startsWith(`${NOME_COOKIE}=`));
  if (r.status === 200 && par) E.cookie = par.split(";")[0];
}

// ------------------------------------------------------------------ dados sinteticos

/** `.txt` no formato do exportador. Com `bytes`, o arquivo tem EXATAMENTE esse tamanho. */
function gerarTxt(grupo, { bytes, qtd }) {
  const cab = Buffer.from(`Histórico do chat: ${grupo}\n\n`, "utf8");
  const bloco = (i, texto) => `[segunda-feira, 7 de setembro de 2026 10:00] Autor ${i % 7}:\n${texto}\n\n`;
  const enchimento = "x".repeat(bytes ? 900 : 40);
  const blocos = [];
  if (qtd) {
    for (let i = 0; i < qtd; i++) blocos.push(bloco(i, `msg-${i}-${enchimento}`));
  } else {
    let total = cab.length;
    for (let i = 0; ; i++) {
      const b = bloco(i, `msg-${i}-${enchimento}`);
      const restante = bytes - total;
      if (restante < 2 * b.length) {
        // O ultimo bloco absorve o resto, para o arquivo fechar no byte.
        blocos.push(bloco(i, `msg-${i}-` + "x".repeat(restante - bloco(i, `msg-${i}-`).length)));
        break;
      }
      blocos.push(b);
      total += b.length;
    }
  }
  const buffer = Buffer.concat([cab, Buffer.from(blocos.join(""), "latin1")]);
  if (bytes && buffer.length !== bytes) throw new Error(`gerarTxt: ${buffer.length} bytes em vez de ${bytes}`);
  return { buffer, qtd: blocos.length };
}

function multipart(arquivo, nome = "dados.txt") {
  const limite = `----verificar${aleatorio(8)}`;
  const inicio = Buffer.from(
    `--${limite}\r\nContent-Disposition: form-data; name="arquivo"; filename="${nome}"\r\nContent-Type: text/plain\r\n\r\n`
  );
  const fim = Buffer.from(`\r\n--${limite}--\r\n`);
  return { corpo: Buffer.concat([inicio, arquivo, fim]), tipo: `multipart/form-data; boundary=${limite}` };
}

const enviarTxt = (arquivo, { fatiar = false, tempoMs = 120_000 } = {}) => {
  const m = multipart(arquivo);
  return requisitar({
    metodo: "POST",
    caminho: "/api/importar",
    cabecalhos: { "Content-Type": m.tipo },
    cookie: E.cookie,
    corpo: m.corpo,
    fatiar,
    tempoMs,
  });
};

async function grupoPorNome(nome) {
  const r = await requisitar({ caminho: "/api/grupos", cookie: E.cookie });
  return r.json?.grupos?.find((g) => g.nome === nome);
}

// ------------------------------------------------------------------ exportacoes (API)

const iniciarExp = (grupo) => requisitar({ metodo: "POST", caminho: "/api/exportacoes", cookie: E.cookie, ...jsonBody({ grupo }) });
const cancelarExp = (id) => requisitar({ metodo: "POST", caminho: `/api/exportacoes/${id}/cancelar`, cookie: E.cookie });
const obterExp = async (id) => (await requisitar({ caminho: `/api/exportacoes/${id}`, cookie: E.cookie })).json?.exportacao;
const listarExp = async () => (await requisitar({ caminho: "/api/exportacoes", cookie: E.cookie })).json?.exportacoes ?? [];

async function esperarStatus(id, aceitos, ms = 15_000) {
  let ultima = null;
  await sondar(
    async () => {
      ultima = await obterExp(id);
      return ultima && aceitos.includes(ultima.status);
    },
    ms,
    200
  );
  return ultima;
}

/** Inicia (esperando o pid do fixture), cancela e confirma a morte. Devolve { id, pid, cancelou, status, morto }. */
async function iniciarECancelar(grupo, pidFile) {
  rmSync(pidFile, { force: true });
  const inicio = await iniciarExp(grupo);
  if (inicio.status !== 202) return { erro: `POST -> ${resumo(inicio)}` };
  const id = inicio.json.id;
  const pid = await esperarPid(pidFile);
  const cancelamento = await cancelarExp(id);
  const exp = await esperarStatus(id, ["cancelada", "erro", "concluida"]);
  const morto = pid ? await esperarMorte(pid) : null;
  return { id, pid, cancelou: cancelamento.json?.ok, status: exp?.status, morto };
}

// ------------------------------------------------------------------ banco (leitura/semeadura direta)

function abrirBanco(somenteLeitura = false) {
  const db = new DatabaseSync(E.dbPath, { readOnly: somenteLeitura });
  db.exec("PRAGMA busy_timeout = 5000");
  return db;
}

// ------------------------------------------------------------------ descoberta de rotas

function descobrirRotas() {
  const raiz = path.join(APP_DIR, "src", "app", "api");
  const arquivos = [];
  const andar = (dir) => {
    for (const item of readdirSync(dir, { withFileTypes: true })) {
      const completo = path.join(dir, item.name);
      if (item.isDirectory()) andar(completo);
      else if (item.name === "route.ts") arquivos.push(completo);
    }
  };
  andar(raiz);
  const pares = [];
  for (const arquivo of arquivos) {
    const fonte = readFileSync(arquivo, "utf8");
    const partes = path.relative(raiz, path.dirname(arquivo)).split(path.sep).filter(Boolean);
    const caminho = "/api" + (partes.length ? "/" + partes.map((p) => (/^\[.+\]$/.test(p) ? "1" : p)).join("/") : "");
    const metodos = new Set();
    for (const re of [/export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\b/g, /export\s+const\s+(GET|POST|PUT|PATCH|DELETE)\b/g]) {
      for (const m of fonte.matchAll(re)) metodos.add(m[1]);
    }
    for (const metodo of metodos) pares.push({ caminho, metodo });
  }
  return { arquivos: arquivos.length, pares };
}

// ------------------------------------------------------------------ checks

function criarT() {
  const falhas = [];
  const notas = [];
  const t = {
    falhas,
    notas,
    pulo: null,
    subs: [], // sub-casos com resultado proprio (ex.: SKIP so de um caso), impressos logo apos a linha do check
    sub(sufixo, estado, texto) {
      t.subs.push({ sufixo, estado, texto });
    },
    ok(condicao, msg) {
      if (!condicao) falhas.push(msg);
    },
    igual(atual, esperado, rotulo) {
      if (atual !== esperado) falhas.push(`${rotulo}: esperado ${JSON.stringify(esperado)}, obtido ${JSON.stringify(atual)}`);
    },
    nota(texto) {
      notas.push(texto);
    },
    pular(motivo) {
      t.pulo = motivo;
    },
  };
  return t;
}

async function rodar(id, descricao, fn) {
  const t = criarT();
  const inicio = Date.now();
  try {
    await fn(t);
  } catch (erro) {
    t.falhas.push(`excecao: ${erro instanceof Error ? erro.message : String(erro)}`);
  }
  const estado = t.falhas.length ? "FAIL" : t.pulo ? "SKIP" : "PASS";
  const observado = [...(t.pulo ? [`motivo: ${t.pulo}`] : []), ...t.notas, ...t.falhas.map((f) => `FALHOU ${f}`)].join("; ");
  E.resultados.push({ estado, id });
  console.log(`${estado}  ${id}  ${descricao}  (observed: ${observado || "ok"}; ${Date.now() - inicio} ms)`);
  for (const sub of t.subs) {
    E.resultados.push({ estado: sub.estado, id: `${id}[${sub.sufixo}]`, tolerado: true });
    console.log(`${sub.estado}  ${id}[${sub.sufixo}]  (observed: ${sub.texto})`);
  }
}

const CHECKS_FASE_A = [
  [
    "AUTH-1",
    "toda rota de API sem cookie -> 401 NAO_AUTENTICADO (exceto o login, publico)",
    async (t) => {
      const { arquivos, pares } = descobrirRotas();
      t.ok(arquivos >= 9, `so ${arquivos} arquivos de rota`);
      t.ok(pares.length >= 10, `so ${pares.length} pares (caminho, metodo)`);
      let protegidas = 0;
      for (const { caminho, metodo } of pares) {
        if (caminho === "/api/auth/login") {
          const r =
            metodo === "POST"
              ? await requisitar({ metodo, caminho, ...jsonBody({ senha: "senha-errada" }) })
              : await requisitar({ metodo, caminho });
          t.ok(codigoDe(r) !== "NAO_AUTENTICADO", `${metodo} ${caminho} devolveu NAO_AUTENTICADO`);
          if (metodo === "POST") t.igual(codigoDe(r), "SENHA_INVALIDA", "login com senha errada");
          t.nota(`${metodo} ${caminho} (publico) -> ${resumo(r)}`);
          continue;
        }
        const r = await requisitar({ metodo, caminho, ...(metodo === "GET" ? {} : jsonBody({})) });
        if (r.status === 401 && codigoDe(r) === "NAO_AUTENTICADO") protegidas++;
        else t.falhas.push(`${metodo} ${caminho} sem cookie -> ${resumo(r)}`);
      }
      const desconhecida = await requisitar({ caminho: "/api/nao-existe" });
      t.igual(desconhecida.status, 401, "/api/nao-existe sem cookie");
      t.nota(`${arquivos} arquivos, ${pares.length} pares, ${protegidas} protegidos -> 401 NAO_AUTENTICADO; /api/nao-existe -> ${desconhecida.status}`);
    },
  ],
  [
    "AUTH-2",
    "paginas sem cookie redirecionam para /login?de=; /login e publica",
    async (t) => {
      for (const p of ["/", "/conversas"]) {
        const r = await requisitar({ caminho: p });
        const local = String(r.headers.location ?? "");
        t.igual(r.status, 307, `GET ${p}`);
        t.ok(local.includes("/login?de="), `GET ${p}: Location sem /login?de= (${local})`);
        t.nota(`GET ${p} -> ${r.status} ${local.replace(/^https?:\/\/[^/]+/, "")}`);
      }
      const login = await requisitar({ caminho: "/login" });
      t.igual(login.status, 200, "GET /login");
      t.nota(`GET /login -> ${login.status}`);
    },
  ],
  [
    "AUTH-3",
    "login com a senha certa emite cookie HttpOnly/SameSite=lax; cookie adulterado, expirado ou vazio -> 401",
    async (t) => {
      const r = await requisitar({ metodo: "POST", caminho: "/api/auth/login", ...jsonBody({ senha: E.senha }) });
      t.igual(r.status, 200, "login com a senha certa");
      const setCookie = [].concat(r.headers["set-cookie"] ?? []).find((c) => c.startsWith(`${NOME_COOKIE}=`)) ?? "";
      t.ok(/;\s*HttpOnly/i.test(setCookie), "Set-Cookie sem HttpOnly");
      t.ok(/;\s*SameSite=lax/i.test(setCookie), "Set-Cookie sem SameSite=lax");
      if (!setCookie) return;
      E.cookie = setCookie.split(";")[0];
      t.nota(`login -> ${r.status}, Set-Cookie HttpOnly=${/HttpOnly/i.test(setCookie)} SameSite=${/SameSite=(\w+)/i.exec(setCookie)?.[1]}`);

      const seguras = ["/api/exportacoes", "/api/grupos", "/api/mensagens?grupoId=1", "/api/analise?grupoId=1"];
      const vistos = [];
      for (const p of seguras) {
        const g = await requisitar({ caminho: p, cookie: E.cookie });
        t.ok([200, 400, 404].includes(g.status), `GET ${p} com cookie -> ${resumo(g)}`);
        vistos.push(`${p.split("?")[0]}=${g.status}`);
      }
      t.nota(`com cookie: ${vistos.join(" ")}`);

      const valor = E.cookie.slice(NOME_COOKIE.length + 1);
      const assinar = (prazo) => createHmac("sha256", E.segredo).update(prazo).digest("hex");
      const futuro = String(Date.now() + 60_000);
      const passado = String(Date.now() - 60_000);
      const casos = [
        ["assinatura adulterada", `${NOME_COOKIE}=${valor.slice(0, -1)}${valor.endsWith("0") ? "1" : "0"}`, 401],
        ["expirado (assinatura valida, prazo vencido)", `${NOME_COOKIE}=${passado}.${assinar(passado)}`, 401],
        ["cookie vazio", `${NOME_COOKIE}=`, 401],
        ["lixo sem ponto", `${NOME_COOKIE}=abc`, 401],
        // Controle: prova que o assinador deste script bate com o do servidor (senao o "expirado" acima nao diria nada).
        ["controle: assinado por este script, prazo futuro", `${NOME_COOKIE}=${futuro}.${assinar(futuro)}`, 200],
      ];
      const obs = [];
      for (const [rotulo, cookie, esperado] of casos) {
        const g = await requisitar({ caminho: "/api/grupos", cookie });
        t.igual(g.status, esperado, rotulo);
        if (esperado === 401) t.igual(codigoDe(g), "NAO_AUTENTICADO", `${rotulo} (codigo)`);
        obs.push(`${rotulo}=${g.status}`);
      }
      t.nota(obs.join("; "));
    },
  ],
  [
    "ORIG-1",
    "protecao de origem em POST/DELETE sobre HTTP real",
    async (t) => {
      await garantirCookie();
      const post = (cabecalhos) =>
        requisitar({
          metodo: "POST",
          caminho: "/api/exportacoes",
          cookie: E.cookie,
          corpo: JSON.stringify({ grupo: "" }),
          cabecalhos: { "Content-Type": "application/json", ...cabecalhos },
        });
      const obs = [];
      const casos = [
        ["Origin evil.example", { Origin: "http://evil.example" }, 403, "ORIGEM_INVALIDA"],
        ["Origin outra porta (127.0.0.1:3000)", { Origin: "http://127.0.0.1:3000" }, 403, "ORIGEM_INVALIDA"],
        ["Origin null", { Origin: "null" }, 403, "ORIGEM_INVALIDA"],
        ["Origin correto", { Origin: ORIGEM }, 400, "GRUPO_INVALIDO"],
        ["Host localhost + Origin localhost", { Host: `localhost:${PORTA}`, Origin: `http://localhost:${PORTA}` }, 400, "GRUPO_INVALIDO"],
        ["sem Origin", {}, 400, "GRUPO_INVALIDO"],
      ];
      for (const [rotulo, cab, status, codigo] of casos) {
        const r = await post(cab);
        t.igual(r.status, status, rotulo);
        t.igual(codigoDe(r), codigo, `${rotulo} (codigo)`);
        obs.push(`${rotulo}=${resumo(r)}`);
      }
      const saida = await requisitar({ metodo: "DELETE", caminho: "/api/auth/login", cabecalhos: { Origin: "http://evil.example" } });
      t.igual(saida.status, 403, "logout com origem estranha");
      t.igual(codigoDe(saida), "ORIGEM_INVALIDA", "logout com origem estranha (codigo)");
      obs.push(`DELETE login evil=${resumo(saida)}`);
      const leitura = await requisitar({ caminho: "/api/grupos", cookie: E.cookie, cabecalhos: { Origin: "http://evil.example" } });
      t.igual(leitura.status, 200, "GET com origem estranha nao passa pelo portao de origem");
      obs.push(`GET grupos evil=${leitura.status}`);
      t.nota(obs.join("; "));
    },
  ],
  [
    "UP-1",
    "limites reais de upload (15 MB ok, 20 MB ok, 20 MB+1 -> 413, 22 MB -> 413, chunked 25 MB, servidor segue de pe)",
    async (t) => {
      await garantirCookie();
      const nome = (rotulo) => `UP-${rotulo}-${aleatorio(3)}`;
      const obs = [];

      // (a) 15 MB: acima do buffer padrao de 10 MB do proxy; tem de chegar inteiro.
      const nomeA = nome("a");
      const a = gerarTxt(nomeA, { bytes: 15 * MB });
      const ra = await enviarTxt(a.buffer);
      t.igual(ra.status, 200, "(a) 15 MB");
      t.igual(ra.json?.lidas, a.qtd, "(a) lidas");
      t.igual(ra.json?.novas, a.qtd, "(a) novas");
      obs.push(`(a) 15 MB, ${a.qtd} msgs -> ${resumo(ra)} lidas=${ra.json?.lidas} novas=${ra.json?.novas}`);

      // (b) exatamente 20 MB.
      const nomeB = nome("b");
      const b = gerarTxt(nomeB, { bytes: 20 * MB });
      const rb = await enviarTxt(b.buffer);
      t.igual(rb.status, 200, "(b) 20 MB exatos");
      t.igual(rb.json?.lidas, b.qtd, "(b) lidas");
      obs.push(`(b) 20 MB exatos, ${b.qtd} msgs -> ${resumo(rb)} lidas=${rb.json?.lidas}`);

      // (c) 20 MB + 1 byte (corpo ainda < 21 MB): cai na checagem do tamanho do arquivo.
      const c = gerarTxt(nome("c"), { bytes: 20 * MB + 1 });
      const rc = await enviarTxt(c.buffer);
      t.igual(rc.status, 413, "(c) 20 MB + 1");
      t.igual(codigoDe(rc), "ARQUIVO_GRANDE", "(c) codigo");
      obs.push(`(c) 20 MB+1 -> ${resumo(rc)}`);

      // (d) ~22 MB: cai no pre-check de Content-Length.
      const d = gerarTxt(nome("d"), { bytes: 22 * MB });
      const rd = await enviarTxt(d.buffer);
      t.igual(rd.status, 413, "(d) 22 MB");
      t.igual(codigoDe(rd), "ARQUIVO_GRANDE", "(d) codigo");
      obs.push(`(d) 22 MB -> ${resumo(rd)}`);

      // (e) ~25 MB chunked, sem Content-Length.
      const e = gerarTxt(nome("e"), { bytes: 25 * MB });
      const re = await enviarTxt(e.buffer, { fatiar: true });
      t.ok(re.status === 400 || re.status === 413, `(e) chunked 25 MB devolveu ${resumo(re)}${re.incompleto ? " (resposta incompleta)" : ""}`);
      obs.push(`(e) chunked 25 MB -> ${resumo(re)}${re.incompleto ? " incompleta" : ""}`);

      // (f) o servidor segue respondendo e os totais batem.
      const inicio = Date.now();
      const g = await requisitar({ caminho: "/api/grupos", cookie: E.cookie, tempoMs: 5000 });
      const ms = Date.now() - inicio;
      t.igual(g.status, 200, "(f) GET /api/grupos");
      const grupoA = g.json?.grupos?.find((x) => x.nome === nomeA);
      const grupoB = g.json?.grupos?.find((x) => x.nome === nomeB);
      t.igual(grupoA?.total, a.qtd, "(f) total do grupo (a)");
      t.igual(grupoB?.total, b.qtd, "(f) total do grupo (b)");
      obs.push(`(f) GET grupos ${g.status} em ${ms} ms; total(a)=${grupoA?.total}/${a.qtd}; total(b)=${grupoB?.total}/${b.qtd}`);
      t.nota(obs.join("; "));
    },
  ],
  [
    "IDEM-1",
    "importar o mesmo .txt duas vezes: 2a vez novas=0, total igual, ultima_exportacao_em NULL",
    async (t) => {
      await garantirCookie();
      const nomeGrupo = `IDEM-${aleatorio(3)}`;
      const txt = gerarTxt(nomeGrupo, { qtd: 5 });
      const r1 = await enviarTxt(txt.buffer);
      const g1 = await grupoPorNome(nomeGrupo);
      const r2 = await enviarTxt(txt.buffer);
      const g2 = await grupoPorNome(nomeGrupo);
      t.igual(r1.status, 200, "1a importacao");
      t.igual(r1.json?.novas, 5, "1a importacao novas");
      t.igual(r2.status, 200, "2a importacao");
      t.igual(r2.json?.novas, 0, "2a importacao novas");
      t.igual(r2.json?.lidas, r1.json?.lidas, "lidas inalteradas");
      t.igual(g2?.total, g1?.total, "total do grupo inalterado");
      const db = abrirBanco(true);
      let ultima;
      try {
        ultima = db.prepare("SELECT ultima_exportacao_em AS u FROM grupos WHERE nome = ?").get(nomeGrupo)?.u;
      } finally {
        db.close();
      }
      t.ok(ultima === null, `ultima_exportacao_em deveria ser NULL, veio ${JSON.stringify(ultima)}`);
      t.nota(
        `1a: novas=${r1.json?.novas} lidas=${r1.json?.lidas}; 2a: novas=${r2.json?.novas} lidas=${r2.json?.lidas}; total ${g1?.total} -> ${g2?.total}; ultima_exportacao_em=${ultima === null ? "NULL" : ultima}`
      );
    },
  ],
  [
    "DL-1",
    "download: arquivo legitimo ok; travessia, absoluto, UNC, pasta, junction, NUL e vazio -> 404; ids invalidos -> 400 (limitacao: o caso UNC nao tem controle fiel, o compartilhamento administrativo pode nao ser legivel aqui)",
    async (t) => {
      await garantirCookie();
      const segredo = `SEGREDO-${aleatorio(8)}`;
      const segredoJunction = `SEGREDO-${aleatorio(8)}`;
      E.segredos.push(segredo, segredoJunction);
      const fora = path.join(E.tmp, "fora");
      mkdirSync(fora, { recursive: true });
      const arquivoSegredo = path.join(E.tmp, "secret.txt");
      writeFileSync(arquivoSegredo, `${segredo}\n`);
      writeFileSync(path.join(fora, "dentro.txt"), `${segredoJunction}\n`);
      mkdirSync(path.join(E.exportsDir, "subpasta"), { recursive: true });
      const juncao = path.join(E.exportsDir, "juncao");
      symlinkSync(fora, juncao, "junction");
      E.junction = juncao;

      // Controles: sem isto um 404 poderia ser so "o arquivo nao existe". O alvo e legivel pelos caminhos de ataque.
      t.ok(readFileSync(path.join(juncao, "dentro.txt"), "utf8").includes(segredoJunction), "controle: a junction nao leva ao arquivo de fora");
      t.ok(path.resolve(APP_DIR, path.relative(APP_DIR, arquivoSegredo)) === arquivoSegredo, "controle: o caminho relativo nao resolve para o segredo");
      t.ok(path.resolve(`${E.exportsDir}${path.sep}..${path.sep}secret.txt`) === arquivoSegredo, "controle: exports/../secret.txt nao resolve para o segredo");

      const marcador = `LEGIT-${aleatorio(6)}`;
      const conteudo = `${marcador}\nlinha dois\n`;
      const nomeLegit = `legit-${aleatorio(3)}.txt`;
      const legit = path.join(E.exportsDir, nomeLegit);
      writeFileSync(legit, conteudo);

      const casos = [
        ["legitimo", legit, 200],
        ["relativo com ..", path.relative(APP_DIR, arquivoSegredo), 404],
        ["absoluto fora de exports", arquivoSegredo, 404],
        ["exports/../secret.txt", `${E.exportsDir}${path.sep}..${path.sep}secret.txt`, 404],
        ["UNC (sem controle fiel)", "\\\\127.0.0.1\\c$\\Windows\\win.ini", 404],
        ["diretorio dentro de exports", path.join(E.exportsDir, "subpasta"), 404],
        ["junction para fora", path.join(juncao, "dentro.txt"), 404],
        ["caminho com NUL", `${E.exportsDir}${path.sep}a${NUL}b.txt`, 404],
        ["string vazia", "", 404],
      ];

      const db = abrirBanco();
      const ids = [];
      let nulLido = "";
      try {
        const gid = Number(db.prepare("INSERT INTO grupos (nome) VALUES (?)").run(`DL-${aleatorio(3)}`).lastInsertRowid);
        const inserir = db.prepare("INSERT INTO exportacoes (grupo_id, status, iniciada_em, arquivo_txt) VALUES (?, 'concluida', ?, ?)");
        for (const [, caminho] of casos) ids.push(Number(inserir.run(gid, new Date().toISOString(), caminho).lastInsertRowid));
        // O byte NUL sobreviveu ao SQLite? (mesma biblioteca que o servidor usa para ler o registro)
        nulLido = String(db.prepare("SELECT arquivo_txt AS a FROM exportacoes WHERE id = ?").get(ids[casos.findIndex(([r]) => r === "caminho com NUL")])?.a ?? "");
      } finally {
        db.close();
      }

      const nulSobreviveu = nulLido.includes(NUL);
      const obs = [];
      for (let i = 0; i < casos.length; i++) {
        const [rotulo, , esperado] = casos[i];
        if (rotulo === "caminho com NUL" && !nulSobreviveu) {
          t.sub("NUL", "SKIP", `o SQLite nao preservou o byte NUL no registro (lido: ${nulLido.length} caracteres); sem NUL o caso nao e fiel`);
          continue;
        }
        const r = await requisitar({ caminho: `/api/exportacoes/${ids[i]}/download`, cookie: E.cookie });
        t.igual(r.status, esperado, rotulo);
        if (esperado === 404) t.igual(codigoDe(r), "ARQUIVO_NAO_ENCONTRADO", `${rotulo} (codigo)`);
        if (i === 0) {
          t.igual(r.texto, conteudo, "corpo do arquivo legitimo");
          t.ok(
            /^attachment; filename="?legit-[0-9a-f]+\.txt"?/.test(String(r.headers["content-disposition"])),
            `Content-Disposition: ${r.headers["content-disposition"]}`
          );
          t.igual(r.headers["cache-control"], "private, no-store", "Cache-Control");
          obs.push(`legitimo=${r.status} corpo igual=${r.texto === conteudo} CD="${r.headers["content-disposition"]}" CC="${r.headers["cache-control"]}"`);
        } else {
          obs.push(`${rotulo}=${resumo(r)}${rotulo === "caminho com NUL" ? " (NUL preservado no registro)" : ""}`);
        }
      }
      for (const invalido of ["abc", "1.5", "-1", "1e3"]) {
        const r = await requisitar({ caminho: `/api/exportacoes/${invalido}/download`, cookie: E.cookie });
        t.igual(r.status, 400, `id ${invalido}`);
        t.igual(codigoDe(r), "ID_INVALIDO", `id ${invalido} (codigo)`);
        obs.push(`id ${invalido}=${resumo(r)}`);
      }
      t.ok(E.vazamentos.length === 0, `marcador secreto apareceu em: ${E.vazamentos.join(", ")}`);
      t.nota(obs.join("; "));
    },
  ],
  [
    "CONC-1",
    "concorrencia real: 2 POST simultaneos -> 202 + 409; cancelar mata o processo; lock liberado",
    async (t) => {
      await garantirCookie();
      const pidFile = novoPidFile("lento.pid");
      const [r1, r2] = await Promise.all([iniciarExp(`CONC-A-${aleatorio(3)}`), iniciarExp(`CONC-B-${aleatorio(3)}`)]);
      const status = [r1.status, r2.status].sort();
      t.igual(status.join(","), "202,409", "status dos dois POST concorrentes");
      const perdedor = r1.status === 409 ? r1 : r2;
      t.igual(codigoDe(perdedor), "EM_ANDAMENTO", "codigo do 409");
      const vencedor = r1.status === 202 ? r1 : r2;
      const id = vencedor.json?.id;
      const emAndamento = (await listarExp()).filter((e) => e.status === "em_andamento");
      t.igual(emAndamento.length, 1, "exportacoes em_andamento");
      const pid = await esperarPid(pidFile);
      t.ok(pid !== null, "fixture nao gravou o pid");
      const cancelou = await cancelarExp(id);
      t.igual(cancelou.json?.ok, true, "cancelar");
      const exp = await esperarStatus(id, ["cancelada", "erro", "concluida"]);
      t.igual(exp?.status, "cancelada", "status apos cancelar");
      const morto = pid ? await esperarMorte(pid) : false;
      t.ok(morto, `pid ${pid} do fixture continua vivo`);
      const segundo = await cancelarExp(id);
      t.igual(segundo.json?.ok, false, "segundo cancelar");
      const outro = await iniciarECancelar(`CONC-C-${aleatorio(3)}`, pidFile);
      t.ok(!outro.erro, `novo POST: ${outro.erro}`);
      t.igual(outro.cancelou, true, "cancelar a nova exportacao");
      t.igual(outro.status, "cancelada", "status da nova exportacao");
      t.ok(outro.morto === true, "pid da nova exportacao continua vivo");
      t.nota(
        `POST concorrentes -> ${status.join("+")} (${resumo(perdedor)}); em_andamento=${emAndamento.length}; cancelar=${cancelou.json?.ok} -> ${exp?.status}; pid ${pid} morto=${morto}; 2o cancelar=${segundo.json?.ok}; novo POST=202 (lock livre), cancelado -> ${outro.status}, pid morto=${outro.morto}`
      );
    },
  ],
  [
    "PROC-1",
    "controle positivo da consulta de processos: com um fixture vivo (pid do proprio fixture) a lista o inclui; depois de morto, nao",
    async (t) => {
      await garantirCookie();
      const pidFile = novoPidFile("lento.pid");
      const inicio = await iniciarExp(`PROC-A-${aleatorio(3)}`);
      t.igual(inicio.status, 202, "POST");
      const id = inicio.json?.id;
      const pid = await esperarPid(pidFile);
      if (pid === null) return t.falhas.push("o fixture nao gravou o pid (controle impossivel)");
      const texto = controlePositivo(t, [pid], "fixture do servidor");
      const cancelou = await cancelarExp(id);
      t.igual(cancelou.json?.ok, true, "cancelar");
      const morto = await esperarMorte(pid);
      t.ok(morto, `pid ${pid} continua vivo apos cancelar`);
      // Controle negativo: a mesma consulta, depois da morte, nao pode mais listar o pid.
      const depois = await esperarSemFakeTeams();
      if (depois === null) t.pular("consulta de processos falhou depois da morte do fixture");
      else t.ok(!depois.includes(pid), `o pid ${pid} morto ainda aparece na lista: [${depois.join(",")}]`);
      t.nota(`${texto ?? "controle positivo nao concluido"}; apos cancelar: morto=${morto}, lista [${depois?.join(",") ?? "?"}]`);
    },
  ],
  [
    "ERR-1",
    "apos a fase A nenhum processo fake-teams sobrou",
    async (t) => {
      const lista = await semFakeTeams(t, "nao sobrou fake-teams");
      if (lista) t.nota(`fake-teams restantes=${lista.length}`);
    },
  ],
];

// ------------------------------------------------------------------ fases seguintes

/**
 * Controle positivo da consulta na fase B (servidor com timeout curto): o fixture do servidor vive so ~1,8 s,
 * curto demais para consultar; entao o script sobe ele mesmo um fixture `arvore` (pai + neto desacoplado, como o
 * do servidor) so para provar que a consulta enxerga PAI e NETO vivos nesta configuracao, e que deixa de enxerga-los
 * depois que morrem. Isso sustenta a afirmacao "pai e neto sumiram" do TMO-1.
 */
async function checkControleArvore(t) {
  const pidFile = novoPidFile("controle-arvore.pid");
  const saida = path.join(E.tmp, "controle-arvore.json");
  const pai = spawn(process.execPath, [FIXTURE, "CONTROLE", "--json-out", saida], {
    env: { ...process.env, FAKE_MODO: "arvore", FAKE_PID_FILE: pidFile },
    stdio: "ignore",
    windowsHide: true,
  });
  E.extras.add(pai.pid);
  const neto = await esperarPid(pidFile);
  if (neto === null) return t.falhas.push("o fixture de controle nao gravou o pid do neto");
  E.extras.add(neto);
  const texto = controlePositivo(t, [pai.pid, neto], "pai e neto do fixture arvore");
  matarArvore(pai.pid);
  matarArvore(neto);
  const paiMorto = await esperarMorte(pai.pid);
  const netoMorto = await esperarMorte(neto);
  t.ok(paiMorto && netoMorto, `o fixture de controle nao morreu (pai=${paiMorto}, neto=${netoMorto})`);
  const depois = await esperarSemFakeTeams();
  if (depois === null) t.pular("consulta de processos falhou depois da morte do fixture de controle");
  else t.ok(!depois.includes(pai.pid) && !depois.includes(neto), `pai/neto mortos ainda na lista: [${depois.join(",")}]`);
  t.nota(`${texto ?? "controle positivo nao concluido"}; apos matar: pai morto=${paiMorto}, neto morto=${netoMorto}, lista [${depois?.join(",") ?? "?"}]`);
}

async function checkTimeout(t) {
  await garantirCookie();
  const pidFile = novoPidFile("arvore.pid");
  const inicio = await iniciarExp(`TMO-${aleatorio(3)}`);
  t.igual(inicio.status, 202, "POST");
  const id = inicio.json?.id;
  const exp = await esperarStatus(id, ["erro", "concluida", "cancelada"], 15_000);
  t.igual(exp?.status, "erro", "status final");
  t.ok(String(exp?.erroMsg ?? "").includes("Tempo esgotado"), `erroMsg sem "Tempo esgotado" (${exp?.erroMsg ? "tem outra mensagem" : "vazia"})`);
  const neto = lerPid(pidFile);
  if (neto === null) t.pular("o fixture nao chegou a gravar o pid do neto antes do timeout de ~1,8 s");
  const netoMorto = neto ? await esperarMorte(neto) : null;
  if (neto) t.ok(netoMorto, `neto ${neto} continua vivo`);
  const lista = await semFakeTeams(t, "pai e neto sumiram apos o timeout");

  // Segundo ciclo: com timeout de ~1,8 s, cancelar logo ou ja ter expirado sao desfechos legitimos; o lock tem de estar livre.
  const outro = await iniciarECancelar(`TMO-B-${aleatorio(3)}`, pidFile);
  t.ok(!outro.erro, `lock: novo POST -> ${outro.erro}`);
  if (!outro.erro) {
    t.ok(["cancelada", "erro"].includes(outro.status), `status do segundo ciclo: ${outro.status}`);
    if (outro.status === "cancelada") t.igual(outro.cancelou, true, "cancelar respondeu ok:true mas o status nao e cancelada (ou o inverso)");
    if (outro.pid === null) t.pular("o fixture do segundo ciclo nao gravou o pid antes do timeout");
    else t.ok(outro.morto === true, `pid ${outro.pid} do segundo ciclo continua vivo`);
  }
  const listaFinal = await semFakeTeams(t, "nada sobrou apos o segundo ciclo");
  t.nota(
    `status=${exp?.status}; erroMsg contem "Tempo esgotado"=${String(exp?.erroMsg ?? "").includes("Tempo esgotado")}; neto pid ${neto ?? "?"} morto=${netoMorto}; pai+neto: fake-teams restantes=${lista?.length ?? "?"}; novo POST=202 (lock livre), cancelar=${outro.cancelou} status=${outro.status}, pid ${outro.pid ?? "?"} morto=${outro.morto}; restantes ao final=${listaFinal?.length ?? "?"}`
  );
}

async function checkOrfao(t) {
  await garantirCookie();
  const pidFile = novoPidFile("arvore.pid");
  const inicio = await iniciarExp(`ORF-${aleatorio(3)}`);
  t.igual(inicio.status, 202, "POST");
  const id = inicio.json?.id;
  const neto = await esperarPid(pidFile);
  t.ok(neto !== null, "o pid do neto nunca foi gravado");
  t.ok(neto === null || vivo(neto), "o neto nao estava vivo antes do cancelamento");
  // Controle positivo com o neto (pid lido do fixture) vivo, ANTES de cancelar.
  const controle = neto !== null ? controlePositivo(t, [neto], "neto do servidor antes de cancelar") : null;
  const cancelou = await cancelarExp(id);
  t.igual(cancelou.json?.ok, true, "cancelar");
  const exp = await esperarStatus(id, ["cancelada", "erro", "concluida"]);
  t.igual(exp?.status, "cancelada", "status apos cancelar");
  const morto = neto ? await esperarMorte(neto) : false;
  t.ok(morto, `neto ${neto} continua vivo`);
  const lista = await semFakeTeams(t, "nada sobrou apos cancelar");
  t.nota(`${controle ?? "controle positivo nao concluido"}; cancelar=${cancelou.json?.ok} -> ${exp?.status}; neto pid ${neto ?? "?"} morto=${morto}; fake-teams restantes=${lista?.length ?? "?"}`);
}

const CONFIG_BOOT = { modo: "lento", pidFile: "", timeoutMin: 30 };

async function checkBoot(t) {
  await garantirCookie();
  const pidFile = CONFIG_BOOT.pidFile;
  rmSync(pidFile, { force: true });
  const inicio = await iniciarExp(`BOOT-${aleatorio(3)}`);
  t.igual(inicio.status, 202, "POST antes da queda");
  const id = inicio.json?.id;
  const pid = await esperarPid(pidFile);
  t.ok(pid !== null, "fixture nao gravou o pid");
  const pidServidor = E.servidor.pid;
  await pararServidor(); // taskkill /T /F: derruba o servidor e o fixture que ele estava rodando
  const filhoMorto = pid ? await esperarMorte(pid) : null;
  t.ok(filhoMorto !== false, `fixture ${pid} sobreviveu a queda do servidor`);
  await iniciarServidor({ rotulo: "boot-2", ...CONFIG_BOOT });
  const exp = await obterExp(id);
  t.igual(exp?.status, "erro", "status apos reiniciar");
  t.ok(String(exp?.erroMsg ?? "").includes("Interrompida"), `erroMsg sem "Interrompida" (${exp?.erroMsg ? "tem outra mensagem" : "vazia"})`);
  const outro = await iniciarECancelar(`BOOT-B-${aleatorio(3)}`, pidFile);
  t.ok(!outro.erro, `novo POST apos a queda: ${outro.erro}`);
  t.igual(outro.cancelou, true, "cancelar o novo");
  t.ok(outro.morto === true, "pid do novo continua vivo");
  t.nota(
    `servidor ${pidServidor} morto a forca; fixture ${pid ?? "?"} morto=${filhoMorto}; apos reiniciar: status=${exp?.status}, erroMsg contem "Interrompida"=${String(exp?.erroMsg ?? "").includes("Interrompida")}; novo POST=202, cancelado -> ${outro.status}, pid morto=${outro.morto}`
  );
}

async function checkVazamento(t) {
  t.ok(E.segredos.length >= 2, "marcadores secretos nao foram registrados (DL-1 nao rodou?)");
  t.igual(E.vazamentos.length, 0, "respostas que continham um marcador secreto");
  t.nota(`${E.segredos.length} marcadores secretos vigiados em todas as respostas; ocorrencias=${E.vazamentos.length}`);
}

// ------------------------------------------------------------------ limpeza

function limpar() {
  if (E.limpo) return;
  E.limpo = true;
  if (E.servidor) matarArvore(E.servidor.pid);
  // Pids gravados pelo fixture e fixtures de controle: so mata o que e mesmo um fake-teams (o pid pode ter sido reaproveitado).
  const gravados = [...new Set([...[...E.pidFiles].map(lerPid).filter(Boolean), ...E.extras])].filter(vivo);
  if (gravados.length) {
    const fakes = pidsFakeTeams();
    if (fakes === null) console.error(`aviso: nao consegui listar processos; pids ${gravados.join(",")} nao foram encerrados (podem ser de outro processo)`);
    else for (const pid of gravados) if (fakes.includes(pid)) matarArvore(pid);
  }
  if (E.junction) {
    // Remover a JUNCTION (nao o alvo): rmSync recursivo poderia seguir o link e apagar o conteudo de fora.
    try {
      rmdirSync(E.junction);
    } catch {
      try {
        unlinkSync(E.junction);
      } catch {
        // Ja removida.
      }
    }
  }
  if (E.tmp) {
    try {
      E.alvoDaJunctionIntacto = existsSync(path.join(E.tmp, "fora", "dentro.txt"));
      rmSync(E.tmp, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
    } catch (erro) {
      console.error(`aviso: nao consegui remover ${E.tmp}: ${erro.message}`);
    }
  }
}

// ------------------------------------------------------------------ principal

async function principal() {
  if (!existsSync(path.join(APP_DIR, ".next", "BUILD_ID"))) {
    console.error("Falta o build de producao: rode `npm run build` (dentro de app/) antes de `npm run verificar:api`.");
    return 1;
  }
  for (const [rotulo, arquivo] of [
    ["next", NEXT_BIN],
    ["fixture", FIXTURE],
  ]) {
    if (!existsSync(arquivo)) {
      console.error(`Arquivo necessario nao encontrado (${rotulo}): ${arquivo}`);
      return 1;
    }
  }
  if (await portaAberta()) {
    console.error(`A porta ${PORTA} ja esta em uso; nada foi iniciado nem encerrado. Libere-a e tente de novo.`);
    return 1;
  }

  E.tmp = realpathSync.native(mkdtempSync(path.join(tmpdir(), "extrator-verificar-")));
  E.exportsDir = path.join(E.tmp, "exports");
  E.dbPath = path.join(E.tmp, "live.db");
  mkdirSync(E.exportsDir, { recursive: true });
  console.log(`Verificacao em servidor real: http://${HOST}:${PORTA} (producao), dados temporarios em pasta descartavel.`);

  try {
    await iniciarServidor({ rotulo: "A", modo: "lento", pidFile: novoPidFile("lento.pid"), timeoutMin: 30 });
    for (const [id, descricao, fn] of CHECKS_FASE_A) await rodar(id, descricao, fn);
    await pararServidor();

    await iniciarServidor({ rotulo: "B", modo: "arvore", pidFile: novoPidFile("arvore.pid"), timeoutMin: 0.03 });
    await rodar("PROC-2", "controle positivo da consulta na fase B: pai e neto de um fixture arvore vivos aparecem na lista; mortos, somem", checkControleArvore);
    await rodar("TMO-1", "timeout (~1,8 s): erro 'Tempo esgotado', pai e neto mortos, lock livre", checkTimeout);
    await pararServidor();

    await iniciarServidor({ rotulo: "C", modo: "arvore", pidFile: novoPidFile("arvore.pid"), timeoutMin: 30 });
    await rodar("ORF-1", "cancelar mata o neto desacoplado (orfao)", checkOrfao);
    await pararServidor();

    CONFIG_BOOT.pidFile = novoPidFile("boot.pid");
    await iniciarServidor({ rotulo: "boot-1", ...CONFIG_BOOT });
    await rodar("BOOT-1", "queda do servidor no meio de uma exportacao: ao reiniciar vira erro 'Interrompida' e o lock nao trava", checkBoot);
    await rodar("LEAK-1", "nenhum marcador secreto apareceu em qualquer resposta da execucao inteira", checkVazamento);
  } catch (erro) {
    E.resultados.push({ estado: "FAIL", id: "FATAL" });
    console.log(`FAIL  FATAL  ${erro instanceof Error ? erro.message : String(erro)}`);
  } finally {
    await pararServidor().catch(() => {});
    limpar();
  }

  await rodar("ERR-2", "no fim: nenhum fake-teams, porta 51795 livre, pasta temporaria removida (sem apagar o alvo da junction)", async (t) => {
    const lista = await esperarSemFakeTeams(5000);
    if (lista === null) t.pular("nao foi possivel consultar a lista de processos");
    else t.igual(lista.length, 0, "processos fake-teams restantes");
    const portaLivre = !(await portaAberta());
    t.ok(portaLivre, `a porta ${PORTA} continua aberta`);
    t.ok(!existsSync(E.tmp), `a pasta temporaria ainda existe: ${E.tmp}`);
    if (E.junction) t.ok(E.alvoDaJunctionIntacto === true, "o alvo da junction foi afetado pela limpeza");
    t.nota(
      `fake-teams=${lista?.length ?? "?"}; porta ${PORTA} livre=${portaLivre}; pasta removida=${!existsSync(E.tmp)}; alvo da junction preservado ate a remocao da pasta=${E.alvoDaJunctionIntacto ?? "n/a"}`
    );
  });

  const conta = (estado) => E.resultados.filter((r) => r.estado === estado).length;
  console.log(`\nResumo: ${conta("PASS")} PASS, ${conta("FAIL")} FAIL, ${conta("SKIP")} SKIP`);
  const puladas = E.resultados.filter((r) => r.estado === "SKIP").map((r) => r.id);
  if (puladas.length) console.log(`Pulados: ${puladas.join(", ")}`);
  // SKIP de um check inteiro = algo NAO foi provado (ex.: a consulta de processos falhou): nao sai com 0. So os sub-casos
  // com limitacao conhecida (ex.: NUL nao sobrevive ao SQLite) sao tolerados.
  const naoProvados = E.resultados.filter((r) => r.estado === "SKIP" && !r.tolerado).length;
  if (naoProvados) console.log(`${naoProvados} check(s) nao provado(s) (SKIP): saindo com codigo 2.`);
  return conta("FAIL") > 0 ? 1 : naoProvados ? 2 : 0;
}

for (const sinal of ["SIGINT", "SIGTERM"]) {
  process.on(sinal, () => {
    limpar();
    process.exit(130);
  });
}
process.on("exit", limpar);

principal().then(
  (codigo) => process.exit(codigo),
  (erro) => {
    console.error(erro);
    limpar();
    process.exit(1);
  }
);
