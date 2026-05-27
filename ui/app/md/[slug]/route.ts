import { getLandingPage, landingPages } from "@/lib/landing-pages"
import { landingPageToMarkdown } from "@/lib/landing-to-markdown"

export const revalidate = 86400
export const dynamicParams = false

/**
 * AI-F: Per-landing Markdown mirror na `/md/{slug}`. Clean tekstualni izvor
 * istog sadrzaja kao HTML landing, namenjen AI agentima i crawler-ima koji
 * preferiraju Markdown.
 */
export function generateStaticParams() {
  return landingPages.map((page) => ({ slug: page.slug }))
}

export function GET(_request: Request, { params }: { params: { slug: string } }) {
  const page = getLandingPage(params.slug)
  if (!page) {
    return new Response("Not found", { status: 404 })
  }

  const body = landingPageToMarkdown(page)

  return new Response(body, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
    },
  })
}
