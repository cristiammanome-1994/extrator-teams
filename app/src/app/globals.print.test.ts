import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(path.join(import.meta.dirname, "globals.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

/**
 * Separa o `@media print { ... }` de verdade (o início de linha exclui menções em comentário), por
 * contagem de chaves, do resto do CSS.
 */
function separarImpressao(texto: string): { dentro: string; fora: string } {
  const abertura = /^@media print\s*\{/m.exec(texto);
  if (!abertura) return { dentro: "", fora: texto };
  let nivel = 1;
  let i = abertura.index + abertura[0].length;
  const inicio = i;
  for (; i < texto.length && nivel > 0; i++) {
    if (texto[i] === "{") nivel++;
    else if (texto[i] === "}") nivel--;
  }
  return { dentro: texto.slice(inicio, i - 1), fora: texto.slice(0, abertura.index) + texto.slice(i) };
}

const { dentro: impressao, fora: foraDoMedia } = separarImpressao(css);

/** Corpo da regra cujo seletor contém `seletor`, procurada só FORA do @media print (o preparo roda na mídia de tela). */
function corpoDaRegra(seletor: string): string {
  const escapado = seletor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`${escapado}[^{}]*\\{([^}]*)\\}`).exec(foraDoMedia)?.[1] ?? "";
}

describe("preparo da impressão: o Recharts mede no layout que a folha vai ter", () => {
  // O BotaoPdf estreita a página e o Recharts mede ainda na mídia de tela; na impressão ele não remede.
  // Na tela (viewport largo) as grades de gráficos ficam em 2 colunas (`lg:`), na folha (~703 px) em 1.
  // Sem forçar 1 coluna e o mesmo padding no preparo, o gráfico é desenhado estreito num cartão largo.
  it("força 1 coluna, que não cresce com o conteúdo, nas grades de gráficos", () => {
    // `minmax(0, 1fr)` e não `1fr`: um nome de autor longo esticaria a coluna acima dos 700 px.
    expect(corpoDaRegra(":root[data-preparando-impressao] [data-grade-graficos]")).toMatch(
      /grid-template-columns:\s*minmax\(0,\s*1fr\)\s*!important/
    );
  });

  it("zera o padding do main, como o @media print faz", () => {
    expect(corpoDaRegra(":root[data-preparando-impressao] main")).toMatch(/padding:\s*0\s*!important/);
  });

  it("as regras do preparo ficam fora do @media print (ele roda na mídia de tela)", () => {
    expect(impressao).not.toContain("data-preparando-impressao");
    expect(impressao).not.toContain("data-grade-graficos");
  });

  it("as duas grades de gráficos da Análise carregam data-grade-graficos", () => {
    const tsx = readFileSync(path.join(import.meta.dirname, "..", "components", "analise", "analise-view.tsx"), "utf8");
    // Só atributo JSX (`<div data-grade-graficos`): um comentário com a palavra não conta.
    expect(tsx.match(/<div\s+data-grade-graficos\b/g)).toHaveLength(2);
  });
});

describe("CSS de impressão (globals.css)", () => {
  it("acha o bloco @media print de verdade", () => {
    expect(impressao).toContain("data-sem-impressao");
    expect(impressao).toContain("@page");
  });

  it("não limita a largura do gráfico (svg, .recharts-*) na impressão", () => {
    // `max-width: 100% !important` em svg/.recharts-* colapsava o wrapper a 0 px na impressão e os
    // gráficos saíam em branco no PDF. Cobre também `max-inline-size`, o equivalente lógico.
    const regrasDeGrafico = [...impressao.matchAll(/([^{}]*(?:\bsvg\b|\.recharts-[\w-]+)[^{}]*)\{([^}]*)\}/g)]
      .filter(([, , corpo]) => /max-width|max-inline-size/.test(corpo))
      .map(([, seletor]) => seletor.trim().replace(/\s+/g, " "));
    expect(regrasDeGrafico).toEqual([]);
  });
});
