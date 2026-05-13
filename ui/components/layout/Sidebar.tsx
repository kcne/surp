"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/stores/authStore"
import {
  BarChart3,
  Building2,
  Calendar,
  Info,
  MapPin,
  Route,
  Store,
  Ticket,
  Users,
} from "lucide-react"

const reservationItems = [
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

const lineItems = [
  {
    title: "Raspored",
    href: "/schedule",
    icon: Calendar,
  },
  {
    title: "Linije",
    href: "/lines",
    icon: Route,
  },
  {
    title: "Stanice",
    href: "/stations",
    icon: MapPin,
  },
]

const supportItems = [
  {
    title: "Javni izlog",
    href: "/storefront",
    icon: Store,
  },
  {
    title: "Tiketi",
    href: "/tickets",
    icon: Info,
  },
]

const analyticsItems = [
  {
    title: "Analitika",
    href: "/analytics",
    icon: BarChart3,
  },
]

interface SidebarNavProps {
  onNavigate?: () => void
}

export function SidebarNav({ onNavigate }: SidebarNavProps) {
  const pathname = usePathname()
  const { user } = useAuthStore()

  const sections = [
    {
      title: "Rezervacije",
      items: reservationItems,
    },
    {
      title: "Linije",
      items: lineItems,
    },
    {
      title: "Upravljanje i Podrska",
      items:
        user?.role === "ADMIN"
          ? [
              ...supportItems,
              {
                title: "Upravljanje Agencijom",
                href: "/agency-management",
                icon: Building2,
              },
            ]
          : supportItems,
    },
    {
      title: "Analitika",
      items: analyticsItems,
    },
  ]

  return (
    <nav className="flex-1 space-y-5 px-3 py-4">
      {sections.map((section) => (
        <div key={section.title} className="space-y-1">
          <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
            {section.title}
          </p>
          {section.items.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || pathname?.startsWith(item.href + "/")

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
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
        </div>
      ))}
    </nav>
  )
}

export function Sidebar() {
  return (
    <aside className="hidden md:fixed md:inset-y-0 md:left-0 md:top-16 md:flex md:w-60 md:flex-col md:border-r md:bg-background">
      <div className="flex h-full flex-col">
        <SidebarNav />
      </div>
    </aside>
  )
}
