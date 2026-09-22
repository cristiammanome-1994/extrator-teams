// Simula teams_chat_export.py: imprime as mesmas linhas de progresso e grava o --json-out.
// Modo (env FAKE_MODO): "sucesso" (padrão), "erro" (sai com código 1),
// "lento" (grava o próprio pid em FAKE_PID_FILE, se definido, e dorme 60 s),
// "neto-pipe" / "neto-pipe-erro" (deixam um neto vivo segurando stdout/stderr e saem com código 0 / 1;
// o pid do neto vai para o arquivo indicado em FAKE_PID_FILE),
// "arvore" (cria um neto DESACOPLADO, sem pipes, que dorme 60 s — o pid vai para FAKE_PID_FILE —
// e o próprio processo dorme 60 s),
// "sem-json" (sai com código 0 sem gravar o --json-out),
// "json-invalido" (grava um JSON cuja lista "mensagens" não é uma lista).
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const dormir = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
if (process.env.FAKE_NETO) {
  await dormir(60_000);
  process.exit(0);
}

const args = process.argv.slice(2);
const grupo = args[0];
const saida = args[args.indexOf("--json-out") + 1];
// Se `--output` não for passado (chamador antigo), cai no caminho fixo de sempre: mantém o
// fixture compatível e faz com que a ausência do argumento continue visível nos testes.
const idxSaidaTxt = args.indexOf("--output");
const saidaTxt = idxSaidaTxt !== -1 ? args[idxSaidaTxt + 1] : "C:\\fake\\arquivo.txt";
const modo = process.env.FAKE_MODO ?? "sucesso";

console.log("\n>> Uma janela do navegador foi aberta.");
console.log(">> Login detectado, continuando...\n");
console.log(`>> Procurando o grupo/chat "${grupo}"...`);
console.log(`>> Abrindo: "${grupo}Ana, Bruno, +2"`);
console.log(">> Lendo o histórico da conversa (isso pode levar alguns minutos em grupos grandes)...");

if (modo === "lento") {
  if (process.env.FAKE_PID_FILE) writeFileSync(process.env.FAKE_PID_FILE, String(process.pid));
  await dormir(60_000);
}
if (modo === "arvore") {
  const neto = spawn(process.execPath, [fileURLToPath(import.meta.url)], {
    stdio: "ignore",
    detached: true, // fora do job do libuv, que mataria o neto junto com este processo
    env: { ...process.env, FAKE_NETO: "1" },
  });
  writeFileSync(process.env.FAKE_PID_FILE, String(neto.pid));
  neto.unref();
  await dormir(60_000);
}
if (modo === "neto-pipe" || modo === "neto-pipe-erro") {
  const neto = spawn(process.execPath, [fileURLToPath(import.meta.url)], {
    stdio: "inherit",
    detached: true, // fora do job do libuv, que mataria o neto junto com este processo
    env: { ...process.env, FAKE_NETO: "1" },
  });
  writeFileSync(process.env.FAKE_PID_FILE, String(neto.pid));
  neto.unref();
}
if (modo === "erro" || modo === "neto-pipe-erro") {
  console.error("RuntimeError: Nenhum resultado encontrado");
  process.exit(1);
}
if (modo === "sem-json") process.exit(0);

console.log("   ... 2 mensagens únicas encontradas até agora (iteração 10)");
console.log(">> Total de mensagens únicas capturadas: 2");
if (modo === "json-invalido") {
  writeFileSync(saida, JSON.stringify({ grupo: "X", mensagens: "nao-e-lista" }));
} else {
  writeFileSync(
    saida,
    JSON.stringify({
      grupo,
      exportado_em: "2026-09-21T09:23:00",
      mensagens: [
        { autor: "Ana", data_hora_original: "terça-feira, 8 de setembro de 2026 11:09", texto: "Primeira" },
        { autor: "Bruno", data_hora_original: "terça-feira, 8 de setembro de 2026 11:10", texto: "Segunda" },
      ],
    })
  );
}
console.log(`>> JSON salvo em: ${saida}`);
if (idxSaidaTxt !== -1) writeFileSync(saidaTxt, "conteudo fake do .txt\n");
console.log(`>> Pronto! Arquivo salvo em: ${saidaTxt}`);
