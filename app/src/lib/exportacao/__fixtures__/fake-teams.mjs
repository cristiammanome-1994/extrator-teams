// Simula teams_chat_export.py: imprime as mesmas linhas de progresso e grava o --json-out.
// Modo (env FAKE_MODO): "sucesso" (padrão), "erro" (sai com código 1) ou "lento" (dorme 60 s).
import { writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const grupo = args[0];
const saida = args[args.indexOf("--json-out") + 1];
const modo = process.env.FAKE_MODO ?? "sucesso";
const dormir = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

console.log("\n>> Uma janela do navegador foi aberta.");
console.log(">> Login detectado, continuando...\n");
console.log(`>> Procurando o grupo/chat "${grupo}"...`);
console.log(`>> Abrindo: "${grupo}Ana, Bruno, +2"`);
console.log(">> Lendo o histórico da conversa (isso pode levar alguns minutos em grupos grandes)...");

if (modo === "lento") await dormir(60_000);
if (modo === "erro") {
  console.error("RuntimeError: Nenhum resultado encontrado");
  process.exit(1);
}

console.log("   ... 2 mensagens únicas encontradas até agora (iteração 10)");
console.log(">> Total de mensagens únicas capturadas: 2");
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
console.log(`>> JSON salvo em: ${saida}`);
console.log(">> Pronto! Arquivo salvo em: C:\\fake\\arquivo.txt");
