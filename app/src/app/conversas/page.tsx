import { ConversasView } from "@/components/conversas/conversas-view";

export default function ConversasPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Conversas</h1>
        <p className="text-sm text-muted-foreground">Leia, filtre e busque as mensagens dos grupos exportados.</p>
      </div>
      <ConversasView />
    </div>
  );
}
