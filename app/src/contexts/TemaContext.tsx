"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type Tema = "light" | "dark";

const NOME_COOKIE = "tema";

/** Um ano: a preferência de aparência não deve expirar sozinha. */
const VALIDADE_COOKIE_S = 31536000;

interface TemaContextValor {
  tema: Tema;
  alternarTema: () => void;
}

const TemaContext = createContext<TemaContextValor | null>(null);

/**
 * O tema inicial vem do servidor (cookie lido em layout.tsx), não de um script
 * no `<head>`: assim o `<html>` já nasce com a classe certa e não há flash de
 * tema na carga da página.
 */
export function TemaProvider({ temaInicial, children }: { temaInicial: Tema; children: ReactNode }) {
  const [tema, setTema] = useState<Tema>(temaInicial);

  const alternarTema = useCallback(() => {
    const proximo: Tema = tema === "dark" ? "light" : "dark";
    document.documentElement.classList.toggle("dark", proximo === "dark");
    document.cookie = `${NOME_COOKIE}=${proximo}; path=/; max-age=${VALIDADE_COOKIE_S}; SameSite=Lax`;
    setTema(proximo);
  }, [tema]);

  return <TemaContext.Provider value={{ tema, alternarTema }}>{children}</TemaContext.Provider>;
}

export function useTema(): TemaContextValor {
  const contexto = useContext(TemaContext);
  if (!contexto) throw new Error("useTema precisa ser usado dentro de um TemaProvider");
  return contexto;
}
