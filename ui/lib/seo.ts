import type { Metadata } from "next"

export const siteConfig = {
  name: "SURP",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  description:
    "SURP objedinjuje linije, vozne redove, rezervacije, putnike i javni sajt autobuske agencije.",
  keywords: [
    "softver za autobuske agencije",
    "online rezervacije autobuskih karata",
    "sistem za rezervacije autobusa",
    "vozni red autobuske agencije",
    "upravljanje autobuskim linijama",
    "prodaja autobuskih karata",
  ],
  nav: [
    { href: "/funkcije", label: "Softver" },
    { href: "/za-agencije", label: "Za agencije" },
    { href: "/cene", label: "Cene" },
    { href: "/blog", label: "Blog" },
    { href: "/kontakt", label: "Kontakt" },
  ],
} as const

type BuildMetadataInput = {
  title: string
  description: string
  path?: string
  image?: string
  type?: "website" | "article"
}

export function absoluteUrl(path = "/") {
  return new URL(path, siteConfig.url).toString()
}

export function buildMetadata({ title, description, path = "/", image = "/marketing/og.svg", type = "website" }: BuildMetadataInput): Metadata {
  const url = absoluteUrl(path)
  const imageUrl = absoluteUrl(image)

  return {
    title,
    description,
    applicationName: siteConfig.name,
    authors: [{ name: siteConfig.name, url: siteConfig.url }],
    creator: siteConfig.name,
    publisher: siteConfig.name,
    category: "business software",
    keywords: [...siteConfig.keywords],
    alternates: {
      canonical: url,
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
    openGraph: {
      title,
      description,
      url,
      siteName: siteConfig.name,
      locale: "sr_RS",
      type,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: "SURP - sistem za autobuske agencije",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  }
}

export function jsonLd(data: Record<string, unknown>) {
  return JSON.stringify(data).replace(/</g, "\\u003c")
}

export function breadcrumbJsonLd(items: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  }
}
