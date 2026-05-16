import Link from "next/link"
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
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--mk-indigo-600)]">
          Social proof
        </p>
        <h2 className="mt-4 font-display text-4xl font-semibold tracking-[-0.025em] text-[color:var(--mk-navy-900)] md:text-5xl">
          Napravljeno uz realne operativne tokove.
        </h2>
        <p className="mt-4 text-lg leading-8 text-[color:var(--mk-text-muted)]">
          Prvi javni case study-ji dolaze nakon pilot implementacija. Do tada
          koristimo validirane operativne scenarije iz proizvoda.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        {testimonials.map((testimonial, index) => (
          <article
            key={testimonial.name}
            className="relative rounded-3xl border border-[color:var(--mk-border)] bg-[color:var(--mk-bg-alt)] p-6 shadow-mk-sm"
            style={{ transform: `rotate(${index === 1 ? 0.6 : index === 2 ? -0.4 : 0.3}deg)` }}
          >
            <span className="absolute right-6 top-4 font-display text-6xl text-[color:var(--mk-indigo-100)]">&ldquo;</span>
            <p className="relative text-base leading-7 text-[color:var(--mk-navy-900)]">{testimonial.quote}</p>
            <div className="mt-6 border-t border-[color:var(--mk-border)] pt-5">
              <p className="font-semibold text-[color:var(--mk-navy-900)]">{testimonial.name}</p>
              <p className="text-sm text-[color:var(--mk-text-muted)]">{testimonial.company}</p>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-10 text-center">
        <Link href="/kontakt" className="text-sm font-semibold text-[color:var(--mk-indigo-600)] hover:underline">
          Budite prvi javni case study partner →
        </Link>
      </div>
    </MarketingSection>
  )
}
