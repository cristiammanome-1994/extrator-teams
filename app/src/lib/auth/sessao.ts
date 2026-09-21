/**
 * Sessão por senha única.
 *
 * O app expõe conversas corporativas e dispara um processo na máquina; uma
 * senha só, definida em `.env.local`, protege isso sem exigir cadastro de
 * usuários. Não há "usuário logado": o cookie só atesta que alguém sabia a
 * senha.
 *
 * Usa Web Crypto (`crypto.subtle`) e não `node:crypto`: este módulo é
 * carregado pelo proxy, que o Next pode executar fora do runtime Node.
 */

export const NOME_COOKIE_SESSAO = "extrator_sessao";

/** Uma semana: longo o bastante para não irritar, curto para um cookie vazado expirar. */
export const DURACAO_SESSAO_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * TextEncoder devolve `Uint8Array<ArrayBufferLike>`, que o tipo `BufferSource`
 * da Web Crypto não aceita — ele exige um ArrayBuffer concreto. A cópia
 * resolve o descasamento sem `any`.
 */
function codificar(texto: string): Uint8Array<ArrayBuffer> {
  const bytes = new TextEncoder().encode(texto);
  const copia = new Uint8Array(new ArrayBuffer(bytes.byteLength));
  copia.set(bytes);
  return copia;
}

function paraHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Segredo que assina o cookie. Cai para a própria senha quando
 * `EXTRATOR_SEGREDO_SESSAO` não está definido — assim o app funciona
 * configurando uma variável só; o efeito colateral é que trocar a senha
 * invalida as sessões abertas.
 */
function obterSegredo(): string {
  const segredo = process.env.EXTRATOR_SEGREDO_SESSAO || process.env.EXTRATOR_SENHA;
  if (!segredo) {
    throw new Error(
      "EXTRATOR_SENHA não está definida. Configure-a em app/.env.local (veja .env.example)."
    );
  }
  return segredo;
}

async function assinar(mensagem: string): Promise<string> {
  const chave = await crypto.subtle.importKey(
    "raw",
    codificar(obterSegredo()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return paraHex(await crypto.subtle.sign("HMAC", chave, codificar(mensagem)));
}

/**
 * Comparação em tempo constante: um `===` vaza, pelo tempo de resposta,
 * quantos caracteres iniciais estavam certos.
 */
function iguaisEmTempoConstante(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diferenca = 0;
  for (let i = 0; i < a.length; i++) diferenca |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diferenca === 0;
}

/** Valor do cookie: quando expira, mais a assinatura desse prazo. */
export async function criarValorSessao(agora = Date.now()): Promise<string> {
  const expiraEm = String(agora + DURACAO_SESSAO_MS);
  return `${expiraEm}.${await assinar(expiraEm)}`;
}

/** Cookie íntegro e dentro do prazo? */
export async function sessaoEhValida(valor: string | undefined, agora = Date.now()): Promise<boolean> {
  if (!valor) return false;
  const separador = valor.lastIndexOf(".");
  if (separador <= 0) return false;

  const expiraEm = valor.slice(0, separador);
  const assinatura = valor.slice(separador + 1);

  const prazo = Number(expiraEm);
  if (!Number.isFinite(prazo) || prazo <= agora) return false;

  return iguaisEmTempoConstante(assinatura, await assinar(expiraEm));
}

/** A senha informada confere? Também em tempo constante. */
export function senhaConfere(informada: string): boolean {
  const esperada = process.env.EXTRATOR_SENHA;
  if (!esperada) return false;
  return iguaisEmTempoConstante(informada, esperada);
}

/** Sem senha configurada o app não deve subir aberto por engano. */
export function autenticacaoConfigurada(): boolean {
  return Boolean(process.env.EXTRATOR_SENHA);
}
