"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { EIXO, PROPS_TOOLTIP, TICK } from "@/components/charts/eixo";
import { EmptyState } from "@/components/states/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { rotuloHora, rotuloIntervaloHora } from "@/lib/formatacao";
import type { Kpis } from "@/lib/kpis";

/**
 * Abaixo desta largura do gráfico, 24 rótulos `00h` lado a lado se sobrepõem. Medido no navegador: com o
 * gráfico a 736 px o rótulo tem 21 px e sobra 8 px entre um e outro (~29 px por hora), então a 640 px
 * sobram ~4 px. Abaixo disso os rótulos giram; acima, ficam na horizontal.
 */
const LARGURA_MINIMA_ROTULOS_RETOS = 640;

export function GraficoPorHora({ porHora }: { porHora: Kpis["porHora"] }) {
  const vazio = porHora.every((h) => h.total === 0);
  const [estreito, setEstreito] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Mensagens por hora do dia</CardTitle>
      </CardHeader>
      <CardContent>
        {vazio ? (
          <EmptyState title="Nenhuma mensagem no período" description="Ajuste o período ou o autor." />
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%" onResize={(largura) => setEstreito(largura < LARGURA_MINIMA_ROTULOS_RETOS)}>
              <BarChart data={porHora}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                <XAxis
                  {...EIXO}
                  dataKey="hora"
                  tickFormatter={(hora) => rotuloHora(Number(hora))}
                  interval={0}
                  angle={estreito ? -90 : 0}
                  textAnchor={estreito ? "end" : "middle"}
                  height={estreito ? 40 : 30}
                  tick={{ ...TICK, fontSize: 11 }}
                />
                <YAxis {...EIXO} allowDecimals={false} width={36} tick={{ ...TICK, fontSize: 11 }} />
                <Tooltip
                  {...PROPS_TOOLTIP}
                  labelFormatter={(hora) => rotuloIntervaloHora(Number(hora))}
                  formatter={(valor) => [String(valor), "Mensagens"]}
                />
                <Bar dataKey="total" fill="var(--chart-2)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
