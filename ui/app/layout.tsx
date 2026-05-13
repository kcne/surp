import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Toaster } from "@/components/ui/toaster"
import { Toaster as SonnerToaster } from "sonner"
import { QueryProvider } from "@/infrastructure/providers/query-provider"

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-inter",
})

export const metadata: Metadata = {
  title: "Sistem za Rezervaciju Autobuskih Karata",
  description: "Interna web aplikacija za rezervaciju autobuskih karata",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="sr" className={inter.variable}>
      <body className="min-h-screen flex flex-col">
        <QueryProvider>
          <div className="flex-1">{children}</div>
          <Toaster />
          <SonnerToaster position="top-right" />
        </QueryProvider>
      </body>
    </html>
  )
}
