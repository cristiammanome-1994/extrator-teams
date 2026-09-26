import { Download } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Download por link simples: a exportação é uma rota GET que devolve o arquivo
 * com `Content-Disposition: attachment`, então o navegador baixa sem sair da
 * tela e o cookie de sessão vai junto. Sem `fetch`, sem Blob, sem estado.
 *
 * Desabilitado é `aria-disabled` sem `href`: `<a>` não tem `disabled` de verdade.
 */
export function LinkExportar({
  href,
  rotulo,
  titulo,
  desabilitado,
}: {
  href: string | null;
  rotulo: string;
  titulo: string;
  desabilitado?: boolean;
}) {
  const inativo = desabilitado || href === null;
  return (
    <a
      href={inativo ? undefined : href}
      download
      aria-disabled={inativo || undefined}
      aria-label={titulo}
      title={titulo}
      data-sem-impressao
      className={cn(buttonVariants({ variant: "outline", size: "sm" }), inativo && "pointer-events-none opacity-50")}
    >
      <Download className="size-3.5" />
      {rotulo}
    </a>
  );
}
