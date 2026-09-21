"use client";

import { useState } from "react";
import { Check, Circle, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatarNumero } from "@/lib/formatacao";
import { cn } from "@/lib/utils";
import type { Exportacao } from "@/types/dominio";
import { ETAPAS, indiceDaEtapa } from "./etapas";

export function CardProgresso({ exportacao, onCancelada }: { exportacao: Exportacao; onCancelada: () => void }) {
  const [cancelando, setCancelando] = useState(false);
  const atual = indiceDaEtapa(exportacao.etapa);

  async function cancelar() {
    setCancelando(true);
    try {
      await fetch(`/api/exportacoes/${exportacao.id}/cancelar`, { method: "POST" });
      onCancelada();
    } finally {
      setCancelando(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-sm font-medium">Exportando: {exportacao.grupo}</CardTitle>
        <Button size="sm" variant="outline" onClick={cancelar} disabled={cancelando}>
          <X className="mr-1 size-3.5" />
          {cancelando ? "Cancelando..." : "Cancelar"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {exportacao.etapa === "aguardando_login" && (
          <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
            Faça o login do Teams na janela do Edge que abriu. Este painel continua sozinho quando o login for detectado.
          </p>
        )}

        <ol className="space-y-1.5">
          {ETAPAS.map((etapa, indice) => {
            const feita = indice < atual;
            const corrente = indice === atual;
            return (
              <li
                key={etapa.id}
                className={cn("flex items-center gap-2 text-sm", !feita && !corrente && "text-muted-foreground")}
                aria-current={corrente ? "step" : undefined}
              >
                {feita ? (
                  <Check className="size-4" style={{ color: "var(--status-good)" }} />
                ) : corrente ? (
                  <RefreshCw className="size-4 animate-spin" style={{ color: "var(--chart-1)" }} />
                ) : (
                  <Circle className="size-4" />
                )}
                <span className={cn(corrente && "font-medium")}>{etapa.rotulo}</span>
                {corrente && etapa.id === "lendo_historico" && (
                  <span className="text-muted-foreground tabular-nums">
                    — {formatarNumero(exportacao.contador)} mensagens até agora
                  </span>
                )}
              </li>
            );
          })}
        </ol>

        {exportacao.grupoAberto && (
          <p className="text-xs text-muted-foreground">Chat aberto no Teams: {exportacao.grupoAberto}</p>
        )}
      </CardContent>
    </Card>
  );
}
