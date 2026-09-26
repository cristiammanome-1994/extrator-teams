"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { EIXO, PROPS_TOOLTIP, TICK } from "@/components/charts/eixo";
import { EmptyState } from "@/components/states/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { rotuloHora, rotuloIntervaloHora } from "@/lib/formatacao";
import type { Kpis } from "@/lib/kpis";

export function GraficoPorHora({ porHora }: { porHora: Kpis["porHora"] }) {
  const vazio = porHora.every((h) => h.total === 0);

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
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={porHora}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                <XAxis {...EIXO} dataKey="hora" tickFormatter={(hora) => rotuloHora(Number(hora))} interval={1} tick={{ ...TICK, fontSize: 11 }} />
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
