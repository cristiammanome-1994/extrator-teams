"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { EIXO, PROPS_TOOLTIP, TICK } from "@/components/charts/eixo";
import { EmptyState } from "@/components/states/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Kpis } from "@/lib/kpis";

/** "Segunda" → "Seg": cabe no eixo em tela estreita, e o tooltip mostra o nome inteiro. */
const abreviar = (dia: string) => dia.slice(0, 3);

export function GraficoPorSemana({ porDiaSemana }: { porDiaSemana: Kpis["porDiaSemana"] }) {
  const vazio = porDiaSemana.every((d) => d.total === 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Mensagens por dia da semana</CardTitle>
      </CardHeader>
      <CardContent>
        {vazio ? (
          <EmptyState title="Nenhuma mensagem no período" description="Ajuste o período ou o autor." />
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={porDiaSemana}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                <XAxis {...EIXO} dataKey="dia" tickFormatter={abreviar} tick={{ ...TICK, fontSize: 11 }} />
                <YAxis {...EIXO} allowDecimals={false} width={36} tick={{ ...TICK, fontSize: 11 }} />
                <Tooltip {...PROPS_TOOLTIP} formatter={(valor) => [String(valor), "Mensagens"]} />
                <Bar dataKey="total" fill="var(--chart-3)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
