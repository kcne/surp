import Link from "next/link"
import { CheckCircle2, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

const plans = [
  {
    name: "Starter",
    description: "Za manje agencije koje zele digitalni pregled rezervacija.",
    features: ["Linije i stanice", "Osnovne rezervacije", "Email podrska"],
  },
  {
    name: "Pro",
    description: "Za agencije koje zele javni sajt, online rezervacije i izvestaje.",
    features: ["Sve iz Starter", "Javni storefront", "Izvestaji i analitika", "Prioritetna podrska"],
    highlighted: true,
  },
  {
    name: "Enterprise",
    description: "Za vise brendova, posebne procese i napredne integracije.",
    features: ["Vise tenant-a", "Custom integracije", "SLA i onboarding", "Dedicated podrska"],
  },
]

export function PricingCards({ compact = false }: { compact?: boolean }) {
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {plans.map((plan) => {
        const card = (
          <article
            className={cn(
              "relative flex min-h-[27rem] flex-col rounded-3xl bg-white p-6 shadow-mk-sm transition duration-300 hover:-translate-y-1 hover:shadow-mk-lg",
              plan.highlighted ? "border border-transparent" : "border border-[color:var(--mk-border)]"
            )}
          >
            {plan.highlighted ? (
              <div className="absolute -top-4 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-[color:var(--mk-indigo-600)] px-3 py-1 text-xs font-semibold text-white shadow-mk-glow">
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
            <p className="mt-6 font-display text-3xl font-semibold tracking-[-0.02em] text-[color:var(--mk-navy-900)]">
              Po dogovoru
            </p>
            <p className="mt-1 text-xs text-[color:var(--mk-text-subtle)]">Personalizovana ponuda nakon demo razgovora</p>
            <ul className={cn("mt-6 space-y-3", compact && "hidden sm:block")}>
              {plan.features.map((feature) => (
                <li key={feature} className="flex gap-3 text-sm text-[color:var(--mk-text-muted)]">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-[color:var(--mk-success)]" />
                  {feature}
                </li>
              ))}
            </ul>
            <div className="mt-auto pt-7">
              <Link
                href="/kontakt"
                className={cn(
                  "inline-flex min-h-11 w-full items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--mk-indigo-600)] focus-visible:ring-offset-2",
                  plan.highlighted
                    ? "bg-[color:var(--mk-indigo-600)] text-white hover:bg-[color:var(--mk-indigo-500)]"
                    : "border border-[color:var(--mk-border)] bg-white text-[color:var(--mk-navy-900)] hover:border-[color:var(--mk-indigo-100)]"
                )}
              >
                Zakazite demo
              </Link>
              <p className="mt-3 text-center text-[11px] font-medium text-[color:var(--mk-text-subtle)]">
                Bez ugovorne obaveze za demo
              </p>
            </div>
          </article>
        )

        return plan.highlighted ? (
          <div key={plan.name} className="mk-gradient-ring animate-gradient-border rounded-[1.6rem] p-[1px] motion-reduce:animate-none lg:scale-[1.03]">
            {card}
          </div>
        ) : (
          <div key={plan.name}>{card}</div>
        )
      })}
    </div>
  )
}
