"use client";

import { useState } from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { formatarDataHora } from "@/lib/formatacao";
import { cn } from "@/lib/utils";
import type { Mensagem } from "@/types/dominio";

const LIMITE_CARACTERES = 400;
const LIMITE_LINHAS = 6;

export function LinhaMensagem({ mensagem }: { mensagem: Mensagem }) {
  const [aberta, setAberta] = useState(false);
  const longa = mensagem.texto.length > LIMITE_CARACTERES || mensagem.texto.split("\n").length > LIMITE_LINHAS;

  return (
    <TableRow>
      <TableCell className="whitespace-nowrap align-top tabular-nums text-muted-foreground">
        {formatarDataHora(mensagem.dataHora, mensagem.dataHoraOriginal)}
      </TableCell>
      <TableCell className="whitespace-nowrap align-top font-medium">{mensagem.autor}</TableCell>
      <TableCell className="whitespace-normal align-top">
        <div className={cn("whitespace-pre-wrap break-words", longa && !aberta && "line-clamp-6")}>{mensagem.texto}</div>
        {longa && (
          <button
            type="button"
            className="mt-1 text-xs text-primary hover:underline"
            onClick={() => setAberta(!aberta)}
          >
            {aberta ? "Ver menos" : "Ver mais"}
          </button>
        )}
      </TableCell>
    </TableRow>
  );
}
