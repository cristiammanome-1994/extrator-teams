import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * O hover mora aqui, e não em cada tela: elevação (`shadow-lg`) mais o anel
 * na cor primária. Antes só o `StatCard` reagia ao mouse, e ele tentava
 * fazer isso com `hover:border-primary/40` — que nunca apareceu, porque o
 * contorno do cartão é um `ring`, não uma `border`. Daí `hover:ring-…`.
 *
 * A transição é só de `box-shadow` (o `ring` também é box-shadow, então a
 * cor do anel entra junto). `transition-all` animaria largura e altura
 * também, e os cartões deste painel mudam de tamanho quando o dado chega.
 */
function Card({
  className,
  size = "default",
  ...props
}: React.ComponentProps<"div"> & { size?: "default" | "sm" }) {
  return (
    <div
      data-slot="card"
      data-size={size}
      className={cn(
        "group/card flex flex-col gap-(--card-spacing) overflow-hidden rounded-xl bg-card py-(--card-spacing) text-sm text-card-foreground ring-1 ring-foreground/10 transition-shadow duration-200 hover:shadow-lg hover:ring-primary/40 [--card-spacing:--spacing(4)] has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:[--card-spacing:--spacing(3)] data-[size=sm]:has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl",
        className
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "group/card-header @container/card-header grid auto-rows-min items-start gap-1 rounded-t-xl px-(--card-spacing) has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-(--card-spacing)",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn(
        // Ícone dentro do título reage como o do StatCard: cresce e escurece
        // quando o mouse entra no cartão. Fica no CardTitle porque é ali que
        // esse ícone sempre vive — `<CardTitle><Icone /> Texto</CardTitle>`.
        "font-heading text-base leading-snug font-medium group-data-[size=sm]/card:text-sm",
        "[&>svg]:transition-[transform,color] [&>svg]:duration-200 group-hover/card:[&>svg]:scale-110 group-hover/card:[&>svg]:text-foreground",
        className
      )}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-(--card-spacing)", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex items-center rounded-b-xl border-t bg-muted/50 p-(--card-spacing)",
        className
      )}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}
