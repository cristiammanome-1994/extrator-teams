"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Exportacao } from "@/types/dominio";
import { invalidarCache } from "./useRecursoRemoto";

const INTERVALO_MS = 2000;

/**
 * Lista de exportações, com polling de 2 s enquanto alguma está em andamento.
 * Usa fetch próprio e não o cache de `useRecursoRemoto`: o andamento muda a
 * cada poucos segundos e não pode ficar preso num cache.
 */
export function useExportacoes() {
  const [exportacoes, setExportacoes] = useState<Exportacao[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const recarregar = useCallback(async () => {
    try {
      const resposta = await fetch("/api/exportacoes");
      const corpo = await resposta.json();
      if (!resposta.ok) throw new Error(corpo?.error?.message ?? "Erro ao carregar as exportações.");
      setExportacoes(corpo.exportacoes as Exportacao[]);
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha de rede.");
    }
  }, []);

  useEffect(() => {
    // Carga inicial: o setState só acontece depois do await.
    async function carregarInicial() {
      await recarregar();
    }
    void carregarInicial();
  }, [recarregar]);

  const emAndamento = exportacoes?.some((e) => e.status === "em_andamento") ?? false;

  useEffect(() => {
    if (!emAndamento) return;
    const timer = setInterval(() => void recarregar(), INTERVALO_MS);
    return () => clearInterval(timer);
  }, [emAndamento, recarregar]);

  // Quando uma exportação termina, o que as outras telas têm em cache
  // (grupos, mensagens, análise) ficou velho.
  const estavaEmAndamento = useRef(false);
  useEffect(() => {
    if (estavaEmAndamento.current && !emAndamento) invalidarCache("/api/");
    estavaEmAndamento.current = emAndamento;
  }, [emAndamento]);

  return { exportacoes, erro, recarregar };
}
