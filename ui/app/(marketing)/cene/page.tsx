import type { Metadata } from "next"
import { CheckCircle2, Minus } from "lucide-react"
import { FAQ, faqItems } from "@/components/marketing/faq"
import { PricingCards } from "@/components/marketing/pricing-cards"
import { MarketingSection } from "@/components/marketing/section"
import { breadcrumbJsonLd, buildMetadata, jsonLd } from "@/lib/seo"

export const metadata: Metadata = buildMetadata({
  title: "Cena softvera za autobuske agencije",
  description: "Cena softvera za autobuske agencije: Starter, Pro i Enterprise planovi za rezervacije, linije, korisnike i online prodaju karata.",
  path: "/cene",
})

const featureRows = [
  ["Neogranicen broj stanica", true, true, true],
  ["Aktivne linije", "Do 10", "Neograniceno", "Neograniceno"],
  ["Korisnicki racuni", "Do 10", "Neograniceno", "Neograniceno"],
  ["Rucni unos rezervacija", true, true, true],
  ["Javni sajt agencije", false, true, true],
  ["Online rezervacije", false, true, true],
  ["Izvestaji i pregled prodaje", false, true, true],
  ["Vise agencija", false, false, true],
  ["Integracije vasih API-ja", false, false, true],
  ["Mogucnost vaseg hostinga, servera i baze", false, false, true],
  ["Podrska", "Email", "Live na zahtev", "Prioritetna"],
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
            Cena
          </p>
          <h1 className="mt-4 font-display text-5xl font-bold tracking-[-0.035em] text-[color:var(--mk-navy-900)] md:text-6xl">
            Izaberite plan za vasu autobusku agenciju.
          </h1>
          <p className="mt-6 text-lg leading-8 text-[color:var(--mk-text-muted)] md:text-xl">
            Pocnite sa osnovnim paketom za rezervacije i linije, ili izaberite Pro
            plan ako zelite online rezervacije, javni sajt i neogranicen broj korisnika.
          </p>
        </div>
      </MarketingSection>

      <MarketingSection className="bg-[color:var(--mk-bg-alt)]">
        <PricingCards />
      </MarketingSection>

      <MarketingSection className="bg-white">
        <div className="mb-10 max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--mk-indigo-600)]">
            Poredjenje planova
          </p>
          <h2 className="mt-4 font-display text-4xl font-semibold tracking-[-0.025em] text-[color:var(--mk-navy-900)] md:text-5xl">
            Sta dobijate u svakom paketu?
          </h2>
          <p className="mt-4 text-lg leading-8 text-[color:var(--mk-text-muted)]">
            Uporedite pakete za softver za autobuske agencije i izaberite opciju
            koja odgovara trenutnom obimu vaseg poslovanja.
          </p>
        </div>
        <div className="overflow-hidden rounded-3xl border border-[color:var(--mk-border)] shadow-mk-sm">
          <table className="w-full min-w-[720px] bg-white text-left text-sm">
            <thead className="bg-[color:var(--mk-bg-alt)] text-[color:var(--mk-navy-900)]">
              <tr>
                 <th className="px-5 py-4 font-semibold">Sta je ukljuceno</th>
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
                      {included === true ? (
                        <CheckCircle2 className="mx-auto h-5 w-5 text-[color:var(--mk-success)]" />
                      ) : included === false ? (
                        <Minus className="mx-auto h-5 w-5 text-[color:var(--mk-text-subtle)]" />
                      ) : (
                        <span className="text-sm font-semibold text-[color:var(--mk-text-muted)]">{included}</span>
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
