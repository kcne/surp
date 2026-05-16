import Link from "next/link"
import Image from "next/image"
import { siteConfig } from "@/lib/seo"

const footerGroups = [
  {
    title: "Proizvod",
    links: [
      { href: "/funkcije", label: "Funkcije" },
      { href: "/cene", label: "Cene" },
      { href: "/za-agencije", label: "Za agencije" },
    ],
  },
  {
    title: "Kompanija",
    links: [
      { href: "/blog", label: "Blog" },
      { href: "/kontakt", label: "Kontakt" },
    ],
  },
  {
    title: "Pravno",
    links: [
      { href: "/uslovi-koriscenja", label: "Uslovi koriscenja" },
      { href: "/politika-privatnosti", label: "Politika privatnosti" },
    ],
  },
]

export function MarketingFooter() {
  return (
    <footer className="border-t border-[color:var(--mk-border)] bg-[color:var(--mk-bg-alt)]">
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-6 py-12 md:grid-cols-[1.4fr_repeat(3,1fr)] md:px-8 lg:px-12">
        <div>
          <Link href="/" className="mb-4 inline-flex items-center">
            <Image
              src="/logo.jpg"
              alt="SVR logo"
              width={120}
              height={40}
              className="h-10 w-auto"
            />
          </Link>
          <p className="max-w-sm text-sm leading-6 text-[color:var(--mk-text-muted)]">
            Operativni sistem za moderne autobuske agencije: linije, vozni redovi,
            rezervacije, putnici i javni sajt u jednom proizvodu.
          </p>
        </div>

        {footerGroups.map((group) => (
          <div key={group.title}>
            <h2 className="mb-4 text-sm font-semibold text-[color:var(--mk-navy-900)]">{group.title}</h2>
            <ul className="space-y-3 text-sm text-[color:var(--mk-text-muted)]">
              {group.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="transition-colors hover:text-[color:var(--mk-indigo-600)]">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-[color:var(--mk-border)]">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-6 py-6 text-xs text-[color:var(--mk-text-subtle)] md:flex-row md:items-center md:justify-between md:px-8 lg:px-12">
          <p>© {new Date().getFullYear()} SURP. Sva prava zadrzana.</p>
          <p>Built for autobuske agencije u regionu.</p>
        </div>
      </div>
    </footer>
  )
}
