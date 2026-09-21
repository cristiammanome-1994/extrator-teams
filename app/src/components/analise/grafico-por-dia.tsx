"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { EmptyState } from "@/components/states/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatarDia } from "@/lib/formatacao";
import type { Kpis } from "@/lib/kpis";

export function GraficoPorDia({ porDia }: { porDia: Kpis["porDia"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Mensagens por dia</CardTitle>
      </CardHeader>
      <CardContent>
        {porDia.length === 0 ? (
          <EmptyState title="Nenhuma mensagem no período" description="Ajuste o período ou escolha outro grupo." />
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={porDia}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="dia"
                  tickFormatter={formatarDia}
                  minTickGap={32}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  axisLine={{ stroke: "var(--border)" }}
                  tickLine={{ stroke: "var(--border)" }}
                />
                <YAxis
                  allowDecimals={false}
                  width={36}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  axisLine={{ stroke: "var(--border)" }}
                  tickLine={{ stroke: "var(--border)" }}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    color: "var(--popover-foreground)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                  }}
                  labelStyle={{ color: "var(--popover-foreground)" }}
                  itemStyle={{ color: "var(--popover-foreground)" }}
                  cursor={{ fill: "var(--muted)", opacity: 0.5 }}
                  labelFormatter={(dia) => formatarDia(String(dia))}
                  formatter={(valor) => [String(valor), "Mensagens"]}
                />
                <Bar dataKey="total" fill="var(--chart-1)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
