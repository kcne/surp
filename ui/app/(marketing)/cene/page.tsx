import type { Metadata } from "next"
import { CheckCircle2, Minus } from "lucide-react"
import { FAQ, faqItems } from "@/components/marketing/faq"
import { PricingCards } from "@/components/marketing/pricing-cards"
import { MarketingSection } from "@/components/marketing/section"
import { breadcrumbJsonLd, buildMetadata, jsonLd } from "@/lib/seo"

export const metadata: Metadata = buildMetadata({
  title: "Cene",
  description: "Planovi za autobuske agencije: Starter, Pro i Enterprise, uz demo i personalizovanu ponudu.",
  path: "/cene",
})

const featureRows = [
  ["Linije i stanice", true, true, true],
  ["Manuelne rezervacije", true, true, true],
  ["Javni storefront", false, true, true],
  ["Online rezervacije", false, true, true],
  ["Napredni izvestaji", false, true, true],
  ["Vise brendova / tenant-a", false, false, true],
  ["Custom integracije", false, false, true],
  ["Prioritetni onboarding", false, true, true],
]

export default function CenePage() {
  const breadcrumbs = breadcrumbJsonLd([
    { name: "SURP", path: "/" },
    { name: "Cene", path: "/cene" },
  ])
  const pricingFaq = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.slice(0, 4).map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbs) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(pricingFaq) }} />
      <MarketingSection className="bg-[color:var(--mk-bg)]">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--mk-indigo-600)]">
            Cene
          </p>
          <h1 className="mt-4 font-display text-5xl font-bold tracking-[-0.035em] text-[color:var(--mk-navy-900)] md:text-6xl">
            Planovi za svaku fazu rasta agencije.
          </h1>
          <p className="mt-6 text-lg leading-8 text-[color:var(--mk-text-muted)] md:text-xl">
            Cenu formiramo prema obimu linija, broju korisnika i potrebnom nivou
            implementacije. Demo razgovor sluzi da dobijete preciznu ponudu.
          </p>
        </div>
      </MarketingSection>

      <MarketingSection className="bg-[color:var(--mk-bg-alt)]">
        <PricingCards />
      </MarketingSection>

      <MarketingSection className="bg-white">
        <div className="mb-10 max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--mk-indigo-600)]">
            Poredjenje
          </p>
          <h2 className="mt-4 font-display text-4xl font-semibold tracking-[-0.025em] text-[color:var(--mk-navy-900)] md:text-5xl">
            Sta ulazi u koji plan?
          </h2>
          <p className="mt-4 text-lg leading-8 text-[color:var(--mk-text-muted)]">
            Ovo je radni model pakovanja. Finalni obim dogovaramo kroz demo i
            onboarding plan.
          </p>
        </div>
        <div className="overflow-hidden rounded-3xl border border-[color:var(--mk-border)] shadow-mk-sm">
          <table className="w-full min-w-[720px] bg-white text-left text-sm">
            <thead className="bg-[color:var(--mk-bg-alt)] text-[color:var(--mk-navy-900)]">
              <tr>
                <th className="px-5 py-4 font-semibold">Funkcija</th>
                <th className="px-5 py-4 text-center font-semibold">Starter</th>
                <th className="px-5 py-4 text-center font-semibold">Pro</th>
                <th className="px-5 py-4 text-center font-semibold">Enterprise</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--mk-border)]">
              {featureRows.map(([label, starter, pro, enterprise]) => (
                <tr key={String(label)}>
                  <td className="px-5 py-4 font-medium text-[color:var(--mk-navy-900)]">{label}</td>
                  {[starter, pro, enterprise].map((included, index) => (
                    <td key={index} className="px-5 py-4 text-center">
                      {included ? (
                        <CheckCircle2 className="mx-auto h-5 w-5 text-[color:var(--mk-success)]" />
                      ) : (
                        <Minus className="mx-auto h-5 w-5 text-[color:var(--mk-text-subtle)]" />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </MarketingSection>
      <FAQ />
    </>
  )
}
