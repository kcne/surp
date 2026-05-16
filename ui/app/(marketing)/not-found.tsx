import Link from "next/link"
import { ArrowRight, SearchX } from "lucide-react"

const helpfulLinks = [
  { href: "/funkcije", label: "Funkcije" },
  { href: "/cene", label: "Cene" },
  { href: "/za-agencije", label: "Za agencije" },
  { href: "/blog", label: "Blog" },
]

export default function MarketingNotFound() {
  return (
    <section className="relative isolate overflow-hidden bg-[color:var(--mk-bg)] px-6 py-24 md:py-32">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute right-[-10%] top-[-20%] h-[30rem] w-[30rem] rounded-full bg-[radial-gradient(circle_at_center,rgba(79,70,229,0.22),transparent_62%)] blur-2xl" />
        <div className="absolute inset-0 opacity-[0.05] [background-image:radial-gradient(#0B1220_1px,transparent_1px)] [background-size:24px_24px]" />
      </div>

      <div className="mx-auto max-w-3xl text-center">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[color:var(--mk-indigo-100)] text-[color:var(--mk-indigo-600)]">
          <SearchX className="h-7 w-7" />
        </div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--mk-indigo-600)]">
          Greska 404
        </p>
        <h1 className="mt-4 font-display text-5xl font-bold tracking-[-0.035em] text-[color:var(--mk-navy-900)] md:text-6xl">
          Ova stranica nije pronadjena.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-[color:var(--mk-text-muted)]">
          Link je mozda promenjen ili stranica vise ne postoji. Nastavite ka
          najvaznijim SURP stranicama.
        </p>

        <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
          <span className="mk-gradient-ring animate-gradient-border inline-flex rounded-full p-[1px] motion-reduce:animate-none">
            <Link
              href="/"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[color:var(--mk-indigo-600)] px-6 py-3 text-sm font-semibold text-white shadow-mk-glow"
            >
              Nazad na pocetnu
              <ArrowRight className="h-4 w-4" />
            </Link>
          </span>
          <Link
            href="/kontakt"
            className="inline-flex min-h-12 items-center justify-center rounded-full border border-[color:var(--mk-border)] bg-white px-6 py-3 text-sm font-semibold text-[color:var(--mk-navy-900)] shadow-mk-sm"
          >
            Zakazite demo
          </Link>
        </div>

        <div className="mt-12 grid gap-3 sm:grid-cols-4">
          {helpfulLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-2xl border border-[color:var(--mk-border)] bg-white px-4 py-3 text-sm font-semibold text-[color:var(--mk-text-muted)] shadow-mk-sm transition hover:-translate-y-0.5 hover:text-[color:var(--mk-indigo-600)]"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
