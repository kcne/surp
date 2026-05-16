import Link from "next/link"
import { ArrowRight, Mail } from "lucide-react"
import { MarketingSection } from "@/components/marketing/section"

export function CtaBand() {
  return (
    <MarketingSection className="mk-noise-bg mk-gradient-divider relative isolate overflow-hidden bg-[color:var(--mk-navy-900)] text-white">
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-[0.06] [background-image:radial-gradient(#ffffff_1px,transparent_1px)] [background-size:24px_24px]" />
      <div className="pointer-events-none absolute left-1/2 top-0 -z-10 h-72 w-72 -translate-x-1/2 rounded-full bg-[color:var(--mk-indigo-600)]/30 blur-3xl" />
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--mk-indigo-100)]">
          Demo
        </p>
        <h2 className="mt-4 font-display text-4xl font-semibold tracking-[-0.025em] md:text-5xl">
          Spremni da modernizujete svoju agenciju?
        </h2>
        <p className="mt-5 text-lg leading-8 text-slate-300">
          30 minuta demonstracije. Bez obaveze. Sa konkretnim odgovorom da li
          SURP odgovara vasem modelu rada.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <span className="mk-gradient-ring animate-gradient-border inline-flex rounded-full p-[1px] motion-reduce:animate-none">
            <Link
              href="/kontakt"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-[color:var(--mk-navy-900)] shadow-mk-glow transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--mk-navy-900)]"
            >
              Zakazite demo
              <ArrowRight className="h-4 w-4" />
            </Link>
          </span>
          <Link
            href="mailto:hello@surp.local"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--mk-navy-900)]"
          >
            Posaljite pitanje
            <Mail className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </MarketingSection>
  )
}
