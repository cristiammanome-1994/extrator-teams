"use client";

import { useState } from "react";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { BotaoPdf } from "@/components/shared/botao-pdf";
import { LinkExportar } from "@/components/shared/link-exportar";
import { SelectNativo } from "@/components/shared/select-nativo";
import { SeletorGrupo } from "@/components/shared/seletor-grupo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useGrupos } from "@/hooks/useGrupos";
import { useRecursoRemoto } from "@/hooks/useRecursoRemoto";
import { selecionarDadosDoGrupo } from "@/lib/dadosDoGrupo";
import { partesDoRecorte } from "@/lib/formatacao";
import type { Kpis } from "@/lib/kpis";
import {
  ATALHOS_PERIODO,
  atalhoAtivo,
  contarFiltrosAnalise,
  PERIODO_VAZIO,
  periodoDoAtalho,
  type IdAtalhoPeriodo,
} from "@/lib/periodoAnalise";
import { cn } from "@/lib/utils";
import { GraficoPorDia } from "./grafico-por-dia";
import { GraficoPorHora } from "./grafico-por-hora";
import { GraficoPorSemana } from "./grafico-por-semana";
import { KpiCardsAnalise } from "./kpi-cards-analise";
import { RankingAutores } from "./ranking-autores";

const FILTROS_VAZIOS = { ...PERIODO_VAZIO, autor: "" };

export function AnaliseView() {
  const { grupos, erro: erroGrupos, carregando: carregandoGrupos } = useGrupos();
  const [grupoEscolhido, setGrupoEscolhido] = useState<number | null>(null);
  // O rascunho é o que se digita nas datas; o aplicado é o que vai para a URL. Autor e atalhos
  // aplicam na hora (não há o que "digitar"), e as datas só ao clicar em "Aplicar período".
  const [rascunho, setRascunho] = useState(FILTROS_VAZIOS);
  const [aplicado, setAplicado] = useState(FILTROS_VAZIOS);

  const grupoId = grupoEscolhido ?? grupos?.[0]?.id ?? null;
  let url: string | null = null;
  if (grupoId !== null) {
    const params = new URLSearchParams({ grupoId: String(grupoId) });
    if (aplicado.de) params.set("de", aplicado.de);
    if (aplicado.ate) params.set("ate", aplicado.ate);
    if (aplicado.autor) params.set("autor", aplicado.autor);
    url = `/api/analise?${params.toString()}`;
  }
  const { dados, erro, carregando, recarregar } = useRecursoRemoto<{ kpis: Kpis; autores: string[]; grupoId: number }>(
    url,
    { manterDadoAnterior: true }
  );

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

  const grupoAtual = grupos.find((g) => g.id === grupoId);
  // Atalhos contam a partir da última mensagem do grupo, não de hoje (ver periodoAnalise.ts).
  const ultimaData = grupoAtual?.ultima?.slice(0, 10) ?? null;
  const filtrosAtivos = contarFiltrosAnalise(aplicado, aplicado.autor);
  const atalhoDoPeriodo = atalhoAtivo(aplicado, ultimaData);

  function aplicarAtalho(id: IdAtalhoPeriodo) {
    const periodo = periodoDoAtalho(id, ultimaData);
    setRascunho((r) => ({ ...r, ...periodo }));
    setAplicado((a) => ({ ...a, ...periodo }));
  }

  function escolherAutor(autor: string) {
    setRascunho((r) => ({ ...r, autor }));
    setAplicado((a) => ({ ...a, autor }));
  }

  function limpar() {
    setRascunho(FILTROS_VAZIOS);
    setAplicado(FILTROS_VAZIOS);
  }

  // Período sem mensagens: nada a baixar nem a imprimir (a tela irmã, Conversas, também desabilita com total 0).
  const temDados = (dadosDoGrupo?.kpis.total ?? 0) > 0;
  const referenciaPdf = [grupoAtual?.nome, ...partesDoRecorte(aplicado)].filter(Boolean).join(" · ");
  // Mesmo recorte da tela: grupo, período e autor aplicados.
  const hrefExportar = url === null ? null : url.replace("/api/analise?", "/api/analise/exportar?");

  return (
    <div className="space-y-4">
      <form
        data-sem-impressao
        onSubmit={(e) => {
          e.preventDefault();
          setAplicado((a) => ({ ...a, de: rascunho.de, ate: rascunho.ate }));
        }}
        className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[2fr_1.3fr_1fr_1fr_auto]"
      >
        <SeletorGrupo
          grupos={grupos}
          valor={grupoId}
          onChange={(id) => {
            setGrupoEscolhido(id);
            limpar();
          }}
        />
        <SelectNativo aria-label="Autor" value={aplicado.autor} onChange={(e) => escolherAutor(e.target.value)}>
          <option value="">Todos os autores</option>
          {(dadosDoGrupo?.autores ?? []).map((autor) => (
            <option key={autor} value={autor}>
              {autor}
            </option>
          ))}
        </SelectNativo>
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

      <div data-sem-impressao className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Atalhos de período">
          {ATALHOS_PERIODO.map((a) => (
            <Button
              key={a.id}
              type="button"
              size="sm"
              variant={atalhoDoPeriodo === a.id ? "default" : "outline"}
              aria-pressed={atalhoDoPeriodo === a.id}
              disabled={a.dias !== null && !ultimaData}
              onClick={() => aplicarAtalho(a.id)}
            >
              {a.rotulo}
            </Button>
          ))}
          {filtrosAtivos > 0 && (
            <>
              <span className="px-1 text-xs text-muted-foreground" role="status">
                {filtrosAtivos} {filtrosAtivos === 1 ? "filtro ativo" : "filtros ativos"}
              </span>
              <Button type="button" size="sm" variant="ghost" onClick={limpar}>
                Limpar
              </Button>
            </>
          )}
        </div>
        <div className="flex gap-2">
          <LinkExportar
            href={hrefExportar}
            rotulo="Excel"
            titulo="Baixar em Excel (.xlsx) as tabelas por autor e por dia do recorte atual (grupo, período e autor)"
            desabilitado={!temDados}
          />
          <BotaoPdf titulo="Análise" referencia={referenciaPdf} desabilitado={!temDados} />
        </div>
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
          <div className="grid gap-4 lg:grid-cols-2">
            <GraficoPorHora porHora={dadosDoGrupo.kpis.porHora} />
            <GraficoPorSemana porDiaSemana={dadosDoGrupo.kpis.porDiaSemana} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
