import Link from "next/link"
import { ArrowRight, CheckCircle2, PlayCircle } from "lucide-react"
import { HeroVideo } from "@/components/marketing/hero-video"

const trustItems = ["Bez kreditne kartice", "Demo traje 30 min", "Implementacija do 14 dana"]

export function MarketingHero() {
  return (
    <section className="relative isolate overflow-hidden bg-[color:var(--mk-bg)] pt-24 md:pt-32">
        <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute right-[-10%] top-[-12%] h-[34rem] w-[34rem] rounded-full bg-[radial-gradient(circle_at_center,rgba(79,70,229,0.22),transparent_62%)] blur-2xl" />
        <div className="absolute bottom-[-18%] left-[-12%] h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle_at_center,rgba(14,165,233,0.16),transparent_62%)] blur-2xl" />
        <div className="absolute inset-0 opacity-[0.05] [background-image:radial-gradient(#0B1220_1px,transparent_1px)] [background-size:24px_24px]" />
      </div>

      <div className="mx-auto flex w-full max-w-7xl flex-col items-center px-6 pb-20 md:px-8 md:pb-28 lg:px-12">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex items-center rounded-full border border-[color:var(--mk-indigo-100)] bg-white/80 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--mk-indigo-600)] shadow-mk-sm">
            Platforma za autobuske agencije
          </div>
          <h1 className="font-display text-5xl font-bold tracking-[-0.035em] text-[color:var(--mk-navy-900)] sm:text-6xl lg:text-7xl">
            Sve operacije vase agencije na{" "}
            <span className="bg-gradient-to-r from-[color:var(--mk-indigo-600)] via-[color:var(--mk-indigo-500)] to-[color:var(--mk-sky-500)] bg-clip-text text-transparent">
              jednom mestu.
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-[color:var(--mk-text-muted)] md:text-xl">
            Linije, vozni redovi, rezervacije, putnici i agencijski sajt - SURP
            zamenjuje pet alata jednim sistemom.
          </p>

          <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
            <span className="mk-gradient-ring animate-gradient-border inline-flex w-full rounded-full p-[1px] motion-reduce:animate-none sm:w-auto">
              <Link
                href="/kontakt"
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[color:var(--mk-indigo-600)] px-6 py-3 text-sm font-semibold text-white shadow-mk-glow transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--mk-indigo-600)] focus-visible:ring-offset-2 sm:w-auto"
              >
                Zakazite demo
                <ArrowRight className="h-4 w-4" />
              </Link>
            </span>
            <Link
              href="/sandbox-demo"
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-[color:var(--mk-border)] bg-white px-6 py-3 text-sm font-semibold text-[color:var(--mk-navy-900)] shadow-mk-sm transition-colors hover:border-[color:var(--mk-indigo-100)] hover:text-[color:var(--mk-indigo-600)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--mk-indigo-600)] focus-visible:ring-offset-2"
            >
              Isprobajte sandbox demo
              <PlayCircle className="ml-2 h-4 w-4" />
            </Link>
          </div>

          <ul className="mt-6 flex flex-col justify-center gap-3 text-sm text-[color:var(--mk-text-muted)] sm:flex-row sm:flex-wrap">
            <li className="flex items-center gap-2 rounded-full bg-white/70 pr-3">
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-pulse-soft motion-reduce:animate-none" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
              </span>
              Sandbox spreman za probu
            </li>
            {trustItems.map((item) => (
              <li key={item} className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[color:var(--mk-success)]" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative mt-14 w-full max-w-6xl">
          <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-[color:var(--mk-indigo-600)]/20 via-[color:var(--mk-sky-500)]/10 to-transparent blur-2xl" />
          <HeroVideo />
        </div>
      </div>
    </section>
  )
}
