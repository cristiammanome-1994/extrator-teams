"use client";

import { ErrorState } from "@/components/states/error-state";

export default function Erro({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorState message={error.message || "Erro inesperado ao carregar a tela."} onRetry={reset} />;
}
