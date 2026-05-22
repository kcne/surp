import { BarChart3, Calendar, Route, Ticket, Users, type LucideIcon } from "lucide-react"
import { MarketingSection } from "@/components/marketing/section"
import { cn } from "@/lib/utils"

type Feature = {
  title: string
  description: string
  icon: LucideIcon
  titleClassName: string
  iconClassName: string
  cardClassName: string
  className?: string
  visualClassName?: string
  accentClassName?: string
  barClassName?: string
  mutedBarClassName?: string
}

const features: Feature[] = [
  {
    title: "Linije i stanice",
    description: "Definisite linije, stanice i cene po pravilima vase agencije. Vasi podaci, vasa kontrola.",
    icon: Route,
    titleClassName: "text-indigo-950",
    iconClassName: "bg-indigo-100 text-indigo-600",
    cardClassName: "border-indigo-100 bg-indigo-50/45 hover:border-indigo-200",
    visualClassName: "border-indigo-100 bg-white/85",
    className: "lg:col-span-2 lg:row-span-2",
  },
  {
    title: "Vozni redovi",
    description: "Rasporedi po danima, sezonske varijacije i ad-hoc polasci.",
    icon: Calendar,
    titleClassName: "text-sky-950",
    iconClassName: "bg-sky-100 text-sky-600",
    cardClassName: "border-sky-100 bg-sky-50/45 hover:border-sky-200",
    visualClassName: "bg-sky-100/65",
    accentClassName: "text-sky-700",
    barClassName: "bg-sky-500/70",
    mutedBarClassName: "bg-cyan-300/80",
  },
  {
    title: "Rezervacije",
    description: "Manuelno i online, uz pregled zauzeca po polasku.",
    icon: Ticket,
    titleClassName: "text-emerald-950",
    iconClassName: "bg-emerald-100 text-emerald-600",
    cardClassName: "border-emerald-100 bg-emerald-50/45 hover:border-emerald-200",
  },
  {
    title: "Putnici",
    description: "Baza putnika, istorija rezervacija i spremna osnova za loyalty.",
    icon: Users,
    titleClassName: "text-violet-950",
    iconClassName: "bg-violet-100 text-violet-600",
    cardClassName: "border-violet-100 bg-violet-50/45 hover:border-violet-200",
    visualClassName: "bg-violet-100/60",
    accentClassName: "bg-violet-200 text-violet-700",
  },
  {
    title: "Izvestaji",
    description: "Prihodi po liniji, popunjenost i top destinacije na jednom mestu.",
    icon: BarChart3,
    titleClassName: "text-amber-950",
    iconClassName: "bg-amber-100 text-amber-600",
    cardClassName: "border-amber-100 bg-amber-50/45 hover:border-amber-200",
    visualClassName: "bg-amber-100/55",
  },
]

export function FeaturesGrid() {
  return (
    <MarketingSection id="funkcije" className="bg-[color:var(--mk-bg-alt)]">
      <div className="mx-auto mb-14 max-w-3xl text-center">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--mk-indigo-600)]">
          Alati za autobuske agencije
        </p>
        <h2 className="mt-4 font-display text-4xl font-semibold tracking-[-0.025em] text-[color:var(--mk-navy-900)] md:text-5xl">
          Sta vam je potrebno za online vodjenje autobuske agencije
        </h2>
        <p className="mt-4 text-lg leading-8 text-[color:var(--mk-text-muted)]">
          Softver za autobuske agencije koji pomaze da upravljate rezervacijama,
          putnicima, polascima, linijama i prodajom karata preko interneta.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {features.map((feature) => {
          const Icon = feature.icon

          return (
            <article
              key={feature.title}
              className={cn(
                "group rounded-3xl border p-6 shadow-mk-sm transition duration-300 hover:-translate-y-1 hover:shadow-mk-lg",
                feature.cardClassName,
                feature.className
              )}
            >
              <div className="mb-5 flex items-center gap-3">
                <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl", feature.iconClassName)}>
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className={cn("font-display text-xl font-semibold tracking-[-0.015em]", feature.titleClassName)}>
                  {feature.title}
                </h3>
              </div>
              {feature.title !== "Linije i stanice" ? <FeatureVisual feature={feature} /> : null}
              <p className="mt-3 text-sm leading-6 text-[color:var(--mk-text-muted)]">{feature.description}</p>
              {feature.title === "Linije i stanice" ? <RouteTimeline className={feature.visualClassName} /> : null}
            </article>
          )
        })}
      </div>
    </MarketingSection>
  )
}

function RouteTimeline({ className }: { className?: string }) {
  const stops = [
    { name: "Novi Pazar", time: "08:00", reservations: 18 },
    { name: "Kraljevo", time: "10:15", reservations: 9 },
    { name: "Kragujevac", time: "11:30", reservations: 12 },
    { name: "Beograd", time: "14:00", reservations: 27 },
  ]

  return (
    <div className={cn("mt-5 rounded-2xl border p-4 shadow-mk-sm", className)}>
      <div className="mb-4 flex items-center justify-between rounded-2xl bg-indigo-50 px-4 py-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-500">Linija</p>
          <p className="mt-1 font-display text-lg font-semibold text-indigo-950">Novi Pazar - Beograd</p>
        </div>
        <div className="rounded-full bg-white px-3 py-1 text-xs font-bold text-indigo-700 shadow-mk-sm">
          66 rezervacija
        </div>
      </div>

      <div className="relative space-y-4">
        <div className="absolute bottom-6 left-[0.9rem] top-6 w-px bg-indigo-200" />
        {stops.map((stop, index) => (
          <div key={stop.name} className="relative flex items-center gap-3">
            <span className="z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[11px] font-black text-white shadow-mk-sm">
              {index + 1}
            </span>
            <div className="flex min-w-0 flex-1 items-center justify-between rounded-2xl bg-white px-3 py-2 shadow-mk-sm">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-indigo-950">{stop.name}</p>
                <p className="text-xs font-semibold text-indigo-500">{stop.time}</p>
              </div>
              <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-bold text-indigo-700">
                {stop.reservations} rez.
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function FeatureVisual({ feature }: { feature: Feature }) {
  if (feature.title === "Vozni redovi") {
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
          <div key={`${departure.day}-${departure.time}`} className={cn("rounded-xl p-2 text-center", feature.visualClassName)}>
            <p className="text-[10px] font-black text-sky-950">{departure.day}</p>
            <p className={cn("mt-2 text-[10px] font-extrabold tabular-nums", feature.accentClassName)}>
              {departure.time}
            </p>
            <div className={cn("mx-auto mt-2 h-1.5 w-6 rounded-full", index % 2 ? feature.mutedBarClassName : feature.barClassName)} />
          </div>
        ))}
      </div>
    )
  }

  if (feature.title === "Rezervacije") {
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
               seatStatus === "free" ? "bg-emerald-100" : "",
               seatStatus === "held" ? "bg-emerald-500/70" : "",
               seatStatus === "paid" ? "bg-teal-400" : "",
               seatStatus === "blocked" ? "bg-orange-300" : ""
            )}
          />
        ))}
      </div>
    )
  }

  if (feature.title === "Putnici") {
    return (
      <div className="mb-5 space-y-2">
        {["Ana P.", "Milan R.", "Jelena S."].map((name, index) => (
          <div key={name} className={cn("flex items-center gap-2 rounded-xl p-2", feature.visualClassName)}>
            <span className={cn("flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold", feature.accentClassName)}>{index + 1}</span>
            <span className="text-xs font-semibold text-violet-950/70">{name}</span>
          </div>
        ))}
      </div>
    )
  }

  if (feature.title === "Izvestaji") {
    return (
      <div className={cn("mb-5 rounded-2xl p-3", feature.visualClassName)}>
        <svg
          viewBox="0 0 260 112"
          role="img"
          aria-label="Graf prihoda i popunjenosti po danima"
          className="h-28 w-full"
        >
          <defs>
            <linearGradient id="revenue-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.36" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id="occupancy-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#f97316" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#f97316" stopOpacity="0.01" />
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
            stroke="#f97316"
            strokeLinecap="round"
            strokeWidth="3"
          />
          <path
            d="M10 82 C32 76 42 64 62 68 C84 72 94 52 114 56 C136 60 146 38 168 42 C190 46 202 28 222 31 C238 33 246 22 252 24"
            fill="none"
            stroke="#f59e0b"
            strokeLinecap="round"
            strokeWidth="4"
          />
          {[10, 62, 114, 168, 222, 252].map((x, index) => (
            <circle key={x} cx={x} cy={[82, 68, 56, 42, 31, 24][index]} r="3.5" fill="#f59e0b" />
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
