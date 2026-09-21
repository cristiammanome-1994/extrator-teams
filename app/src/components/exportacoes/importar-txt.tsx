"use client";

import { useState } from "react";
import { AlertTriangle, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { invalidarCache } from "@/hooks/useRecursoRemoto";

interface ResultadoImportacao {
  grupo: string;
  lidas: number;
  novas: number;
  totalDeclarado: number | null;
  divergencia: boolean;
}

export function ImportarTxt() {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [grupo, setGrupo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null);

  async function importar(evento: React.FormEvent) {
    evento.preventDefault();
    if (!arquivo) return;
    setEnviando(true);
    setErro(null);
    setResultado(null);
    try {
      const formulario = new FormData();
      formulario.set("arquivo", arquivo);
      if (grupo.trim()) formulario.set("grupo", grupo.trim());
      const resposta = await fetch("/api/importar", { method: "POST", body: formulario });
      const corpo = await resposta.json().catch(() => null);
      if (!resposta.ok) {
        setErro(corpo?.error?.message ?? "Não foi possível importar o arquivo.");
        return;
      }
      setResultado(corpo as ResultadoImportacao);
      invalidarCache("/api/");
    } catch {
      setErro("Falha de rede. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Importar .txt antigo</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <form onSubmit={importar} className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            type="file"
            accept=".txt"
            aria-label="Arquivo .txt"
            onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
          />
          <Input
            value={grupo}
            onChange={(e) => setGrupo(e.target.value)}
            placeholder="Nome do grupo (só se o arquivo não tiver cabeçalho)"
            aria-label="Nome do grupo para importação"
          />
          <Button type="submit" variant="outline" disabled={!arquivo || enviando}>
            <Upload className="mr-1.5 size-4" />
            {enviando ? "Importando..." : "Importar"}
          </Button>
        </form>

        {erro && (
          <p className="flex items-start gap-1.5 text-xs leading-tight" style={{ color: "var(--status-critical)" }} role="alert">
            <AlertTriangle className="mt-px size-3 shrink-0" />
            {erro}
          </p>
        )}

        {resultado && (
          <div className="space-y-1 text-sm" role="status">
            <p>
              Importadas {resultado.novas} novas de {resultado.lidas} lidas no grupo “{resultado.grupo}”.
            </p>
            {resultado.divergencia && (
              <p className="text-xs" style={{ color: "var(--status-warning)" }}>
                O cabeçalho declara {resultado.totalDeclarado} mensagens, mas foram lidas {resultado.lidas}.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
