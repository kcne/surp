import Link from "next/link"
import { Star } from "lucide-react"
import { MarketingSection } from "@/components/marketing/section"

const testimonials = [
  {
    quote: "Konacno imamo jedan ekran gde vidimo polaske, putnike i zauzeca bez zvanja tri osobe.",
    name: "Operativni menadzer",
    company: "Regionalna autobuska agencija",
  },
  {
    quote: "Najveca vrednost je sto javni sajt i interna rezervacija ne zive odvojeno.",
    name: "Vlasnik agencije",
    company: "Medjugradski prevoznik",
  },
  {
    quote: "Implementacija je razumljiva i dovoljno brza da ne zaustavlja sezonu.",
    name: "Direktor prodaje",
    company: "Turisticki operater",
  },
]

export function Testimonials() {
  return (
    <MarketingSection className="bg-white">
      <div className="mx-auto mb-12 max-w-3xl text-center">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-500">
          Recenzije i iskustva
        </p>
        <h2 className="mt-4 font-display text-4xl font-semibold tracking-[-0.025em] text-[color:var(--mk-navy-900)] md:text-5xl">
          Sta agencije ocekuju od softvera za autobuske agencije
        </h2>
        <p className="mt-4 text-lg leading-8 text-[color:var(--mk-text-muted)]">
          Softver za agencije je napravljen oko svakodnevnih potreba: manje
          poziva, manje tabela, bolji pregled rezervacija i vise prodaje preko interneta.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        {testimonials.map((testimonial, index) => (
          <article
            key={testimonial.name}
            className="relative rounded-3xl border border-amber-200 bg-[color:var(--mk-bg-alt)] p-6 shadow-mk-sm ring-1 ring-amber-100"
            style={{ transform: `rotate(${index === 1 ? 0.6 : index === 2 ? -0.4 : 0.3}deg)` }}
          >
            <div className="mb-4 flex gap-1 text-amber-400">
              {Array.from({ length: 5 }).map((_, starIndex) => (
                <Star key={starIndex} className="h-4 w-4 fill-current" />
              ))}
            </div>
            <p className="relative text-base leading-7 text-[color:var(--mk-navy-900)]">
              &ldquo;{testimonial.quote}&rdquo;
            </p>
            <div className="mt-6 border-t border-[color:var(--mk-border)] pt-5">
              <p className="font-semibold text-[color:var(--mk-navy-900)]">{testimonial.name}</p>
              <p className="text-sm text-[color:var(--mk-text-muted)]">{testimonial.company}</p>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-10 text-center">
        <Link href="/kontakt" className="text-sm font-semibold text-amber-500 hover:text-amber-600 hover:underline">
          Zakazite razgovor za vasu agenciju →
        </Link>
      </div>
    </MarketingSection>
  )
}
