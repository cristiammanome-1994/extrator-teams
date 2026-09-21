import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";

export function EmptyState({
  title = "Nenhum dado encontrado",
  description,
  icon: Icon = Inbox,
}: {
  title?: string;
  description?: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground">
      <Icon className="h-8 w-8 opacity-50" />
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="text-xs max-w-sm">{description}</p>}
    </div>
  );
}
