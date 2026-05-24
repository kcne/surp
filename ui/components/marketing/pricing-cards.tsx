import Link from "next/link"
import { CheckCircle2, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

const plans = [
  {
    name: "Pocetni",
    description: "Za manje agencije koje zele digitalni pregled rezervacija.",
    price: "20 EUR",
    originalPrice: "30 EUR",
    priceNote: "Prvi mesec je besplatan",
    cardClassName: "border-emerald-100 bg-white",
    badgeClassName: "bg-emerald-100 text-emerald-700",
    buttonClassName: "bg-emerald-600 text-white hover:bg-emerald-500",
    checkClassName: "text-emerald-600",
    cta: "Pretplatite se",
    footerNote: "Prvi mesec besplatno",
    features: [
      "Neogranicen broj stanica",
      "Do 10 aktivnih linija",
      "Do 10 korisnickih racuna",
      "Email podrska",
    ],
  },
  {
    name: "Napredni",
    description: "Za agencije koje zele javni sajt, online rezervacije i izvestaje.",
    price: "30 EUR",
    originalPrice: "50 EUR",
    priceNote: "Prvi mesec je besplatan",
    cardClassName: "border-indigo-100 bg-white",
    badgeClassName: "bg-[color:var(--mk-indigo-600)] text-white",
    buttonClassName: "bg-[color:var(--mk-indigo-600)] text-white hover:bg-[color:var(--mk-indigo-500)]",
    checkClassName: "text-indigo-600",
    cta: "Pretplatite se",
    footerNote: "Prvi mesec besplatno",
    features: [
      "Sve iz Pocetnog",
      "Neogranicen broj linija",
      "Neogranicen broj korisnickih racuna",
      "Live podrska na zahtev",
      "Integracije na zahtev",
    ],
    highlighted: true,
  },
  {
    name: "Po meri",
    description: "Za vise brendova, posebne procese i napredne integracije.",
    price: "Po dogovoru",
    priceNote: "Personalizovana ponuda nakon demo razgovora",
    cardClassName: "border-amber-100 bg-white",
    badgeClassName: "bg-amber-100 text-amber-700",
    buttonClassName: "bg-amber-500 text-white hover:bg-amber-400",
    checkClassName: "text-amber-600",
    cta: "Zatrazite ponudu",
    footerNote: "Ponuda prema potrebama agencije",
    features: [
      "Sve iz Naprednog",
      "Vise agencija",
      "Integracije vasih API-ja",
      "Prioritetna podrska",
      "Mogucnost vaseg hostinga, servera i baze",
    ],
  },
]

export function PricingCards({ compact = false }: { compact?: boolean }) {
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {plans.map((plan) => {
        const card = (
          <article
            className={cn(
              "relative flex min-h-[27rem] flex-col rounded-3xl border p-6 shadow-mk-sm transition duration-300 hover:-translate-y-1 hover:shadow-mk-lg",
              plan.cardClassName
            )}
          >
            {plan.highlighted ? (
              <div className={cn("absolute -top-4 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold shadow-mk-glow", plan.badgeClassName)}>
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-white opacity-70 animate-pulse-soft motion-reduce:animate-none" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                </span>
                <Sparkles className="h-3.5 w-3.5" />
                Najpopularniji
              </div>
            ) : null}
            <h3 className="font-display text-2xl font-semibold tracking-[-0.02em] text-[color:var(--mk-navy-900)]">{plan.name}</h3>
            <p className="mt-3 text-sm leading-6 text-[color:var(--mk-text-muted)]">{plan.description}</p>
            <div className="mt-6 flex items-baseline gap-3">
              {"originalPrice" in plan ? (
                <span className="font-display text-xl font-semibold tracking-[-0.02em] text-[color:var(--mk-text-subtle)] line-through">
                  {plan.originalPrice}
                </span>
              ) : null}
              <p className="font-display text-3xl font-semibold tracking-[-0.02em] text-[color:var(--mk-navy-900)]">
                {plan.price}
              </p>
            </div>
            <p className="mt-1 text-xs text-[color:var(--mk-text-subtle)]">{plan.priceNote}</p>
            <ul className={cn("mt-6 space-y-3", compact && "hidden sm:block")}>
              {plan.features.map((feature) => (
                <li key={feature} className="flex gap-3 text-sm text-[color:var(--mk-text-muted)]">
                  <CheckCircle2 className={cn("h-5 w-5 shrink-0", plan.checkClassName)} />
                  {feature}
                </li>
              ))}
            </ul>
            <div className="mt-auto pt-7">
              <Link
                href="/kontakt"
                className={cn(
                  "inline-flex min-h-11 w-full items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--mk-indigo-600)] focus-visible:ring-offset-2",
                   plan.buttonClassName
                )}
              >
                {plan.cta}
              </Link>
              <p className="mt-3 text-center text-[11px] font-medium text-[color:var(--mk-text-subtle)]">
                {plan.footerNote}
              </p>
            </div>
          </article>
        )

        return plan.highlighted ? (
          <div key={plan.name} className="rounded-[1.6rem] border border-indigo-100 bg-white p-[1px] shadow-mk-sm lg:scale-[1.03]">
            {card}
          </div>
        ) : (
          <div key={plan.name}>{card}</div>
        )
      })}
    </div>
  )
}
