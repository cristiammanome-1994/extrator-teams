"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Navbar } from "./navbar";

/**
 * Moldura das telas internas. A de login fica de fora: exibir a navegação
 * para quem ainda não entrou anuncia as seções e oferece links que só levam
 * de volta ao próprio login.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/login") {
    return <div className="flex min-h-screen w-full flex-col">{children}</div>;
  }

  return (
    <div className="flex min-h-screen w-full flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-[1600px] flex-1 space-y-6 p-4 md:p-6">{children}</main>
    </div>
  );
}
