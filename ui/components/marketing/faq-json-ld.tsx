import { jsonLd } from "@/lib/seo"

export type FaqItem = {
  question: string
  answer: string
}

type FaqJsonLdProps = {
  items: FaqItem[]
  /**
   * Optional URL identifier za FAQPage (kanonska putanja stranice na kojoj
   * se FAQ prikazuje). Pomaze AI sistemima da vezuju FAQ za pravi entity.
   */
  url?: string
}

/**
 * AI-E: globalni FAQPage JSON-LD generator. Renderuje se na svakoj stranici
 * koja ima FAQ blok (SEO landing, blog, marketing). AI sistemi koriste
 * FAQPage schema za query fan-out i citation matching.
 *
 * Komponenta vraca <script> tag spreman za ubacivanje u <head> ili body.
 */
export function FaqJsonLd({ items, url }: FaqJsonLdProps) {
  if (!items.length) return null

  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    ...(url ? { "@id": url } : {}),
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonLd(data) }}
    />
  )
}
