import type { ReactNode } from "react"

interface StorefrontLayoutProps {
  children: ReactNode
}

export default function StorefrontLayout({ children }: StorefrontLayoutProps) {
  return <>{children}</>
}
