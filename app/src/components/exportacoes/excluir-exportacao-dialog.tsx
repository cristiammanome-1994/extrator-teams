"use client";

import { useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { invalidarCache } from "@/hooks/useRecursoRemoto";
import { formatarNumero } from "@/lib/formatacao";
import type { Exportacao } from "@/types/dominio";

/**
 * Botão de lixeira + diálogo de confirmação para uma linha do histórico. Só aparece em execuções
 * com status final (o card da tela já garante isso não renderizando este componente para uma
 * `em_andamento`, e a API recusa com 409 do mesmo jeito).
 *
 * Excluir apaga a linha E as mensagens que aquela execução trouxe — não as de outras execuções do
 * mesmo grupo. O aviso é explícito sobre isso porque a ação não pode ser desfeita.
 */
export function ExcluirExportacaoDialog({
  exportacao,
  onExcluida,
}: {
  exportacao: Exportacao;
  onExcluida: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function fechar(aberto: boolean) {
    setAberto(aberto);
    if (!aberto) setErro(null);
  }

  async function excluir() {
    setExcluindo(true);
    setErro(null);
    try {
      const resposta = await fetch(`/api/exportacoes/${exportacao.id}`, { method: "DELETE" });
      const corpo = await resposta.json().catch(() => null);
      if (!resposta.ok) {
        setErro(corpo?.error?.message ?? "Não foi possível excluir.");
        return;
      }
      setAberto(false);
      // Conversas e Análise buscam por grupo, não por execução — sem isso continuariam mostrando
      // as mensagens que acabaram de ser apagadas até a pessoa recarregar a página.
      invalidarCache("/api/");
      onExcluida();
    } catch {
      setErro("Falha de rede. Tente novamente.");
    } finally {
      setExcluindo(false);
    }
  }

  const temMensagens = (exportacao.totalMensagens ?? 0) > 0;

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Excluir exportação de ${exportacao.grupo}`}
        title="Excluir do histórico"
        onClick={() => setAberto(true)}
      >
        <Trash2 className="size-3.5" />
      </Button>

      <Dialog open={aberto} onOpenChange={fechar}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir esta exportação?</DialogTitle>
            <DialogDescription>
              Remove &ldquo;{exportacao.grupo}&rdquo; do histórico
              {temMensagens
                ? ` e as ${formatarNumero(exportacao.totalMensagens!)} mensagens que ela trouxe de Conversas e Análise`
                : ""}
              . Não pode ser desfeito.
            </DialogDescription>
          </DialogHeader>

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

          <DialogFooter>
            <Button variant="outline" onClick={() => setAberto(false)} disabled={excluindo}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={excluir} disabled={excluindo}>
              {excluindo ? "Excluindo..." : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
