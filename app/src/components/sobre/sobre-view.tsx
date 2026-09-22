import { Users } from "lucide-react";
import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";

const PASSOS: { titulo: string; texto: string }[] = [
  {
    titulo: "Exportações",
    texto:
      'Digite o nome do grupo exatamente como aparece no Teams e clique em Exportar. Uma janela do Edge abre; se o Teams pedir login, entre nela e aguarde — o painel continua sozinho.',
  },
  {
    titulo: "Conversas",
    texto: "Escolha o grupo, filtre por autor, período ou texto, e leia as mensagens em ordem cronológica.",
  },
  {
    titulo: "Análise",
    texto: "Total de mensagens, autores, período coberto, média por dia e o gráfico de mensagens por dia.",
  },
  {
    titulo: "Importar .txt antigo",
    texto: "Já tem um export antigo salvo? Importe o .txt direto, sem precisar exportar de novo.",
  },
];

const LEMBRETES: string[] = [
  "Os dados ficam nesta máquina, num banco SQLite local — nada sai daqui.",
  'Mensagens com reação podem vir com um texto extra colado no fim, tipo "1 Curtir reação." — é o próprio Teams que embute isso.',
  "Se a data de uma mensagem não puder ser interpretada, ela aparece com o texto original do Teams e fica fora dos gráficos por dia.",
  "Uma exportação por vez: o navegador que faz a leitura do Teams só aceita uma janela logada.",
  "Se o servidor for encerrado à força no meio de uma exportação, a janela do Edge pode continuar aberta — feche-a manualmente antes da próxima exportação.",
  "Excluir um item do histórico apaga também as mensagens que aquela execução trouxe.",
];

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold tracking-tight">{titulo}</h2>
      {children}
    </section>
  );
}

/** Para que serve o Extrator Teams e como usá-lo, em poucas linhas e sem termos técnicos. */
export function SobreView() {
  return (
    <div className="max-w-3xl space-y-8">
      <Secao titulo="Para que serve">
        <p className="text-sm leading-relaxed text-muted-foreground">
          O Extrator Teams exporta o histórico de um chat ou grupo do Microsoft Teams para um arquivo{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">.txt</code>, guarda as mensagens num banco local e
          deixa ler, filtrar e analisar tudo por aqui — sem precisar copiar mensagem por mensagem no Teams.
        </p>
      </Secao>

      <Secao titulo="Como usar">
        <Card className="gap-0 py-0">
          <ol className="divide-y">
            {PASSOS.map((p, i) => (
              <li key={p.titulo} className="flex items-baseline gap-3 px-5 py-3 text-sm">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold tabular-nums text-primary-foreground">
                  {i + 1}
                </span>
                <span>
                  <strong className="font-semibold">{p.titulo}.</strong>{" "}
                  <span className="text-muted-foreground">{p.texto}</span>
                </span>
              </li>
            ))}
          </ol>
        </Card>
      </Secao>

      <Secao titulo="Bom saber">
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
          {LEMBRETES.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </Secao>

      <Secao titulo="Créditos">
        <Card>
          <CardContent className="flex items-start gap-3 pt-4">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Users className="size-4" aria-hidden />
            </span>
            <p className="text-sm leading-relaxed text-muted-foreground">
              <strong className="font-semibold text-foreground">Extrator Teams</strong> foi idealizado e desenvolvido
              por <strong className="font-semibold text-foreground">Cristiam Hideyuki Ieda Manome</strong>, com o
              Claude Code.
            </p>
          </CardContent>
        </Card>
      </Secao>
    </div>
  );
}
