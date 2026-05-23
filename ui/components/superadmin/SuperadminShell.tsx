"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { useAuthStore } from "@/stores/authStore"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import {
  Activity,
  BarChart3,
  Building2,
  LogOut,
  Menu,
  Settings,
  Shield,
  User,
  UserRoundPlus,
} from "lucide-react"
import { toast } from "sonner"

const navItems = [
  { title: "Pregled", href: "/superadmin/overview", icon: BarChart3 },
  { title: "Agencije", href: "/superadmin/agencies", icon: Building2 },
  { title: "Leadovi", href: "/superadmin/leads", icon: UserRoundPlus },
  { title: "Aktivnost", href: "/superadmin/activity", icon: Activity },
  { title: "Podešavanja", href: "/superadmin/settings", icon: Settings },
]

export function SuperadminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { hasHydrated, isAuthenticated, user, logout } = useAuthStore()
  const isSuperadmin = user?.role === "SUPERADMIN"
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  useEffect(() => {
    if (!hasHydrated) {
      return
    }

    if (!isAuthenticated) {
      router.replace("/login")
      return
    }

    if (!isSuperadmin) {
      router.replace("/reservations")
    }
  }, [hasHydrated, isAuthenticated, isSuperadmin, router])

  if (!hasHydrated || !isAuthenticated || !isSuperadmin) {
    return null
  }

  const handleLogout = () => {
    logout()
    toast.success("Uspešno ste se odjavili")
    router.push("/login")
  }

  return (
    <div className="min-h-dvh bg-muted/20">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:shadow-lg focus:ring-2 focus:ring-ring"
      >
        Preskoči na sadržaj
      </a>

      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex h-16 items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-3">
            <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden" aria-label="Otvori superadmin navigaciju">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80 p-0">
                <SheetHeader className="border-b p-4 text-left">
                  <SheetTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" />
                    Superadmin
                  </SheetTitle>
                </SheetHeader>
                <SuperadminNav pathname={pathname ?? ""} onNavigate={() => setMobileNavOpen(false)} />
              </SheetContent>
            </Sheet>

            <div className="rounded-xl bg-primary/10 p-2 text-primary">
              <Shield className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">SURP</p>
              <h1 className="font-semibold leading-none">Superadmin</h1>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="min-h-11 gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <User className="h-4 w-4" aria-hidden="true" />
                </div>
                <span className="hidden text-left sm:block">
                  <span className="block text-sm font-medium leading-none">{user?.username}</span>
                  <span className="block pt-1 text-xs text-muted-foreground">{user?.email}</span>
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>
                <div className="space-y-1">
                  <p className="text-sm font-medium">{user?.username}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                  <p className="text-xs text-primary">Superadmin</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="min-h-10 cursor-pointer text-destructive focus:text-destructive">
                <LogOut className="h-4 w-4" />
                Odjava
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex">
        <aside className="fixed inset-y-0 left-0 top-16 hidden w-64 border-r bg-background md:block">
          <SuperadminNav pathname={pathname ?? ""} />
        </aside>

        <main id="main-content" className="min-w-0 flex-1 p-4 md:ml-64 md:p-6">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  )
}

function SuperadminNav({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav aria-label="Superadmin navigacija" className="space-y-2 p-4">
      {navItems.map((item) => {
        const Icon = item.icon
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`)

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            onClick={onNavigate}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            {item.title}
          </Link>
        )
      })}
    </nav>
  )
}
