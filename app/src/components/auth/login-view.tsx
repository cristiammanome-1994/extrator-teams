"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Download, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { destinoSeguro } from "@/lib/auth/destino";

export function LoginView() {
  const router = useRouter();
  const parametros = useSearchParams();
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function entrar(evento: React.FormEvent) {
    evento.preventDefault();
    setEnviando(true);
    setErro(null);
    try {
      const resposta = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senha }),
      });
      if (!resposta.ok) {
        const corpo = await resposta.json().catch(() => null);
        setErro(corpo?.error?.message ?? "Não foi possível entrar.");
        return;
      }
      // `de` vem do proxy, mas qualquer um pode forjar o link de login; o
      // destino é validado (URL parseada, mesma origem) para o parâmetro não
      // virar um redirecionamento aberto para fora do app.
      router.replace(destinoSeguro(parametros.get("de"), window.location.origin));
      router.refresh();
    } catch {
      setErro("Falha de rede. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardContent className="space-y-6 pt-6">
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="flex size-10 items-center justify-center rounded bg-primary text-primary-foreground">
              <Download className="size-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Extrator Teams</h1>
              <p className="text-sm text-muted-foreground">Informe a senha de acesso</p>
            </div>
          </div>

          <form onSubmit={entrar} className="space-y-3">
            <Input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Senha"
              autoFocus
              autoComplete="current-password"
              aria-label="Senha de acesso"
            />

            {erro && (
              <p
                className="flex items-start gap-1.5 text-xs leading-tight"
                style={{ color: "var(--status-critical)" }}
                role="alert"
              >
                <AlertTriangle className="mt-px size-3 shrink-0" />
                {erro}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={enviando || senha.length === 0}>
              <LogIn className="mr-1.5 size-4" />
              {enviando ? "Entrando..." : "Entrar"}
            </Button>
          </form>

          <p className="text-center text-[11px] leading-tight text-muted-foreground">
            Acesso local. A senha fica em app/.env.local e não identifica quem entrou.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
