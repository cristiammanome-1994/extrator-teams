/**
 * Limite de tentativas de login.
 *
 * O app só escuta em 127.0.0.1, então há uma única "origem" (`ORIGEM_LOCAL`).
 * Mesmo assim o bloqueio existe: encarece a varredura de senhas caso a porta
 * seja exposta na rede por engano.
 *
 * Só falhas contam, um login bem-sucedido zera o contador, e a janela expira
 * sozinha — nunca existe um estado "bloqueado" que alguém precise destravar.
 * O estado vive em memória: reiniciar o servidor zera tudo.
 */

export const MAX_TENTATIVAS = 10;
export const JANELA_MS = 5 * 60 * 1000;
export const ORIGEM_LOCAL = "local";

interface Registro {
  falhas: number;
  /** Quando a janela desta origem expira. */
  expiraEm: number;
}

const porOrigem = new Map<string, Registro>();

export interface ResultadoLimite {
  bloqueado: boolean;
  /** Quantas tentativas ainda restam antes de bloquear. */
  restantes: number;
  /** Segundos até a janela liberar; 0 quando não está bloqueado. */
  segundosParaLiberar: number;
}

/** A origem está liberada para tentar? Não altera o contador. */
export function verificarLimite(origem: string, agora = Date.now()): ResultadoLimite {
  const registro = porOrigem.get(origem);
  if (!registro || registro.expiraEm <= agora) {
    return { bloqueado: false, restantes: MAX_TENTATIVAS, segundosParaLiberar: 0 };
  }

  const bloqueado = registro.falhas >= MAX_TENTATIVAS;
  return {
    bloqueado,
    restantes: Math.max(0, MAX_TENTATIVAS - registro.falhas),
    segundosParaLiberar: bloqueado ? Math.ceil((registro.expiraEm - agora) / 1000) : 0,
  };
}

/** Conta uma falha; a janela é renovada a cada falha. */
export function registrarFalha(origem: string, agora = Date.now()): ResultadoLimite {
  const registro = porOrigem.get(origem);
  const falhas = registro && registro.expiraEm > agora ? registro.falhas + 1 : 1;
  porOrigem.set(origem, { falhas, expiraEm: agora + JANELA_MS });
  return verificarLimite(origem, agora);
}

/** Login aceito: a origem volta à estaca zero. */
export function registrarSucesso(origem: string): void {
  porOrigem.delete(origem);
}

/** Só para os testes: devolve o módulo ao estado inicial. */
export function limparTudo(): void {
  porOrigem.clear();
}
