import { Suspense } from "react";
import { LoginView } from "@/components/auth/login-view";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  // useSearchParams exige um limite de Suspense; sem fallback o Next 16 entra
  // em refetch infinito, então o fallback é a própria moldura vazia da tela.
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <LoginView />
    </Suspense>
  );
}
