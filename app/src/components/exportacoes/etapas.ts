import type { EtapaExportacao } from "@/types/dominio";

/** Etapas visíveis do fluxo, na ordem em que o script as percorre. */
export const ETAPAS: { id: EtapaExportacao; rotulo: string }[] = [
  { id: "aguardando_login", rotulo: "Aguardando login no Teams" },
  { id: "login_concluido", rotulo: "Login concluído" },
  { id: "procurando_grupo", rotulo: "Procurando o grupo" },
  { id: "grupo_aberto", rotulo: "Grupo aberto" },
  { id: "lendo_historico", rotulo: "Lendo o histórico" },
  { id: "salvando", rotulo: "Salvando e importando" },
];

/** Posição da etapa em `ETAPAS`; `-1` para "iniciando" (ainda antes da primeira). */
export function indiceDaEtapa(etapa: EtapaExportacao): number {
  return ETAPAS.findIndex((e) => e.id === etapa);
}
