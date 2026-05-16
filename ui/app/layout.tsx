import type { Metadata } from "next"
import { Inter, Space_Grotesk } from "next/font/google"
import "./globals.css"
import { Toaster } from "@/components/ui/toaster"
import { Toaster as SonnerToaster } from "sonner"
import { QueryProvider } from "@/infrastructure/providers/query-provider"

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-inter",
})

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
})

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "SURP - Sistem za autobuske agencije",
    template: "%s - SURP",
  },
  description: "SURP objedinjuje linije, vozne redove, rezervacije, putnike i javni sajt autobuske agencije.",
  icons: {
    icon: "/marketing/favicon.svg",
    apple: "/marketing/apple-icon.svg",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="sr-Latn" className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <body className="min-h-screen flex flex-col antialiased">
        <QueryProvider>
          <div className="flex-1">{children}</div>
          <Toaster />
          <SonnerToaster position="top-right" />
        </QueryProvider>
      </body>
    </html>
  )
}
