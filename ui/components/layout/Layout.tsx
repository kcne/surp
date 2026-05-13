"use client"

import { Header } from "./Header"
import { Sidebar } from "./Sidebar"

interface LayoutProps {
  children: React.ReactNode
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 min-w-0 md:ml-60 p-6">{children}</main>
      </div>
      <footer className="border-t bg-background/95 px-4 py-3 text-center text-sm text-muted-foreground md:ml-60 md:px-6">
        © 2026 Copyright Gradient Labs
      </footer>
    </div>
  )
}
