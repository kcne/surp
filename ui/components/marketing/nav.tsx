import Link from "next/link"
import Image from "next/image"
import { ArrowRight } from "lucide-react"
import { siteConfig } from "@/lib/seo"

export function MarketingNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-[color:var(--mk-border)] bg-white/85 backdrop-blur-xl">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-[color:var(--mk-navy-900)] focus:shadow-mk-md"
      >
        Preskoci na sadrzaj
      </a>
      <nav
        aria-label="Primarna navigacija"
        className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-6 md:px-8 lg:px-12"
      >
        <Link href="/" className="flex items-center">
          <Image
            src="/logo.jpg"
            alt="SVR logo"
            width={120}
            height={40}
            className="h-10 w-auto"
            priority
          />
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {siteConfig.nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-[color:var(--mk-text-muted)] transition-colors hover:text-[color:var(--mk-indigo-600)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--mk-indigo-600)] focus-visible:ring-offset-4"
            >
              {item.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="hidden text-sm font-semibold text-[color:var(--mk-text-muted)] transition-colors hover:text-[color:var(--mk-navy-900)] sm:inline-flex"
          >
            Prijava
          </Link>
          <Link
            href="/kontakt"
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[color:var(--mk-indigo-600)] px-5 py-2.5 text-sm font-semibold text-white shadow-mk-glow transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--mk-indigo-600)] focus-visible:ring-offset-2"
          >
            Zakazite demo
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </nav>
    </header>
  )
}
