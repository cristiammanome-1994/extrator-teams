import { AnaliseView } from "@/components/analise/analise-view";

export default function AnalisePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Análise</h1>
        <p className="text-sm text-muted-foreground">Volume de mensagens por dia e por autor em cada grupo.</p>
      </div>
      <AnaliseView />
    </div>
  );
}
