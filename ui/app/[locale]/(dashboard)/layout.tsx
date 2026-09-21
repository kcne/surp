"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { canAccessDashboardRoute } from "@/lib/roleAccess"
import { useAuthStore } from "@/stores/authStore"

interface DashboardLayoutProps {
  children: React.ReactNode
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { hasHydrated, isAuthenticated, user } = useAuthStore()

  useEffect(() => {
    if (hasHydrated && !isAuthenticated) {
      router.replace("/login")
    }
  }, [hasHydrated, isAuthenticated, router])

  useEffect(() => {
    if (hasHydrated && isAuthenticated && !canAccessDashboardRoute(user?.role, pathname)) {
      router.replace("/passenger-lists")
    }
  }, [hasHydrated, isAuthenticated, pathname, router, user?.role])

  if (!hasHydrated || !isAuthenticated || !canAccessDashboardRoute(user?.role, pathname)) {
    return null
  }

  return <>{children}</>
}
