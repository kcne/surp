"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  BarChart3,
  MapPin,
  Route,
  Calendar,
  Ticket,
  Users,
} from "lucide-react"

const menuItems = [
  {
    title: "Analitika",
    href: "/dashboard",
    icon: BarChart3,
  },
  {
    title: "Stanice",
    href: "/stations",
    icon: MapPin,
  },
  {
    title: "Linije",
    href: "/lines",
    icon: Route,
  },
  {
    title: "Raspored",
    href: "/schedule",
    icon: Calendar,
  },
  {
    title: "Rezervacije",
    href: "/reservations",
    icon: Ticket,
  },
  {
    title: "Putnici",
    href: "/passengers",
    icon: Users,
  },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden md:fixed md:inset-y-0 md:left-0 md:top-16 md:flex md:w-60 md:flex-col md:border-r md:bg-background">
      <div className="flex h-full flex-col">
        <nav className="flex-1 space-y-1 px-3 py-4">
          {menuItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || pathname?.startsWith(item.href + "/")

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.title}</span>
              </Link>
            )
          })}
        </nav>
      </div>
    </aside>
  )
}

