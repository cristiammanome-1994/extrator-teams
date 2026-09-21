"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Activity, Download, LogOut, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./theme-toggle";

const ITENS = [
  { href: "/", label: "Exportações", icon: Download },
  { href: "/conversas", label: "Conversas", icon: MessageSquare },
  { href: "/analise", label: "Análise", icon: Activity },
];

function itemAtivo(href: string, pathname: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();

  async function sair() {
    await fetch("/api/auth/login", { method: "DELETE" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 w-full max-w-[1600px] items-center gap-6 px-4 md:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="Extrator Teams">
          <span className="flex size-8 items-center justify-center rounded bg-primary text-primary-foreground">
            <Download className="size-4" />
          </span>
          <span className="text-sm font-semibold tracking-tight">
            Extrator <span className="text-primary">Teams</span>
          </span>
        </Link>

        <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
          {ITENS.map(({ href, label, icon: Icon }) => {
            const ativo = itemAtivo(href, pathname);
            return (
              <Link
                key={href}
                href={href}
                aria-current={ativo ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  ativo ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-1">
          <ThemeToggle />
          <Button variant="ghost" size="icon-lg" onClick={sair} aria-label="Sair" title="Sair">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
