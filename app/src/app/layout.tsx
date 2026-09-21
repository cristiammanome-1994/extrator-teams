import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Extrator Teams",
  description: "Exporta, lê e analisa conversas do Microsoft Teams",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-background">{children}</body>
    </html>
  );
}
