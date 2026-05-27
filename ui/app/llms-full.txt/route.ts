import { landingPages } from "@/lib/landing-pages"
import { brandEntityToMarkdown, landingPageToMarkdown } from "@/lib/landing-to-markdown"
import { absoluteUrl } from "@/lib/seo"

export const revalidate = 86400

/**
 * AI-F: full text dump koji AI agenti i LLM trening sistemi mogu da pokupe
 * jednim fetch-om. Sadrzi brand entity + sve SEO landing stranice kao Markdown.
 */
export function GET() {
  const sections = landingPages.map(landingPageToMarkdown).join("\n\n---\n\n")
  const body = `${brandEntityToMarkdown()}

---

# SURP — Sadrzaj sajta (puni tekst)

Generisano automatski iz \`ui/lib/landing-pages.ts\` i \`ui/content/brand-entity.json\`.

Canonical: ${absoluteUrl("/llms-full.txt")}
Index: ${absoluteUrl("/llms.txt")}

---

${sections}
`

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
    },
  })
}
