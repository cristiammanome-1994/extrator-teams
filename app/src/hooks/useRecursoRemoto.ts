"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { CacheLru } from "./cacheLru";

export class ErroApi extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export async function buscarJson<T>(url: string): Promise<T> {
  const resposta = await fetch(url);
  const json = await resposta.json();
  if (!resposta.ok) {
    throw new ErroApi(json?.error?.code ?? "UNKNOWN", json?.error?.message ?? "Erro ao carregar dados.");
  }
  return json as T;
}

interface EntradaCache {
  dados?: unknown;
  erro?: ErroApi;
  carregando: boolean;
}

/**
 * Cache em nível de módulo, compartilhado por todos os componentes que pedem a
 * mesma URL. Evita refetch a cada navegação entre páginas (o snapshot do
 * workspace muda pouco e é caro de recalcular no servidor) e deduplica
 * chamadas concorrentes reaproveitando a promise em andamento.
 *
 * É um "external store" no sentido do React: os componentes se inscrevem via
 * useSyncExternalStore em vez de guardarem cópias em useState — assim o cache
 * é a única fonte de verdade e não há setState dentro de efeito.
 *
 * O cache é um LRU de tamanho fixo (ver `cacheLru.ts`): a chave é a URL inteira
 * com filtros, então sem evicção cada combinação virava entrada permanente.
 */

/**
 * Teto de entradas do cache de URLs. 40 cobre com folga o uso real — uma volta
 * inteira pelas 21 telas gera menos de 30 URLs distintas, e sobram ~10 para as
 * variações de filtro/página/ordenação da mesma tela — enquanto limita o pior
 * caso a 40 × 193 KB ≈ 7,7 MB em vez das dezenas de MB que a versão sem
 * evicção acumulava numa sessão longa.
 */
const LIMITE_CACHE_URLS = 40;
/**
 * Teto do `ultimoDadoPorEndpoint`. Menor porque a chave é o endpoint, não a URL
 * com filtros: são ~18 endpoints fixos, e o único que multiplica é
 * `/api/comercial/empresas/:id` (um por empresa visitada) — que era justamente
 * por onde este Map também crescia sem limite. Despejar aqui não perde dado:
 * no máximo a tela mostra o skeleton em vez do dado anterior enquanto busca.
 */
const LIMITE_ULTIMO_POR_ENDPOINT = 20;

const emAndamento = new Map<string, Promise<unknown>>();
/** Último resultado bem-sucedido por endpoint (parte da URL antes do "?"). */
const ultimoDadoPorEndpoint = new CacheLru<unknown>(LIMITE_ULTIMO_POR_ENDPOINT);
const ouvintes = new Set<() => void>();
/**
 * Um `recarregar` registrado por URL com componente montado no momento —
 * é o que permite `invalidarCache` disparar a busca de novo sozinho (ver
 * nota logo abaixo). Só guarda o mais recente por URL (não uma pilha): na
 * prática cada URL só tem um consumidor montado por vez neste app, e no
 * raro caso de dois ao mesmo tempo o pior cenário é uma busca duplicada —
 * inofensivo, sem justificar a complexidade de um registro por assinante.
 *
 * Também é o que diz ao LRU quais URLs estão na tela agora e portanto não
 * podem ser despejadas.
 */
const recarregarPorUrl = new Map<string, () => void>();

/**
 * Nunca despeje uma URL com busca em andamento (perderia a dedupe e o estado
 * "carregando" da promise viva) nem uma URL com componente montado exibindo-a:
 * sem a entrada, o `getSnapshot` voltaria a devolver ENTRADA_VAZIA e a tela
 * cairia num skeleton eterno — o efeito que dispara a busca só roda de novo
 * quando a URL muda, não quando o cache muda por fora.
 */
const cache = new CacheLru<EntradaCache>(
  LIMITE_CACHE_URLS,
  (url) => emAndamento.has(url) || recarregarPorUrl.has(url)
);

const ENTRADA_VAZIA: EntradaCache = { carregando: true };

function notificar() {
  for (const ouvinte of ouvintes) ouvinte();
}

function definirEntrada(url: string, entrada: EntradaCache) {
  cache.definir(url, entrada);
  notificar();
}

function endpointDe(url: string): string {
  const i = url.indexOf("?");
  return i === -1 ? url : url.slice(0, i);
}

function registrarRecarregar(url: string, fn: () => void): () => void {
  recarregarPorUrl.set(url, fn);
  return () => {
    if (recarregarPorUrl.get(url) === fn) recarregarPorUrl.delete(url);
  };
}

/**
 * Invalida tudo (ou só as URLs com o prefixo informado) e busca de novo
 * qualquer uma delas que tenha um componente montado agora — sem isso, só
 * limpar o cache deixava a tela "carregando" parada pra sempre: o efeito
 * que dispara a busca em `useRecursoRemoto` só roda de novo quando a URL
 * muda, não quando o cache muda por fora (ex.: outra aba/o botão
 * Sincronizar terminando). Antes disso o único jeito de ver o dado novo
 * era um reload de página inteira — que também zerava qualquer estado
 * local não guardado na URL (ex.: seleção manual em Consolidação).
 */
export function invalidarCache(prefixo?: string) {
  const urlsAfetadas: string[] = [];

  if (!prefixo) {
    urlsAfetadas.push(...cache.chaves());
    cache.limpar();
    emAndamento.clear();
    ultimoDadoPorEndpoint.limpar();
  } else {
    for (const chave of cache.chaves()) {
      if (chave.startsWith(prefixo)) {
        cache.apagar(chave);
        urlsAfetadas.push(chave);
      }
    }
    for (const chave of [...emAndamento.keys()]) {
      if (chave.startsWith(prefixo)) emAndamento.delete(chave);
    }
    for (const chave of ultimoDadoPorEndpoint.chaves()) {
      if (chave.startsWith(prefixo)) ultimoDadoPorEndpoint.apagar(chave);
    }
  }
  notificar();

  for (const url of urlsAfetadas) recarregarPorUrl.get(url)?.();
}

function iniciarBusca<T>(url: string, manterDadoAnterior: boolean): Promise<unknown> {
  const jaEmAndamento = emAndamento.get(url);
  if (jaEmAndamento) return jaEmAndamento;

  const endpoint = endpointDe(url);
  let anterior: unknown;
  if (manterDadoAnterior) {
    // Buscar de novo o mesmo endpoint conta como uso: promove a entrada para
    // que ela não seja despejada só porque esta requisição demorou ou falhou.
    ultimoDadoPorEndpoint.tocar(endpoint);
    anterior = ultimoDadoPorEndpoint.espiar(endpoint);
  }
  definirEntrada(url, { dados: anterior, carregando: true });

  const promessa = buscarJson<T>(url)
    .then((dados) => {
      ultimoDadoPorEndpoint.definir(endpoint, dados);
      definirEntrada(url, { dados, carregando: false });
      return dados as unknown;
    })
    .catch((e) => {
      definirEntrada(url, { erro: e as ErroApi, carregando: false });
      return undefined;
    })
    .finally(() => {
      emAndamento.delete(url);
    });

  emAndamento.set(url, promessa);
  return promessa;
}

function inscrever(ouvinte: () => void) {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

interface OpcoesRecurso {
  /** Mantém o dado anterior visível enquanto busca o novo (evita piscar a tela ao paginar). */
  manterDadoAnterior?: boolean;
}

/**
 * Busca `url` com cache de módulo. `recarregar` é estável (depende só de `url`),
 * seguro para entrar em array de dependência de efeito sem causar refetch em loop.
 */
export function useRecursoRemoto<T>(url: string | null, opcoes: OpcoesRecurso = {}) {
  const { manterDadoAnterior = false } = opcoes;

  // `espiar` e não uma leitura que promove: getSnapshot roda no render e a cada
  // notificação; reordenar o LRU ali seria efeito colateral no render. A
  // promoção fica no efeito abaixo, que é onde "esta URL está sendo usada"
  // realmente acontece.
  const entrada = useSyncExternalStore(
    inscrever,
    () => (url ? (cache.espiar(url) ?? ENTRADA_VAZIA) : ENTRADA_VAZIA),
    () => ENTRADA_VAZIA
  );

  useEffect(() => {
    if (!url) return;
    if (cache.tem(url)) {
      cache.tocar(url);
      return;
    }
    void iniciarBusca<T>(url, manterDadoAnterior);
  }, [url, manterDadoAnterior]);

  const recarregar = useCallback(async () => {
    if (!url) return;
    cache.apagar(url);
    emAndamento.delete(url);
    await iniciarBusca<T>(url, true);
  }, [url]);

  useEffect(() => {
    if (!url) return;
    return registrarRecarregar(url, () => void recarregar());
  }, [url, recarregar]);

  return {
    dados: entrada.dados as T | undefined,
    erro: entrada.erro,
    carregando: entrada.carregando,
    recarregar,
  };
}
