"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { SelectNativo } from "@/components/shared/select-nativo";
import { SeletorGrupo } from "@/components/shared/seletor-grupo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useGrupos } from "@/hooks/useGrupos";
import { useRecursoRemoto } from "@/hooks/useRecursoRemoto";
import { selecionarDadosDoGrupo } from "@/lib/dadosDoGrupo";
import { formatarNumero } from "@/lib/formatacao";
import { cn } from "@/lib/utils";
import type { Mensagem } from "@/types/dominio";
import { LinhaMensagem } from "./linha-mensagem";

interface RespostaMensagens {
  itens: Mensagem[];
  total: number;
  pagina: number;
  porPagina: number;
  autores: string[];
  grupoId: number;
}

const FILTROS_VAZIOS = { autor: "", de: "", ate: "", q: "" };

function montarQuery(grupoId: number, filtros: typeof FILTROS_VAZIOS, pagina: number): string {
  const params = new URLSearchParams({ grupoId: String(grupoId), pagina: String(pagina) });
  if (filtros.autor) params.set("autor", filtros.autor);
  if (filtros.de) params.set("de", filtros.de);
  if (filtros.ate) params.set("ate", filtros.ate);
  if (filtros.q.trim()) params.set("q", filtros.q.trim());
  return params.toString();
}

export function ConversasView() {
  const { grupos, erro: erroGrupos, carregando: carregandoGrupos } = useGrupos();
  const [grupoEscolhido, setGrupoEscolhido] = useState<number | null>(null);
  // O rascunho é o que se digita; o aplicado é o que vai para a URL. Assim
  // digitar não dispara uma busca por tecla.
  const [rascunho, setRascunho] = useState(FILTROS_VAZIOS);
  const [aplicado, setAplicado] = useState(FILTROS_VAZIOS);
  const [pagina, setPagina] = useState(1);

  const grupoId = grupoEscolhido ?? grupos?.[0]?.id ?? null;
  const url = grupoId === null ? null : `/api/mensagens?${montarQuery(grupoId, aplicado, pagina)}`;
  const { dados, erro, carregando, recarregar } = useRecursoRemoto<RespostaMensagens>(url, {
    manterDadoAnterior: true,
  });

  // Logo após trocar de grupo o cache ainda devolve o último dado do endpoint, que é do grupo anterior.
  const dadosDoGrupo = selecionarDadosDoGrupo(dados, grupoId);

  function trocarGrupo(id: number) {
    setGrupoEscolhido(id);
    setRascunho(FILTROS_VAZIOS);
    setAplicado(FILTROS_VAZIOS);
    setPagina(1);
  }

  function filtrar(evento: React.FormEvent) {
    evento.preventDefault();
    setAplicado(rascunho);
    setPagina(1);
  }

  function limpar() {
    setRascunho(FILTROS_VAZIOS);
    setAplicado(FILTROS_VAZIOS);
    setPagina(1);
  }

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

  const totalPaginas = dadosDoGrupo ? Math.max(1, Math.ceil(dadosDoGrupo.total / dadosDoGrupo.porPagina)) : 1;

  return (
    <div className="space-y-4">
      <form onSubmit={filtrar} className="grid gap-2 md:grid-cols-[2fr_1fr_1fr_1fr_2fr_auto]">
        <SeletorGrupo grupos={grupos} valor={grupoId} onChange={trocarGrupo} />
        <SelectNativo
          aria-label="Autor"
          value={rascunho.autor}
          onChange={(e) => setRascunho({ ...rascunho, autor: e.target.value })}
        >
          <option value="">Todos os autores</option>
          {(dadosDoGrupo?.autores ?? []).map((autor) => (
            <option key={autor} value={autor}>
              {autor}
            </option>
          ))}
        </SelectNativo>
        <Input type="date" aria-label="De" value={rascunho.de} onChange={(e) => setRascunho({ ...rascunho, de: e.target.value })} />
        <Input type="date" aria-label="Até" value={rascunho.ate} onChange={(e) => setRascunho({ ...rascunho, ate: e.target.value })} />
        <Input
          aria-label="Buscar no texto"
          placeholder="Buscar no texto"
          value={rascunho.q}
          onChange={(e) => setRascunho({ ...rascunho, q: e.target.value })}
        />
        <div className="flex gap-1">
          <Button type="submit">
            <Search className="mr-1 size-4" />
            Filtrar
          </Button>
          <Button type="button" variant="ghost" size="icon" onClick={limpar} aria-label="Limpar filtros" title="Limpar filtros">
            <X className="size-4" />
          </Button>
        </div>
      </form>

      {erro && <ErrorState message={erro.message} onRetry={() => void recarregar()} />}

      <Card aria-busy={carregando} className={cn(carregando && dadosDoGrupo && "opacity-60 transition-opacity")}>
        <CardContent className="pt-4">
          {carregando && !dadosDoGrupo ? (
            <Skeleton className="h-64 w-full" />
          ) : dadosDoGrupo && dadosDoGrupo.itens.length === 0 ? (
            <EmptyState title="Nenhuma mensagem com esses filtros" />
          ) : dadosDoGrupo ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-40">Data e hora</TableHead>
                  <TableHead className="w-56">Autor</TableHead>
                  <TableHead>Mensagem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dadosDoGrupo.itens.map((m) => (
                  <LinhaMensagem key={m.id} mensagem={m} />
                ))}
              </TableBody>
            </Table>
          ) : null}
        </CardContent>
      </Card>

      {dadosDoGrupo && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{formatarNumero(dadosDoGrupo.total)} mensagens</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setPagina(pagina - 1)} disabled={pagina <= 1}>
              <ChevronLeft className="size-4" />
              Anterior
            </Button>
            <span className="tabular-nums">
              Página {pagina} de {totalPaginas}
            </span>
            <Button size="sm" variant="outline" onClick={() => setPagina(pagina + 1)} disabled={pagina >= totalPaginas}>
              Próxima
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
