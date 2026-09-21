"use client";

import { CardProgresso } from "@/components/exportacoes/card-progresso";
import { FormularioExportacao } from "@/components/exportacoes/formulario-exportacao";
import { ImportarTxt } from "@/components/exportacoes/importar-txt";
import { TabelaExportacoes } from "@/components/exportacoes/tabela-exportacoes";
import { ErrorState } from "@/components/states/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useExportacoes } from "@/hooks/useExportacoes";

export default function ExportacoesPage() {
  const { exportacoes, erro, recarregar } = useExportacoes();
  const ativa = exportacoes?.find((e) => e.status === "em_andamento");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Exportações</h1>
        <p className="text-sm text-muted-foreground">
          Exporte o histórico de um grupo do Teams e leia as mensagens nas telas Conversas e Análise.
        </p>
      </div>

      {erro && <ErrorState message={erro} onRetry={() => void recarregar()} />}

      <FormularioExportacao desabilitado={Boolean(ativa)} onIniciada={() => void recarregar()} />

      {ativa && <CardProgresso exportacao={ativa} onCancelada={() => void recarregar()} />}

      {exportacoes === null ? <Skeleton className="h-40 w-full" /> : <TabelaExportacoes exportacoes={exportacoes} />}

      <ImportarTxt />
    </div>
  );
}
