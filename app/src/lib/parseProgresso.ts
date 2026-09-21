import type { EtapaExportacao } from "@/types/dominio";

export interface EventoProgresso {
  etapa?: EtapaExportacao;
  contador?: number;
  grupoAberto?: string;
  arquivoTxt?: string;
}

/**
 * Converte uma linha da saída do `teams_chat_export.py` num evento de
 * progresso. Linhas desconhecidas devolvem `null` — só entram no log.
 */
export function interpretarLinha(linha: string): EventoProgresso | null {
  const l = linha.trim();
  if (!l) return null;

  if (l.startsWith(">> Uma janela do navegador foi aberta")) return { etapa: "aguardando_login" };
  if (l.startsWith(">> Login detectado")) return { etapa: "login_concluido" };
  if (l.startsWith(">> Procurando o grupo/chat")) return { etapa: "procurando_grupo" };
  if (l.startsWith(">> Lendo o histórico")) return { etapa: "lendo_historico" };

  const aberto = /^>> Abrindo: "(.*)"$/u.exec(l);
  if (aberto) return { etapa: "grupo_aberto", grupoAberto: aberto[1] };

  const parcial = /^\.\.\. (\d+) mensagens únicas encontradas/u.exec(l);
  if (parcial) return { contador: Number(parcial[1]) };

  const total = /^>> Total de mensagens únicas capturadas: (\d+)/u.exec(l);
  if (total) return { contador: Number(total[1]) };

  const pronto = /^>> Pronto! Arquivo salvo em: (.+)$/u.exec(l);
  if (pronto) return { etapa: "salvando", arquivoTxt: pronto[1] };

  return null;
}
