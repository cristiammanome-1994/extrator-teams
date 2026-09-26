"use client";

import { useState } from "react";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { BotaoPdf } from "@/components/shared/botao-pdf";
import { LinkExportar } from "@/components/shared/link-exportar";
import { SeletorGrupo } from "@/components/shared/seletor-grupo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useGrupos } from "@/hooks/useGrupos";
import { useRecursoRemoto } from "@/hooks/useRecursoRemoto";
import { selecionarDadosDoGrupo } from "@/lib/dadosDoGrupo";
import type { Kpis } from "@/lib/kpis";
import { cn } from "@/lib/utils";
import { GraficoPorDia } from "./grafico-por-dia";
import { KpiCardsAnalise } from "./kpi-cards-analise";
import { RankingAutores } from "./ranking-autores";

const PERIODO_VAZIO = { de: "", ate: "" };

export function AnaliseView() {
  const { grupos, erro: erroGrupos, carregando: carregandoGrupos } = useGrupos();
  const [grupoEscolhido, setGrupoEscolhido] = useState<number | null>(null);
  const [rascunho, setRascunho] = useState(PERIODO_VAZIO);
  const [aplicado, setAplicado] = useState(PERIODO_VAZIO);

  const grupoId = grupoEscolhido ?? grupos?.[0]?.id ?? null;
  let url: string | null = null;
  if (grupoId !== null) {
    const params = new URLSearchParams({ grupoId: String(grupoId) });
    if (aplicado.de) params.set("de", aplicado.de);
    if (aplicado.ate) params.set("ate", aplicado.ate);
    url = `/api/analise?${params.toString()}`;
  }
  const { dados, erro, carregando, recarregar } = useRecursoRemoto<{ kpis: Kpis; grupoId: number }>(url, {
    manterDadoAnterior: true,
  });

  // Logo após trocar de grupo o cache ainda devolve o último dado do endpoint, que é do grupo anterior.
  const dadosDoGrupo = selecionarDadosDoGrupo(dados, grupoId);

  if (carregandoGrupos) return <Skeleton className="h-64 w-full" />;
  if (erroGrupos) return <ErrorState message={erroGrupos.message} />;
  if (!grupos || grupos.length === 0) {
    return (
      <EmptyState
        title="Nenhuma conversa ainda"
        description="Exporte um grupo do Teams ou importe um .txt na tela Exportações."
      />
    );
  }

  // Período sem mensagens: nada a baixar nem a imprimir (a tela irmã, Conversas, também desabilita com total 0).
  const temDados = (dadosDoGrupo?.kpis.total ?? 0) > 0;
  const grupoAtual = grupos.find((g) => g.id === grupoId);
  const periodo = [aplicado.de && `de ${aplicado.de}`, aplicado.ate && `até ${aplicado.ate}`].filter(Boolean).join(" ");
  const referenciaPdf = [grupoAtual?.nome, periodo].filter(Boolean).join(" · ");
  // Mesmo recorte da tela: grupo e período aplicados.
  const hrefExportar = url === null ? null : url.replace("/api/analise?", "/api/analise/exportar?");

  return (
    <div className="space-y-4">
      <form
        data-sem-impressao
        onSubmit={(e) => {
          e.preventDefault();
          setAplicado(rascunho);
        }}
        className="grid gap-2 md:grid-cols-[2fr_1fr_1fr_auto]"
      >
        <SeletorGrupo
          grupos={grupos}
          valor={grupoId}
          onChange={(id) => {
            setGrupoEscolhido(id);
            setRascunho(PERIODO_VAZIO);
            setAplicado(PERIODO_VAZIO);
          }}
        />
        <Input
          type="date"
          aria-label="De"
          max={rascunho.ate || undefined}
          value={rascunho.de}
          onChange={(e) => setRascunho({ ...rascunho, de: e.target.value })}
        />
        <Input
          type="date"
          aria-label="Até"
          min={rascunho.de || undefined}
          value={rascunho.ate}
          onChange={(e) => setRascunho({ ...rascunho, ate: e.target.value })}
        />
        <Button type="submit">Aplicar período</Button>
      </form>

      <div className="flex justify-end gap-2">
        <LinkExportar
          href={hrefExportar}
          rotulo="Excel"
          titulo="Baixar as tabelas por autor e por dia em Excel (.xlsx)"
          desabilitado={!temDados}
        />
        <BotaoPdf titulo="Análise" referencia={referenciaPdf} desabilitado={!temDados} />
      </div>

      {erro && <ErrorState message={erro.message} onRetry={() => void recarregar()} />}

      {carregando && !dadosDoGrupo ? (
        <Skeleton className="h-96 w-full" />
      ) : dadosDoGrupo ? (
        <div aria-busy={carregando} className={cn("space-y-4", carregando && "opacity-60 transition-opacity")}>
          <KpiCardsAnalise kpis={dadosDoGrupo.kpis} />
          <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
            <GraficoPorDia porDia={dadosDoGrupo.kpis.porDia} />
            <RankingAutores porAutor={dadosDoGrupo.kpis.porAutor} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
