import type { Metadata } from "next"
import { NextIntlClientProvider } from "next-intl"
import { Inter, Space_Grotesk } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"
import "../globals.css"
import { GoogleAnalytics } from "@/components/analytics/google-analytics"
import { SeoPageAnalytics } from "@/components/analytics/seo-page-analytics"
import { AiReferrerAnalytics } from "@/components/analytics/ai-referrer-analytics"
import { Toaster } from "@/components/ui/toaster"
import { Toaster as SonnerToaster } from "sonner"
import { QueryProvider } from "@/infrastructure/providers/query-provider"
import { absoluteUrl, jsonLd, organizationJsonLd, siteConfig } from "@/lib/seo"
import { setRequestLocale } from "next-intl/server"
import { SUPPORTED_LOCALES, getFormattingLocale, getLocale } from "@/i18n/locales"
import { loadMessages } from "@/i18n/messages"
import { formats } from "@/i18n/formats"
import { ROOT_NAMESPACES } from "@/i18n/namespaces"
import { resolveRequestLocale } from "@/i18n/resolve-locale"
import { localizePathname } from "@/i18n/routing"
import { DEFAULT_TIME_ZONE } from "@/i18n/tenant"

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

type LocaleParams = { locale: string }

/**
 * Prerender one copy of the tree per language. Without this the whole app
 * renders on demand, since `[locale]` is a dynamic segment.
 */
export function generateStaticParams(): LocaleParams[] {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }))
}

export async function generateMetadata({
  params,
}: {
  params: LocaleParams
}): Promise<Metadata> {
  const locale = resolveRequestLocale(params)
  const home = localizePathname(locale, "/")

  return {
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
      // Each language canonicalises to its own home page. Cross-language
      // `hreflang` alternates and translated titles belong to the metadata
      // issue, which owns every public SEO surface at once.
      canonical: absoluteUrl(home),
    },
    openGraph: {
      title: "Softver za autobuske agencije",
      description: siteConfig.description,
      url: absoluteUrl(home),
      siteName: siteConfig.name,
      locale: getLocale(locale).ogLocale,
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
}

export default function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: LocaleParams
}) {
  const locale = resolveRequestLocale(params)
  // Hands the segment's locale to next-intl's server APIs. Without it they
  // fall back to reading the request, which would opt every page out of
  // static rendering.
  setRequestLocale(locale)
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
        {/* Every value is passed explicitly. Left to inherit, the provider
            reads them from the request, which would opt every page out of
            static rendering — including the public marketing pages. */}
        <NextIntlClientProvider
          locale={getFormattingLocale(locale)}
          messages={messages}
          formats={formats}
          timeZone={DEFAULT_TIME_ZONE}
        >
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
