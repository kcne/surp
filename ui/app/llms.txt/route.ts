import { landingPages } from "@/lib/landing-pages"
import { absoluteUrl, siteConfig } from "@/lib/seo"

export const revalidate = 86400

export function GET() {
  const landingLinks = landingPages.map((page) => `- [${page.title}](${absoluteUrl(`/${page.slug}`)}): ${page.description}`).join("\n")
  const body = `# SURP

> ${siteConfig.description}

SURP je web softver za autobuske agencije u Srbiji i regionu. Pomaze agencijama da vode linije, polaske, rezervacije, putnike, online rezervacije i javni sajt agencije.

## Key pages

- [Home](${absoluteUrl("/")}): Pregled platforme SURP.
- [Funkcije](${absoluteUrl("/funkcije")}): Funkcije za linije, vozne redove, rezervacije, putnike i javni sajt.
- [Cene](${absoluteUrl("/cene")}): Planovi i opcije za autobuske agencije.
- [Blog](${absoluteUrl("/blog")}): Saveti o online rezervacijama, digitalizaciji i SEO-u za autobuske agencije.
${landingLinks}

## Contact

- [Kontakt](${absoluteUrl("/kontakt")}): Demo i pitanja za tim.
`

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
    },
  })
}
