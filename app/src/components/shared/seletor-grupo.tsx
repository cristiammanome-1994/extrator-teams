import { formatarNumero } from "@/lib/formatacao";
import type { GrupoResumo } from "@/types/dominio";
import { SelectNativo } from "./select-nativo";

export function SeletorGrupo({
  grupos,
  valor,
  onChange,
}: {
  grupos: GrupoResumo[];
  valor: number | null;
  onChange: (id: number) => void;
}) {
  return (
    <SelectNativo aria-label="Grupo" value={valor ?? ""} onChange={(e) => onChange(Number(e.target.value))}>
      {grupos.map((g) => (
        <option key={g.id} value={g.id}>
          {g.nome} ({formatarNumero(g.total)})
        </option>
      ))}
    </SelectNativo>
  );
}
