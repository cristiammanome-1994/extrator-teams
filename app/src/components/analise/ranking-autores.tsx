import { EmptyState } from "@/components/states/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatarNumero } from "@/lib/formatacao";
import type { Kpis } from "@/lib/kpis";

export function RankingAutores({ porAutor }: { porAutor: Kpis["porAutor"] }) {
  const maximo = porAutor[0]?.total ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Autores</CardTitle>
      </CardHeader>
      <CardContent>
        {porAutor.length === 0 ? (
          <EmptyState title="Nenhum autor neste filtro" />
        ) : (
          <ol className="space-y-2">
            {porAutor.map((a) => (
              <li key={a.autor} className="space-y-1">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate font-medium" title={a.autor}>
                    {a.autor}
                  </span>
                  <span className="tabular-nums text-muted-foreground">{formatarNumero(a.total)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted">
                  <div
                    className="h-1.5 rounded-full"
                    style={{ width: `${(a.total / maximo) * 100}%`, background: "var(--chart-1)" }}
                  />
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
