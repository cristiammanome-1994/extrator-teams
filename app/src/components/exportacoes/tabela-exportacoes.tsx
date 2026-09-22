import { Download } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/states/empty-state";
import { formatarDuracao, formatarInstante, formatarNumero } from "@/lib/formatacao";
import type { Exportacao } from "@/types/dominio";
import { ExcluirExportacaoDialog } from "./excluir-exportacao-dialog";
import { StatusExportacaoBadge } from "./status-exportacao-badge";

const STATUS_FINAIS = new Set<Exportacao["status"]>(["concluida", "erro", "cancelada"]);

export function TabelaExportacoes({
  exportacoes,
  onExcluida,
}: {
  exportacoes: Exportacao[];
  onExcluida: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Histórico</CardTitle>
      </CardHeader>
      <CardContent>
        {exportacoes.length === 0 ? (
          <EmptyState
            title="Nenhuma exportação ainda"
            description="Informe o nome de um grupo acima e clique em Exportar, ou importe um .txt antigo."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Grupo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Início</TableHead>
                <TableHead>Duração</TableHead>
                <TableHead className="text-right">Mensagens</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {exportacoes.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="max-w-[320px] whitespace-normal break-words font-medium">{e.grupo}</TableCell>
                  <TableCell className="space-y-1 whitespace-normal">
                    <StatusExportacaoBadge status={e.status} />
                    {e.status === "erro" && e.erroMsg && (
                      <p className="max-w-[320px] text-xs text-muted-foreground">{e.erroMsg}</p>
                    )}
                  </TableCell>
                  <TableCell className="tabular-nums">{formatarInstante(e.iniciadaEm)}</TableCell>
                  <TableCell className="tabular-nums">{formatarDuracao(e.iniciadaEm, e.finalizadaEm)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {e.totalMensagens !== null ? formatarNumero(e.totalMensagens) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {e.status === "concluida" && e.arquivoTxt && (
                        <a
                          href={`/api/exportacoes/${e.id}/download`}
                          className={buttonVariants({ variant: "outline", size: "sm" })}
                        >
                          <Download className="mr-1 size-3.5" />
                          .txt
                        </a>
                      )}
                      {STATUS_FINAIS.has(e.status) && (
                        <ExcluirExportacaoDialog exportacao={e} onExcluida={onExcluida} />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
