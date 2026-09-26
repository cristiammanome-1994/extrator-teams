/**
 * Estilo compartilhado dos gráficos Recharts da Análise, para o tema claro/escuro valer neles.
 *
 * O Recharts desenha `stroke="#666"` como atributo de apresentação na linha do eixo e nos
 * tracinhos, e pinta o texto do tick com o mesmo cinza fixo: nenhum dos três segue o tema. Uma
 * classe do Tailwind entra pela cascata do CSS e vence o atributo de apresentação, então é ela
 * que colore o eixo. (Adaptado do `charts/eixo.ts` do Click Up.)
 */

/** Vai em `{...EIXO}` no XAxis/YAxis: pinta a linha do eixo e os tracinhos. */
export const EIXO = {
  axisLine: { className: "stroke-border" },
  tickLine: { className: "stroke-border" },
} as const;

/**
 * Vai em `tick={{ ...TICK, fontSize: N }}`: pinta o texto do rótulo. Separado de `EIXO` porque a
 * prop `tick` do Recharts é uma união que aceita também `boolean` e elemento React, e espalhar a
 * partir dela não compila.
 */
export const TICK = { className: "fill-muted-foreground" } as const;

/** Props do `<Tooltip>`: fundo, texto e cursor no tema (o padrão do Recharts é branco no escuro). */
export const PROPS_TOOLTIP = {
  contentStyle: {
    background: "var(--popover)",
    color: "var(--popover-foreground)",
    border: "1px solid var(--border)",
    borderRadius: 8,
  },
  labelStyle: { color: "var(--popover-foreground)" },
  itemStyle: { color: "var(--popover-foreground)" },
  cursor: { fill: "var(--muted)", opacity: 0.5 },
} as const;
