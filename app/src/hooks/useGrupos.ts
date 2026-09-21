"use client";

import type { GrupoResumo } from "@/types/dominio";
import { useRecursoRemoto } from "./useRecursoRemoto";

export function useGrupos() {
  const { dados, erro, carregando } = useRecursoRemoto<{ grupos: GrupoResumo[] }>("/api/grupos");
  return { grupos: dados?.grupos, erro, carregando };
}
