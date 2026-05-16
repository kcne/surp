import { ClipboardList, PhoneCall, TriangleAlert } from "lucide-react"
import { MarketingSection } from "@/components/marketing/section"

const problems = [
  {
    icon: ClipboardList,
    title: "Rezervacije su rasute",
    description: "Excel, WhatsApp, pozivi i papiri ne daju jedan pouzdan pregled zauzeca.",
  },
  {
    icon: TriangleAlert,
    title: "Rizik dvostruke prodaje",
    description: "Kada vise ljudi prodaje ista mesta, greske postaju skupe i vidljive putnicima.",
  },
  {
    icon: PhoneCall,
    title: "Putnici ocekuju online",
    description: "Bez javnog sajta i online rezervacije, najvredniji intent odlazi konkurenciji.",
  },
]

export function ProblemFraming() {
  return (
    <MarketingSection>
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--mk-indigo-600)]">
          Problem
        </p>
        <h2 className="mt-4 font-display text-4xl font-semibold tracking-[-0.025em] text-[color:var(--mk-navy-900)] md:text-5xl">
          Excel, telefoni i blokcici nisu operativni sistem.
        </h2>
        <p className="mt-4 text-lg leading-8 text-[color:var(--mk-text-muted)]">
          Tradicionalni procesi rade dok je tim mali. Cim poraste broj linija,
          sezona ili prodajnih kanala, pregled se gubi.
        </p>
      </div>

      <div className="mt-14 grid gap-5 md:grid-cols-3">
        {problems.map((problem) => {
          const Icon = problem.icon

          return (
            <article key={problem.title} className="rounded-3xl border border-[color:var(--mk-border)] bg-white p-6 shadow-mk-sm">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-[color:var(--mk-navy-700)]">
                <Icon className="h-6 w-6" />
              </div>
              <h3 className="font-display text-xl font-semibold tracking-[-0.015em] text-[color:var(--mk-navy-900)]">
                {problem.title}
              </h3>
              <p className="mt-3 text-sm leading-6 text-[color:var(--mk-text-muted)]">{problem.description}</p>
            </article>
          )
        })}
      </div>
    </MarketingSection>
  )
}
