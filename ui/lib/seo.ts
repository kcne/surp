import type { Metadata } from "next"

export const siteConfig = {
  name: "SURP",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  description:
    "SURP objedinjuje linije, vozne redove, rezervacije, putnike i javni sajt autobuske agencije.",
  nav: [
    { href: "/funkcije", label: "Funkcije" },
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
}

export function absoluteUrl(path = "/") {
  return new URL(path, siteConfig.url).toString()
}

export function buildMetadata({ title, description, path = "/" }: BuildMetadataInput): Metadata {
  const url = absoluteUrl(path)

  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      url,
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
      title,
      description,
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
