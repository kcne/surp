import Link from "next/link"
import { MarketingSection } from "@/components/marketing/section"
import { PricingCards } from "@/components/marketing/pricing-cards"

export function PricingTeaser() {
  return (
    <MarketingSection id="cene" className="bg-[color:var(--mk-bg-alt)]">
      <div className="mx-auto mb-12 max-w-3xl text-center">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--mk-indigo-600)]">
          Cena
        </p>
        <h2 className="mt-4 font-display text-4xl font-semibold tracking-[-0.025em] text-[color:var(--mk-navy-900)] md:text-5xl">
          Izaberite plan za vasu agenciju.
        </h2>
        <p className="mt-4 text-lg leading-8 text-[color:var(--mk-text-muted)]">
          Pomoci cemo vam da postavite sistem od nule, a prvi mesec od nas
          dobijate besplatno.
        </p>
      </div>

      <PricingCards compact />

      <div className="mt-10 text-center">
        <Link href="/cene" className="text-sm font-semibold text-[color:var(--mk-indigo-600)] hover:underline">
          Pogledajte detalje planova →
        </Link>
      </div>
    </MarketingSection>
  )
}
