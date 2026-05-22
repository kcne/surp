import { ClipboardList, PhoneCall, TriangleAlert } from "lucide-react"
import { MarketingSection } from "@/components/marketing/section"

const problems = [
  {
    icon: ClipboardList,
    title: "Nema centralizovanog izvora podataka za rezervacije",
    description: "Tabele, poruke, pozivi i papiri su skloni greskama i teski za sinhronizaciju.",
  },
  {
    icon: TriangleAlert,
    title: "Putnici ne prastaju greske",
    description: "Putnici planiraju polaske unapred, zato greske u rezervacijama brzo postaju skupe i vidljive.",
  },
  {
    icon: PhoneCall,
    title: "Putnici ocekuju online rezervacije",
    description: "Niko ne zeli da zove, salje poruke ili dolazi u agenciju ako mesto moze da rezervise online za par minuta.",
  },
]

export function ProblemFraming() {
  return (
    <MarketingSection>
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-red-500">
          Problem
        </p>
        <h2 className="mt-4 font-display text-4xl font-semibold tracking-[-0.025em] text-red-950 md:text-5xl">
          Tabele, poruke i pozivi nisu sistem na koji mozete da se oslonite.
        </h2>
        <p className="mt-4 text-lg leading-8 text-[color:var(--mk-text-muted)]">
          Sta najcesce usporava autobuske agencije kada poraste broj linija,
          rezervacija i prodajnih kanala?
        </p>
      </div>

      <div className="mt-14 grid gap-5 md:grid-cols-3">
        {problems.map((problem) => {
          const Icon = problem.icon

          return (
              <article key={problem.title} className="rounded-3xl border border-[color:var(--mk-border)] bg-white p-6 shadow-mk-sm">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
                  <Icon className="h-6 w-6" />
                </div>
              <h3 className="font-display text-xl font-semibold tracking-[-0.015em] text-red-950">
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
