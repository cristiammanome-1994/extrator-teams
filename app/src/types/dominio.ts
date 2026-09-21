export type StatusExportacao = "em_andamento" | "concluida" | "erro" | "cancelada";

export type EtapaExportacao =
  | "iniciando"
  | "aguardando_login"
  | "login_concluido"
  | "procurando_grupo"
  | "grupo_aberto"
  | "lendo_historico"
  | "salvando";

/** Mensagem como vem do Teams: a data ainda é o texto original. */
export interface MensagemBruta {
  autor: string;
  dataHoraOriginal: string;
  texto: string;
}

export interface MensagemParaInserir extends MensagemBruta {
  /** ISO local sem fuso (`YYYY-MM-DDTHH:MM`); nula quando o texto de data não é interpretável. */
  dataHora: string | null;
}

export interface Mensagem extends MensagemParaInserir {
  id: number;
  grupoId: number;
}

export interface Exportacao {
  id: number;
  grupo: string;
  grupoAberto: string | null;
  status: StatusExportacao;
  etapa: EtapaExportacao;
  contador: number;
  totalMensagens: number | null;
  iniciadaEm: string;
  finalizadaEm: string | null;
  arquivoTxt: string | null;
  arquivoJson: string | null;
  erroMsg: string | null;
  logTail: string;
}

export interface GrupoResumo {
  id: number;
  nome: string;
  total: number;
  primeira: string | null;
  ultima: string | null;
}

export interface FiltrosMensagens {
  grupoId: number;
  autor?: string;
  /** `YYYY-MM-DD`, inclusivo. */
  de?: string;
  /** `YYYY-MM-DD`, inclusivo. */
  ate?: string;
  texto?: string;
}

export interface LinhaKpi {
  autor: string;
  dataHora: string | null;
}
