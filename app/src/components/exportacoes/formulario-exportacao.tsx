"use client";

import { useState } from "react";
import { AlertTriangle, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { TAMANHO_MAXIMO_GRUPO } from "@/lib/validarGrupo";

export function FormularioExportacao({
  desabilitado,
  onIniciada,
}: {
  desabilitado: boolean;
  onIniciada: () => void;
}) {
  const [grupo, setGrupo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function exportar(evento: React.FormEvent) {
    evento.preventDefault();
    setEnviando(true);
    setErro(null);
    try {
      const resposta = await fetch("/api/exportacoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grupo }),
      });
      if (!resposta.ok) {
        const corpo = await resposta.json().catch(() => null);
        setErro(corpo?.error?.message ?? "Não foi possível iniciar a exportação.");
        return;
      }
      setGrupo("");
      onIniciada();
    } catch {
      setErro("Falha de rede. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Nova exportação</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <form onSubmit={exportar} className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={grupo}
            onChange={(e) => setGrupo(e.target.value)}
            placeholder="Nome do grupo, exatamente como aparece no Teams"
            aria-label="Nome do grupo"
            disabled={desabilitado}
            maxLength={TAMANHO_MAXIMO_GRUPO}
          />
          <Button type="submit" disabled={desabilitado || enviando || grupo.trim().length === 0}>
            <Download className="mr-1.5 size-4" />
            {enviando ? "Iniciando..." : "Exportar"}
          </Button>
        </form>

        {erro && (
          <p className="flex items-start gap-1.5 text-xs leading-tight" style={{ color: "var(--status-critical)" }} role="alert">
            <AlertTriangle className="mt-px size-3 shrink-0" />
            {erro}
          </p>
        )}

        <p className="text-xs text-muted-foreground">
          {desabilitado
            ? "Há uma exportação em andamento. Aguarde ou cancele para iniciar outra."
            : "Uma janela do Edge vai abrir. Se o Teams pedir login, entre nela e aguarde — o processo continua sozinho."}
        </p>
      </CardContent>
    </Card>
  );
}
