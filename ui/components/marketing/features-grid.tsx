import Image from "next/image"
import { BarChart3, Calendar, Route, Ticket, Users } from "lucide-react"
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
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[color:var(--mk-indigo-100)] text-[color:var(--mk-indigo-600)]">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="font-display text-xl font-semibold tracking-[-0.015em] text-[color:var(--mk-navy-900)]">
                  {feature.title}
                </h3>
              </div>
              {feature.title !== "Linije i stanice" ? <FeatureVisual title={feature.title} /> : null}
              <p className="mt-3 text-sm leading-6 text-[color:var(--mk-text-muted)]">{feature.description}</p>
              {feature.title === "Linije i stanice" ? <LinesScreenshot /> : null}
            </article>
          )
        })}
      </div>
    </MarketingSection>
  )
}

function LinesScreenshot() {
  return (
    <div className="mt-5 overflow-hidden rounded-2xl border border-[color:var(--mk-border)] bg-white shadow-mk-sm">
      <Image
        src="/landing/red-voznje.png"
        alt="Screenshot uredjivanja linije i medjustanica u SURP platformi"
        width={1560}
        height={1470}
        className="h-auto w-full"
      />
    </div>
  )
}

function FeatureVisual({ title }: { title: string }) {
  if (title === "Vozni redovi") {
    const departures = [
      { day: "P", time: "08:00" },
      { day: "U", time: "14:45" },
      { day: "S", time: "09:30" },
      { day: "C", time: "16:15" },
      { day: "P", time: "11:20" },
    ]

    return (
      <div className="mb-5 grid grid-cols-5 gap-1.5">
        {departures.map((departure, index) => (
          <div key={`${departure.day}-${departure.time}`} className="rounded-xl bg-[color:var(--mk-bg-alt)] p-2 text-center">
            <p className="text-[10px] font-black text-[color:var(--mk-navy-900)]">{departure.day}</p>
            <p className="mt-2 text-[10px] font-extrabold tabular-nums text-[color:var(--mk-indigo-600)]">
              {departure.time}
            </p>
            <div className={cn("mx-auto mt-2 h-1.5 w-6 rounded-full", index % 2 ? "bg-[color:var(--mk-sky-500)]/50" : "bg-[color:var(--mk-indigo-600)]/70")} />
          </div>
        ))}
      </div>
    )
  }

  if (title === "Rezervacije") {
    const seats = [
      "free",
      "paid",
      "free",
      "blocked",
      "paid",
      "free",
      "held",
      "blocked",
      "held",
      "paid",
      "free",
      "held",
      "held",
      "free",
      "paid",
      "blocked",
      "free",
      "held",
      "paid",
      "free",
      "held",
      "blocked",
      "free",
      "paid",
    ]

    return (
      <div className="mb-5 grid grid-cols-6 gap-1.5">
        {seats.map((seatStatus, index) => (
          <span
            key={index}
            className={cn(
              "h-5 rounded-md",
              seatStatus === "free" ? "bg-indigo-100" : "",
              seatStatus === "held" ? "bg-indigo-500/70" : "",
              seatStatus === "paid" ? "bg-emerald-400" : "",
              seatStatus === "blocked" ? "bg-red-400" : ""
            )}
          />
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

  if (title === "Izvestaji") {
    return (
      <div className="mb-5 rounded-2xl bg-[color:var(--mk-bg-alt)] p-3">
        <svg
          viewBox="0 0 260 112"
          role="img"
          aria-label="Graf prihoda i popunjenosti po danima"
          className="h-28 w-full"
        >
          <defs>
            <linearGradient id="revenue-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.36" />
              <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id="occupancy-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.01" />
            </linearGradient>
          </defs>
          {[22, 48, 74].map((y) => (
            <line key={y} x1="8" x2="252" y1={y} y2={y} stroke="#e2e8f0" strokeDasharray="4 4" />
          ))}
          <path
            d="M10 78 C34 70 42 58 62 62 C82 66 92 45 112 48 C136 52 145 31 166 34 C190 37 198 20 222 24 C238 26 246 18 252 16 L252 102 L10 102 Z"
            fill="url(#occupancy-fill)"
          />
          <path
            d="M10 82 C32 76 42 64 62 68 C84 72 94 52 114 56 C136 60 146 38 168 42 C190 46 202 28 222 31 C238 33 246 22 252 24 L252 102 L10 102 Z"
            fill="url(#revenue-fill)"
          />
          <path
            d="M10 78 C34 70 42 58 62 62 C82 66 92 45 112 48 C136 52 145 31 166 34 C190 37 198 20 222 24 C238 26 246 18 252 16"
            fill="none"
            stroke="#0ea5e9"
            strokeLinecap="round"
            strokeWidth="3"
          />
          <path
            d="M10 82 C32 76 42 64 62 68 C84 72 94 52 114 56 C136 60 146 38 168 42 C190 46 202 28 222 31 C238 33 246 22 252 24"
            fill="none"
            stroke="#4f46e5"
            strokeLinecap="round"
            strokeWidth="4"
          />
          {[10, 62, 114, 168, 222, 252].map((x, index) => (
            <circle key={x} cx={x} cy={[82, 68, 56, 42, 31, 24][index]} r="3.5" fill="#4f46e5" />
          ))}
          {["Pon", "Uto", "Sre", "Cet", "Pet", "Sub"].map((day, index) => (
            <text
              key={day}
              x={[10, 58, 106, 154, 202, 246][index]}
              y="110"
              fill="#64748b"
              fontSize="10"
              fontWeight="700"
              textAnchor="middle"
            >
              {day}
            </text>
          ))}
        </svg>
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
