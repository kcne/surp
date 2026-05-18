"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { clearAuthSession } from "@/infrastructure/utils/storage"
import { useAuthStore } from "@/stores/authStore"

export function SandboxDemoRedirect() {
  const router = useRouter()
  const logout = useAuthStore((state) => state.logout)

  useEffect(() => {
    logout()
    clearAuthSession()
    router.replace("/login?sandbox=1")
  }, [logout, router])

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 text-center">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Sandbox demo</p>
        <h1 className="mt-3 text-2xl font-bold text-gray-950">Pripremamo demo okruženje...</h1>
        <p className="mt-2 text-sm text-gray-600">Preusmeravamo vas na demo prijavu.</p>
      </div>
    </main>
  )
}
