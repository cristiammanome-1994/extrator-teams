import { Card, CardContent } from "@/components/ui/card";
import { formatarDia, formatarNumero } from "@/lib/formatacao";
import type { Kpis } from "@/lib/kpis";

export function KpiCardsAnalise({ kpis }: { kpis: Kpis }) {
  const itens = [
    {
      rotulo: "Mensagens",
      valor: formatarNumero(kpis.total),
      detalhe: kpis.semData > 0 ? `${formatarNumero(kpis.semData)} sem data` : undefined,
    },
    { rotulo: "Autores", valor: formatarNumero(kpis.autores) },
    {
      rotulo: "Período",
      valor:
        kpis.primeiraData && kpis.ultimaData
          ? `${formatarDia(kpis.primeiraData)} a ${formatarDia(kpis.ultimaData)}`
          : "—",
      detalhe: kpis.dias > 0 ? `${formatarNumero(kpis.dias)} dias` : undefined,
    },
    { rotulo: "Média por dia", valor: kpis.mediaPorDia.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {itens.map((item) => (
        <Card key={item.rotulo}>
          <CardContent className="space-y-1 pt-4">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{item.rotulo}</p>
            <p className="text-xl font-semibold tabular-nums">{item.valor}</p>
            {item.detalhe && <p className="text-xs text-muted-foreground">{item.detalhe}</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
