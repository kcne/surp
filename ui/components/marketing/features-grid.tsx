import { BarChart3, Calendar, Globe, Route, Ticket, Users } from "lucide-react"
import { MarketingSection } from "@/components/marketing/section"
import { cn } from "@/lib/utils"

const features = [
  {
    title: "Linije i stanice",
    description: "Definisite mrezu, redosled stanica, distance i cene po segmentu.",
    icon: Route,
    className: "lg:col-span-2 lg:row-span-2",
  },
  {
    title: "Vozni redovi",
    description: "Rasporedi po danima, sezonske varijacije i ad-hoc polasci.",
    icon: Calendar,
  },
  {
    title: "Rezervacije",
    description: "Manuelno i online, uz pregled zauzeca po polasku.",
    icon: Ticket,
  },
  {
    title: "Putnici",
    description: "Baza putnika, istorija rezervacija i spremna osnova za loyalty.",
    icon: Users,
  },
  {
    title: "Javni sajt agencije",
    description: "Brendirani storefront sa SEO osnovama i online rezervacijama.",
    icon: Globe,
    className: "lg:col-span-2",
  },
  {
    title: "Izvestaji",
    description: "Prihodi po liniji, popunjenost i top destinacije na jednom mestu.",
    icon: BarChart3,
  },
]

export function FeaturesGrid() {
  return (
    <MarketingSection id="funkcije" className="bg-[color:var(--mk-bg-alt)]">
      <div className="mx-auto mb-14 max-w-3xl text-center">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--mk-indigo-600)]">
          Funkcije
        </p>
        <h2 className="mt-4 font-display text-4xl font-semibold tracking-[-0.025em] text-[color:var(--mk-navy-900)] md:text-5xl">
          Sve sto vam treba za vodjenje agencije
        </h2>
        <p className="mt-4 text-lg leading-8 text-[color:var(--mk-text-muted)]">
          Od prvog kontakta putnika do izvestaja posle polaska, SURP spaja
          operativni rad i online prodaju u jedan pregledan sistem.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {features.map((feature) => {
          const Icon = feature.icon

          return (
            <article
              key={feature.title}
              className={cn(
                "group mk-surface rounded-3xl p-6 transition duration-300 hover:-translate-y-1 hover:border-[color:var(--mk-indigo-100)] hover:shadow-mk-lg",
                feature.className
              )}
            >
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[color:var(--mk-indigo-100)] text-[color:var(--mk-indigo-600)]">
                <Icon className="h-6 w-6" />
              </div>
              <FeatureVisual title={feature.title} />
              <h3 className="font-display text-xl font-semibold tracking-[-0.015em] text-[color:var(--mk-navy-900)]">
                {feature.title}
              </h3>
              <p className="mt-3 text-sm leading-6 text-[color:var(--mk-text-muted)]">{feature.description}</p>
            </article>
          )
        })}
      </div>
    </MarketingSection>
  )
}

function FeatureVisual({ title }: { title: string }) {
  if (title === "Linije i stanice") {
    return (
      <div className="mb-8 mt-3 rounded-2xl border border-[color:var(--mk-border)] bg-[color:var(--mk-bg-alt)] p-5">
        <div className="flex items-center justify-between text-xs font-semibold text-[color:var(--mk-text-subtle)]">
          <span>BG</span>
          <span>NS</span>
          <span>SU</span>
        </div>
        <div className="relative mt-5 h-2 rounded-full bg-[color:var(--mk-indigo-100)]">
          <div className="absolute left-0 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-[color:var(--mk-indigo-600)] shadow-mk-glow" />
          <div className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[color:var(--mk-sky-500)]" />
          <div className="absolute right-0 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-[color:var(--mk-navy-900)]" />
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2 text-center text-[11px] font-semibold text-[color:var(--mk-text-muted)]">
          <span>08:30</span>
          <span>09:45</span>
          <span>11:10</span>
        </div>
      </div>
    )
  }

  if (title === "Vozni redovi") {
    return (
      <div className="mb-5 grid grid-cols-5 gap-1.5">
        {["P", "U", "S", "C", "P"].map((day, index) => (
          <div key={day} className="rounded-xl bg-[color:var(--mk-bg-alt)] p-2 text-center">
            <p className="text-[10px] font-bold text-[color:var(--mk-text-subtle)]">{day}</p>
            <div className={cn("mx-auto mt-2 h-8 w-2 rounded-full", index % 2 ? "bg-[color:var(--mk-sky-500)]/50" : "bg-[color:var(--mk-indigo-600)]/70")} />
          </div>
        ))}
      </div>
    )
  }

  if (title === "Rezervacije") {
    return (
      <div className="mb-5 grid grid-cols-6 gap-1.5">
        {Array.from({ length: 18 }).map((_, index) => (
          <span key={index} className={cn("h-5 rounded-md", index < 13 ? "bg-[color:var(--mk-indigo-600)]/70" : "bg-[color:var(--mk-indigo-100)]")} />
        ))}
      </div>
    )
  }

  if (title === "Putnici") {
    return (
      <div className="mb-5 space-y-2">
        {["Ana P.", "Milan R.", "Jelena S."].map((name, index) => (
          <div key={name} className="flex items-center gap-2 rounded-xl bg-[color:var(--mk-bg-alt)] p-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[color:var(--mk-indigo-100)] text-[11px] font-bold text-[color:var(--mk-indigo-600)]">{index + 1}</span>
            <span className="text-xs font-semibold text-[color:var(--mk-text-muted)]">{name}</span>
          </div>
        ))}
      </div>
    )
  }

  if (title === "Javni sajt agencije") {
    return (
      <div className="mb-5 rounded-2xl border border-[color:var(--mk-border)] bg-[color:var(--mk-bg-alt)] p-3">
        <div className="h-16 rounded-xl bg-gradient-to-br from-[color:var(--mk-indigo-600)]/20 to-[color:var(--mk-sky-500)]/20" />
        <div className="mt-3 h-2 w-2/3 rounded-full bg-[color:var(--mk-navy-900)]/20" />
        <div className="mt-2 h-2 w-1/2 rounded-full bg-[color:var(--mk-indigo-600)]/25" />
      </div>
    )
  }

  return (
    <div className="mb-5 flex h-20 items-end gap-1.5 rounded-2xl bg-[color:var(--mk-bg-alt)] p-3">
      {[36, 58, 44, 74, 62, 88].map((height) => (
        <span key={height} className="flex-1 rounded-t-lg bg-[color:var(--mk-indigo-600)]/70" style={{ height: `${height}%` }} />
      ))}
    </div>
  )
}
