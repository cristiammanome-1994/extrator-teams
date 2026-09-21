import { Badge } from "@/components/ui/badge";
import type { StatusExportacao } from "@/types/dominio";

const ESTILO: Record<StatusExportacao, { rotulo: string; cor: string }> = {
  em_andamento: { rotulo: "Em andamento", cor: "var(--chart-1)" },
  concluida: { rotulo: "Concluída", cor: "var(--status-good)" },
  erro: { rotulo: "Erro", cor: "var(--status-critical)" },
  cancelada: { rotulo: "Cancelada", cor: "var(--status-warning)" },
};

export function StatusExportacaoBadge({ status }: { status: StatusExportacao }) {
  const { rotulo, cor } = ESTILO[status];
  return (
    <Badge variant="outline" style={{ borderColor: cor, color: cor }}>
      {rotulo}
    </Badge>
  );
}
