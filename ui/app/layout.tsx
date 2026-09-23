import type { Metadata } from "next"
import { NextIntlClientProvider } from "next-intl"
import { Inter, Space_Grotesk } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"
import "./globals.css"
import { GoogleAnalytics } from "@/components/analytics/google-analytics"
import { SeoPageAnalytics } from "@/components/analytics/seo-page-analytics"
import { AiReferrerAnalytics } from "@/components/analytics/ai-referrer-analytics"
import { Toaster } from "@/components/ui/toaster"
import { Toaster as SonnerToaster } from "sonner"
import { QueryProvider } from "@/infrastructure/providers/query-provider"
import { absoluteUrl, jsonLd, organizationJsonLd, siteConfig } from "@/lib/seo"
import { DEFAULT_LOCALE, getLocale } from "@/i18n/locales"
import { loadMessages } from "@/i18n/messages"
import { ROOT_NAMESPACES } from "@/i18n/namespaces"
import { resolveRequestLocale } from "@/i18n/resolve-locale"

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
    locale: getLocale(DEFAULT_LOCALE).ogLocale,
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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const locale = await resolveRequestLocale()
  // Only the namespaces every client component may reach for. Routes that
  // render more specific text pass their own namespaces further down, so a
  // reservations page never ships marketing copy to the browser.
  const { messages } = loadMessages(locale, ROOT_NAMESPACES)

  return (
    <html lang={getLocale(locale).htmlLang} className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <body className="min-h-screen flex flex-col antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(organizationJsonLd()) }}
        />
        <NextIntlClientProvider messages={messages}>
          <QueryProvider>
            <div className="flex-1">{children}</div>
            <Toaster />
            <SonnerToaster position="top-right" />
          </QueryProvider>
        </NextIntlClientProvider>
        <Analytics />
        <SpeedInsights />
        <GoogleAnalytics />
        <SeoPageAnalytics />
        <AiReferrerAnalytics />
      </body>
    </html>
  )
}
