import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import "./globals.css";
import { AppShell } from "@/components/layout/app-shell";
import { TemaProvider } from "@/contexts/TemaContext";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Extrator Teams",
  description: "Exporta, lê e analisa conversas do Microsoft Teams",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const temaInicial = cookieStore.get("tema")?.value === "dark" ? "dark" : "light";

  return (
    <html lang="pt-BR" className={`${geistSans.variable} h-full antialiased ${temaInicial === "dark" ? "dark" : ""}`}>
      <body className="min-h-full flex flex-col bg-background">
        <TemaProvider temaInicial={temaInicial}>
          <AppShell>{children}</AppShell>
        </TemaProvider>
      </body>
    </html>
  );
}
