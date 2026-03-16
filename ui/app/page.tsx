"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    router.push("/reservations")
  }, [router])

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold">Sistem za Rezervaciju Autobuskih Karata</h1>
      <p className="mt-4 text-lg text-muted-foreground">Preusmeravanje...</p>
    </main>
  )
}

