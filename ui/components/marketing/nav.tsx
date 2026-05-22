"use client"

import Link from "next/link"
import Image from "next/image"
import { useState } from "react"
import { ArrowRight, Menu, PlayCircle, X } from "lucide-react"
import { siteConfig } from "@/lib/seo"

export function MarketingNav() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <header className="sticky top-0 z-40 border-b border-[color:var(--mk-border)] bg-white/85 backdrop-blur-xl">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-[color:var(--mk-navy-900)] focus:shadow-mk-md"
      >
        Preskoci na sadrzaj
      </a>
      <nav aria-label="Primarna navigacija" className="mx-auto w-full max-w-7xl px-6 md:px-8 lg:px-12">
        <div className="flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-3" onClick={() => setIsOpen(false)}>
          <Image
            src="/logo.jpg"
            alt="SVR logo"
            width={120}
            height={40}
            className="h-10 w-auto"
            priority
          />
          <span className="font-display text-xl font-bold tracking-[-0.02em] text-[color:var(--mk-navy-900)]">
            SURP
          </span>
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
            href="/sandbox-demo"
            className="hidden min-h-10 items-center gap-2 rounded-full border border-[color:var(--mk-indigo-100)] bg-[color:var(--mk-indigo-50)] px-4 text-sm font-semibold text-[color:var(--mk-indigo-600)] transition-colors hover:bg-[color:var(--mk-indigo-100)] lg:inline-flex"
          >
            <PlayCircle className="h-4 w-4" />
            Isprobajte aplikaciju
          </Link>
          <Link
            href="/login"
            className="inline-flex min-h-10 items-center rounded-full border border-[color:var(--mk-border)] bg-white px-4 text-sm font-semibold text-[color:var(--mk-navy-900)] shadow-mk-sm transition-colors hover:border-[color:var(--mk-indigo-100)] hover:text-[color:var(--mk-indigo-600)]"
          >
            Prijava
          </Link>
          <Link
            href="/kontakt"
            className="hidden min-h-11 items-center gap-2 rounded-full bg-[color:var(--mk-indigo-600)] px-5 py-2.5 text-sm font-semibold text-white shadow-mk-glow transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--mk-indigo-600)] focus-visible:ring-offset-2 sm:inline-flex"
          >
            Javite nam se
            <ArrowRight className="h-4 w-4" />
          </Link>
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--mk-border)] bg-white text-[color:var(--mk-navy-900)] shadow-mk-sm transition hover:border-[color:var(--mk-indigo-100)] md:hidden"
            aria-label={isOpen ? "Zatvori meni" : "Otvori meni"}
            aria-expanded={isOpen}
            aria-controls="marketing-mobile-menu"
            onClick={() => setIsOpen((current) => !current)}
          >
            {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        </div>

        {isOpen ? (
          <div id="marketing-mobile-menu" className="border-t border-[color:var(--mk-border)] py-4 md:hidden">
            <div className="grid gap-2">
              {siteConfig.nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-2xl px-4 py-3 text-sm font-semibold text-[color:var(--mk-text-muted)] transition hover:bg-[color:var(--mk-bg-alt)] hover:text-[color:var(--mk-indigo-600)]"
                  onClick={() => setIsOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
              <Link
                href="/sandbox-demo"
                className="mt-2 inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-[color:var(--mk-indigo-100)] bg-[color:var(--mk-indigo-50)] px-5 py-3 text-sm font-semibold text-[color:var(--mk-indigo-600)]"
                onClick={() => setIsOpen(false)}
              >
                <PlayCircle className="h-4 w-4" />
                Isprobajte aplikaciju
              </Link>
              <Link
                href="/kontakt"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[color:var(--mk-indigo-600)] px-5 py-3 text-sm font-semibold text-white shadow-mk-glow"
                onClick={() => setIsOpen(false)}
              >
                Javite nam se
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        ) : null}
      </nav>
    </header>
  )
}
