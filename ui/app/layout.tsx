import type { Metadata } from "next"
import { Inter, Space_Grotesk } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"
import "./globals.css"
import { GoogleAnalytics } from "@/components/analytics/google-analytics"
import { Toaster } from "@/components/ui/toaster"
import { Toaster as SonnerToaster } from "sonner"
import { QueryProvider } from "@/infrastructure/providers/query-provider"
import { absoluteUrl, siteConfig } from "@/lib/seo"

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
})

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
})

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: "Softver za autobuske agencije",
    template: "%s - SURP",
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  keywords: [...siteConfig.keywords],
  authors: [{ name: siteConfig.name, url: siteConfig.url }],
  creator: siteConfig.name,
  publisher: siteConfig.name,
  alternates: {
    canonical: absoluteUrl("/"),
  },
  openGraph: {
    title: "Softver za autobuske agencije",
    description: siteConfig.description,
    url: absoluteUrl("/"),
    siteName: siteConfig.name,
    locale: "sr_RS",
    type: "website",
    images: [
      {
        url: absoluteUrl("/marketing/og.svg"),
        width: 1200,
        height: 630,
        alt: "SURP - sistem za autobuske agencije",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Softver za autobuske agencije",
    description: siteConfig.description,
    images: [absoluteUrl("/marketing/og.svg")],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
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
        <Analytics />
        <SpeedInsights />
        <GoogleAnalytics />
      </body>
    </html>
  )
}
