import { Bug, Sparkles, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatarDia } from "@/lib/formatacao";
import { changelogOrdenado, ROTULO_CATEGORIA, type CategoriaAtualizacao } from "@/lib/changelog";

const ICONE_CATEGORIA: Record<CategoriaAtualizacao, typeof Sparkles> = {
  novidade: Sparkles,
  melhoria: Wrench,
  correcao: Bug,
};

const COR_CATEGORIA: Record<CategoriaAtualizacao, string> = {
  novidade: "var(--status-good)",
  melhoria: "var(--chart-1)",
  correcao: "var(--status-warning)",
};

/** Lista de atualizações, da mais recente para a mais antiga. A ordenação vive em `@/lib/changelog`. */
export function ChangelogView() {
  const entradas = changelogOrdenado();

  return (
    <div className="space-y-3">
      {entradas.map((entrada, indice) => {
        const Icone = ICONE_CATEGORIA[entrada.categoria];
        const cor = COR_CATEGORIA[entrada.categoria];
        return (
          <Card key={indice}>
            <CardContent className="flex items-start gap-3 pt-4">
              <span
                aria-hidden
                className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg"
                style={{ background: `color-mix(in oklch, ${cor} 15%, transparent)`, color: cor }}
              >
                <Icone className="size-4" />
              </span>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">{entrada.titulo}</p>
                  <Badge variant="outline" className="text-[10px]" style={{ borderColor: cor, color: cor }}>
                    {ROTULO_CATEGORIA[entrada.categoria]}
                  </Badge>
                </div>
                <time dateTime={entrada.data} className="block text-xs text-muted-foreground">
                  {formatarDia(entrada.data)}
                </time>
                <p className="text-sm leading-relaxed text-muted-foreground">{entrada.descricao}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
