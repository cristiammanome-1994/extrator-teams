"use client";

import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTema } from "@/contexts/TemaContext";

export function ThemeToggle() {
  const { tema, alternarTema } = useTema();
  const rotulo = tema === "dark" ? "Ativar tema claro" : "Ativar tema escuro";

  return (
    <Button variant="ghost" size="icon-lg" onClick={alternarTema} aria-label={rotulo} title={rotulo}>
      {tema === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
