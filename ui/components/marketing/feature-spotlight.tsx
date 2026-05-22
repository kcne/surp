import Link from "next/link"
import { ArrowRight, Building2, CheckCircle2, Globe2, LayoutDashboard, ShieldCheck, Ticket } from "lucide-react"
import { MarketingSection } from "@/components/marketing/section"
import { cn } from "@/lib/utils"

type FeatureSpotlightProps = {
  eyebrow: string
  title: string
  description: string
  bullets: string[]
  cta: string
  href: string
  dark?: boolean
  reverse?: boolean
  visual?: "dashboard" | "storefront" | "multi-agency"
}

export function FeatureSpotlight({
  eyebrow,
  title,
  description,
  bullets,
  cta,
  href,
  dark = false,
  reverse = false,
  visual = "dashboard",
}: FeatureSpotlightProps) {
  return (
    <MarketingSection className={cn(dark ? "mk-noise-bg mk-gradient-divider bg-[color:var(--mk-navy-900)] text-white" : "bg-white")}>
      <div className={cn("grid items-center gap-12 lg:grid-cols-2", reverse && "lg:[&>*:first-child]:order-2")}>
        <div>
          <p className={cn("text-xs font-bold uppercase tracking-[0.16em]", dark ? "text-[color:var(--mk-indigo-100)]" : "text-[color:var(--mk-indigo-600)]")}>
            {eyebrow}
          </p>
          <h2 className={cn("mt-4 font-display text-4xl font-semibold tracking-[-0.025em] md:text-5xl", dark ? "text-white" : "text-[color:var(--mk-navy-900)]")}>
            {title}
          </h2>
          <p className={cn("mt-5 text-lg leading-8", dark ? "text-slate-300" : "text-[color:var(--mk-text-muted)]")}>
            {description}
          </p>
          <ul className="mt-7 space-y-3">
            {bullets.map((bullet) => (
              <li key={bullet} className={cn("flex gap-3 text-sm leading-6", dark ? "text-slate-200" : "text-[color:var(--mk-text-muted)]")}>
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--mk-success)]" />
                {bullet}
              </li>
            ))}
          </ul>
          <Link
            href={href}
            className={cn(
              "mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
              dark
                ? "bg-white text-[color:var(--mk-navy-900)] focus-visible:ring-white focus-visible:ring-offset-[color:var(--mk-navy-900)]"
                : "bg-[color:var(--mk-indigo-600)] text-white shadow-mk-glow focus-visible:ring-[color:var(--mk-indigo-600)]"
            )}
          >
            {cta}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {visual === "storefront" ? (
          <StorefrontReservationCard />
        ) : visual === "multi-agency" ? (
          <MultiAgencyPanelCard />
        ) : (
          <MockDashboardCard dark={dark} />
        )}
      </div>
    </MarketingSection>
  )
}

function StorefrontReservationCard() {
  const departures = [
    { time: "08:30", route: "Beograd - Novi Sad", reservations: 24 },
    { time: "12:15", route: "Novi Pazar - Beograd", reservations: 18 },
    { time: "17:45", route: "Beograd - Zlatibor", reservations: 31 },
  ]
  const reservationSteps = [
    { label: "Putnik vidi izlog", value: "surp.rs/drina-bus", icon: Globe2 },
    { label: "Rezervise kartu", value: "Beograd - Novi Sad", icon: Ticket },
    { label: "Tim vidi odmah", value: "Operativni panel", icon: LayoutDashboard },
  ]

  return (
    <div className="relative">
      <div className="absolute -inset-5 -z-10 rounded-[2rem] bg-gradient-to-br from-[color:var(--mk-indigo-600)]/25 via-[color:var(--mk-sky-500)]/15 to-emerald-300/20 blur-2xl" />
      <div className="rounded-[1.75rem] border border-indigo-100 bg-white p-3 shadow-mk-glow">
        <div className="overflow-hidden rounded-[1.35rem] border border-[color:var(--mk-border)] bg-white">
          <div
            className="relative overflow-hidden p-5 text-white"
            style={{
              backgroundImage:
                "linear-gradient(135deg, rgba(15, 23, 42, 0.84), rgba(79, 70, 229, 0.58)), url('https://images.unsplash.com/photo-1572675339312-3e8b094a544d?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D')",
              backgroundPosition: "center",
              backgroundSize: "cover",
            }}
          >
            <div className="relative flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/70">Javni izlog</p>
                <p className="mt-1 font-display text-2xl font-semibold">Drina Bus online</p>
              </div>
              <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-right text-xs font-bold text-white">
                Optimizovano za online vidljivost
              </span>
            </div>
            <div className="relative mt-5 grid gap-2">
              {departures.map((departure) => (
                <div key={`${departure.time}-${departure.route}`} className="flex items-center justify-between gap-3 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-white shadow-mk-sm">
                  <div>
                    <p className="font-display text-2xl font-semibold tabular-nums">{departure.time}</p>
                    <p className="text-xs font-semibold text-white/75">{departure.route}</p>
                  </div>
                  <div className="rounded-2xl border border-white/20 bg-white/10 px-3 py-2 text-right">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/65">Online</p>
                    <p className="font-display text-xl font-semibold text-white">{departure.reservations} rez.</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 p-5">
            {reservationSteps.map((step) => {
              const Icon = step.icon

              return (
                <div key={step.label} className="flex items-center gap-3 rounded-2xl bg-[color:var(--mk-bg-alt)] p-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[color:var(--mk-navy-900)]">{step.label}</p>
                    <p className="truncate text-xs font-semibold text-[color:var(--mk-text-muted)]">{step.value}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function MultiAgencyPanelCard() {
  const agencies = [
    { name: "Drina Bus", routes: 18, reservations: 142, color: "bg-emerald-400" },
    { name: "Adria Tours", routes: 11, reservations: 87, color: "bg-sky-400" },
    { name: "BalkanGo", routes: 9, reservations: 64, color: "bg-violet-400" },
  ]
  const departures = [
    { agency: "Drina Bus", route: "Novi Pazar - Beograd", time: "08:00" },
    { agency: "Adria Tours", route: "Beograd - Budva", time: "12:30" },
    { agency: "BalkanGo", route: "Nis - Sarajevo", time: "17:15" },
  ]

  return (
    <div className="relative">
      <div className="absolute -inset-5 -z-10 rounded-[2rem] bg-gradient-to-br from-indigo-400/25 via-sky-300/15 to-emerald-300/15 blur-2xl" />
      <div className="rounded-[1.75rem] border border-white/10 bg-white/10 p-3 shadow-mk-glow">
        <div className="overflow-hidden rounded-[1.35rem] border border-white/10 bg-slate-950/80 text-white">
          <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-sky-200">
                <LayoutDashboard className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-sky-200/80">Administrativni panel</p>
                <p className="font-display text-xl font-semibold">Sve agencije na jednom mestu</p>
              </div>
            </div>
            <span className="rounded-full border border-emerald-300/30 bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-200">
              Cist pregled
            </span>
          </div>

          <div className="grid gap-4 p-5 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-3">
              {agencies.map((agency) => (
                <div key={agency.name} className="rounded-2xl border border-white/10 bg-white/6 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${agency.color}`} />
                      <p className="text-sm font-bold">{agency.name}</p>
                    </div>
                    <Building2 className="h-4 w-4 text-white/45" />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl bg-white/8 p-2">
                      <p className="text-white/50">Polasci</p>
                      <p className="mt-1 font-display text-lg font-semibold">{agency.routes}</p>
                    </div>
                    <div className="rounded-xl bg-white/8 p-2">
                      <p className="text-white/50">Rezervacije</p>
                      <p className="mt-1 font-display text-lg font-semibold">{agency.reservations}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <div className="rounded-2xl border border-white/10 bg-white/6 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-bold text-white">
                  <ShieldCheck className="h-4 w-4 text-emerald-300" />
                  Podaci su razdvojeni po agenciji
                </div>
                <div className="space-y-2">
                  {departures.map((departure) => (
                    <div key={`${departure.agency}-${departure.time}`} className="rounded-xl bg-white/8 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold text-sky-200">{departure.agency}</p>
                        <p className="font-display text-lg font-semibold tabular-nums">{departure.time}</p>
                      </div>
                      <p className="mt-1 text-sm text-white/75">{departure.route}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/6 p-3">
                  <p className="text-xs font-semibold text-white/55">Prodaja danas</p>
                  <p className="mt-1 font-display text-2xl font-semibold">293</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/6 p-3">
                  <p className="text-xs font-semibold text-white/55">Aktivne agencije</p>
                  <p className="mt-1 font-display text-2xl font-semibold">3</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function MockDashboardCard({ dark }: { dark: boolean }) {
  return (
      <div className="relative">
      <div className="absolute -inset-5 -z-10 rounded-[2rem] bg-gradient-to-br from-[color:var(--mk-indigo-600)]/25 to-[color:var(--mk-sky-500)]/10 blur-2xl" />
      <div className={cn("rounded-[1.75rem] border p-3 shadow-mk-glow backdrop-blur", dark ? "mk-surface-dark" : "border-white bg-white/80")}>
        <div className="rounded-[1.35rem] border border-[color:var(--mk-border)] bg-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--mk-text-subtle)]">Storefront</p>
              <p className="mt-1 font-display text-2xl font-semibold text-[color:var(--mk-navy-900)]">Beograd - Novi Sad</p>
            </div>
            <span className="rounded-full bg-[color:var(--mk-indigo-100)] px-3 py-1 text-xs font-semibold text-[color:var(--mk-indigo-600)]">
              Online
            </span>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {["Polazak", "Mesta", "Rezervacije"].map((label, index) => (
              <div key={label} className="rounded-2xl bg-[color:var(--mk-bg-alt)] p-4">
                <p className="text-xs text-[color:var(--mk-text-subtle)]">{label}</p>
                <p className="mt-2 font-display text-2xl font-semibold tabular-nums text-[color:var(--mk-navy-900)]">
                  {index === 0 ? "08:30" : index === 1 ? "52" : "41"}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-6 h-28 rounded-2xl bg-[linear-gradient(135deg,rgba(79,70,229,0.12),rgba(14,165,233,0.12))] p-4">
            <div className="flex h-full items-end gap-2">
              {[38, 62, 48, 74, 58, 86, 69].map((height, index) => (
                <div key={index} className="flex-1 rounded-t-lg bg-[color:var(--mk-indigo-600)]/70" style={{ height: `${height}%` }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
