import Link from "next/link"
import { ArrowRight, CheckCircle2 } from "lucide-react"
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

        <MockDashboardCard dark={dark} />
      </div>
    </MarketingSection>
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
