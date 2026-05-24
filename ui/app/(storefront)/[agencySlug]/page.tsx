import type { CSSProperties, ReactNode } from "react"
import type { Metadata } from "next"
import Image from "next/image"
import { notFound } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { PublicAgencyStorefront } from "@/lib/storefront"
import { fetchPublicAgencyStorefront, resolveStorefrontImageUrl, storefrontDisplayTitle } from "@/lib/storefront"
import {
  ArrowRight,
  Calendar,
  Clock,
  Facebook,
  Globe,
  Instagram,
  Linkedin,
  Search,
  Twitter,
} from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { absoluteUrl, jsonLd, siteConfig } from "@/lib/seo"

interface StorefrontPageProps {
  params: {
    agencySlug: string
  }
}

const DEFAULT_BRAND_COLOR = "#1D4ED8"

export async function generateMetadata({ params }: StorefrontPageProps): Promise<Metadata> {
  const agency = await fetchPublicAgencyStorefront(params.agencySlug)

  if (!agency) {
    return {
      title: "Agencija nije pronađena",
    }
  }

  const title = storefrontDisplayTitle(agency)
  const description = agency.seoDescription || agency.heroSubtitle || `Javni izlog za ${agency.name}`
  const image = agency.ogImageUrl || agency.heroImageUrl || agency.logoUrl || undefined
  const url = absoluteUrl(`/${agency.slug}`)

  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      url,
      siteName: siteConfig.name,
      locale: "sr_RS",
      type: "website",
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: image ? [image] : undefined,
    },
    robots: {
      index: true,
      follow: true,
    },
  }
}

export default async function StorefrontPage({ params }: StorefrontPageProps) {
  const storefront = await fetchPublicAgencyStorefront(params.agencySlug)

  if (!storefront) {
    notFound()
  }

  const agency = storefront
  const canRenderHero =
    agency.sectionsEnabled.hero &&
    Boolean(agency.heroTitle?.trim() || agency.heroSubtitle?.trim() || agency.heroImageUrl?.trim())
  const canRenderRides = agency.sectionsEnabled.rides && agency.rides.length > 0
  const canRenderAbout = agency.sectionsEnabled.about && Boolean(agency.aboutMarkdown?.trim())
  const brandStyle = {
    "--brand-primary": agency.primaryColor || DEFAULT_BRAND_COLOR,
  } as CSSProperties
  const url = absoluteUrl(`/${agency.slug}`)
  const sameAs = Object.values(agency.socialLinks).filter((href): href is string => Boolean(href))
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${url}#webpage`,
        url,
        name: storefrontDisplayTitle(agency),
        description: agency.seoDescription || agency.heroSubtitle || agency.footerText || undefined,
        isPartOf: {
          "@id": `${absoluteUrl("/")}#website`,
        },
        mainEntity: {
          "@id": `${url}#agency`,
        },
      },
      {
        "@type": "TravelAgency",
        "@id": `${url}#agency`,
        name: agency.name,
        url,
        description: agency.seoDescription || agency.heroSubtitle || agency.footerText || undefined,
        logo: agency.logoUrl || undefined,
        image: agency.ogImageUrl || agency.heroImageUrl || undefined,
        sameAs: sameAs.length > 0 ? sameAs : undefined,
      },
      ...(agency.rides.length > 0
        ? [
            {
              "@type": "ItemList",
              "@id": `${url}#routes`,
              name: `Linije - ${agency.name}`,
              itemListElement: agency.rides.map((ride, index) => ({
                "@type": "ListItem",
                position: index + 1,
                item: {
                  "@type": "Service",
                  name: ride.lineName,
                  serviceType: "Autobuski prevoz",
                  description: `${ride.origin} - ${ride.destination}. Polasci: ${ride.departureTimes.join(", ")}. Dani: ${ride.days}.`,
                  provider: {
                    "@id": `${url}#agency`,
                  },
                },
              })),
            },
          ]
        : []),
    ],
  }

  return (
    <div className="min-h-screen bg-[#fbfaf8] text-slate-950 antialiased" style={brandStyle}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }} />
      {canRenderHero ? (
        <HeroSection agency={agency} canRenderRides={canRenderRides} canRenderAbout={canRenderAbout} />
      ) : null}

      {canRenderRides ? <RidesSection agency={agency} /> : null}
      {canRenderAbout ? <AboutSection agency={agency} /> : null}
      <StorefrontFooter
        agency={agency}
        canRenderRides={canRenderRides}
        canRenderAbout={canRenderAbout}
      />
    </div>
  )
}

function HeroSection({
  agency,
  canRenderRides,
  canRenderAbout,
}: {
  agency: PublicAgencyStorefront
  canRenderRides: boolean
  canRenderAbout: boolean
}) {
  const hasCtas = canRenderRides || canRenderAbout

  return (
    <section id="hero" className="relative min-h-[70vh] overflow-hidden md:min-h-[85vh]">
      {agency.heroImageUrl ? (
        <Image
          src={agency.heroImageUrl}
          alt={agency.heroImageAlt || `Autobus agencije ${agency.name}`}
          fill
          priority
          sizes="100vw"
          unoptimized
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,var(--brand-primary),transparent_32%),linear-gradient(135deg,#171512,#2b2620_48%,#11100f)]" />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/45 to-transparent" />

      <div className="relative mx-auto flex min-h-[70vh] max-w-7xl flex-col justify-between px-6 py-8 md:min-h-[85vh] lg:px-8">
        <div className="inline-flex w-fit items-center gap-3 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-white shadow-2xl backdrop-blur-md">
          {agency.logoUrl ? (
            <Image
              src={agency.logoUrl}
              alt={agency.logoAlt || `${agency.name} logo`}
              width={44}
              height={44}
              unoptimized
              className="h-11 w-11 rounded-lg object-cover"
            />
          ) : (
            <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-primary text-sm font-bold">
              {agency.name.slice(0, 1).toUpperCase()}
            </span>
          )}
          <span className="text-sm font-semibold">{agency.name}</span>
        </div>

        <div className="max-w-4xl pb-10 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4">
          <div className="mb-5 inline-flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.32em] text-white/80">
              Međugradski autobuski prevoz
            </span>
            <span className="h-px w-24 bg-brand-primary" />
          </div>
          {agency.heroTitle ? (
            <h1 className="max-w-4xl text-[clamp(2.5rem,5vw,4.5rem)] font-bold leading-[1.05] tracking-[-0.04em] text-white drop-shadow-xl">
              {agency.heroTitle}
            </h1>
          ) : null}
          {agency.heroSubtitle ? (
            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/80 md:text-xl">{agency.heroSubtitle}</p>
          ) : null}
          {hasCtas ? (
            <div className="mt-8 flex flex-wrap gap-3">
              {canRenderRides ? (
                <Button asChild className="rounded-lg bg-brand-primary text-white hover:bg-brand-primary">
                  <a href="#voznje">
                    Pretraži vožnje
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              ) : null}
              {canRenderAbout ? (
                <Button asChild variant="outline" className="rounded-lg border-white/40 bg-white/5 text-white hover:bg-white/10 hover:text-white">
                  <a href="#o-nama">Saznaj više</a>
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>

        <div />
      </div>
    </section>
  )
}

function RidesSection({ agency }: { agency: PublicAgencyStorefront }) {
  const origins = unique(agency.rides.map((ride) => ride.origin))
  const destinations = unique(agency.rides.map((ride) => ride.destination))

  return (
    <section id="voznje" className="bg-[#fbfaf8] px-6 pb-24 pt-12 md:pb-32 md:pt-16 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <Card className="rounded-2xl border-0 bg-white shadow-2xl">
          <CardContent className="grid gap-4 p-4 md:grid-cols-[1fr_1fr_1fr_auto] md:p-5">
            <Select defaultValue={origins[0]}>
              <SelectTrigger className="h-12 rounded-lg bg-white">
                <SelectValue placeholder="Polazak" />
              </SelectTrigger>
              <SelectContent>
                {origins.map((origin) => (
                  <SelectItem key={origin} value={origin}>
                    {origin}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select defaultValue={destinations[0]}>
              <SelectTrigger className="h-12 rounded-lg bg-white">
                <SelectValue placeholder="Dolazak" />
              </SelectTrigger>
              <SelectContent>
                {destinations.map((destination) => (
                  <SelectItem key={destination} value={destination}>
                    {destination}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input type="date" className="h-12 rounded-lg bg-white" />
            <Button className="h-12 rounded-lg bg-brand-primary px-6 text-white hover:bg-brand-primary">
              <Search className="mr-2 h-4 w-4" />
              Pretraži
            </Button>
          </CardContent>
        </Card>

        <SectionHeading
          eyebrow="Vožnje"
          title="Pronađite svoju rutu"
          subtitle="Pretražite rute, vidite raspored polazaka i izaberite vožnju."
          className="mt-24"
        />

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {agency.rides.map((ride) => (
            <article
              key={ride.id}
              className="group rounded-xl border bg-white p-6 shadow-sm transition duration-200 hover:scale-[1.02] hover:border-brand-primary hover:shadow-lg motion-reduce:hover:scale-100"
            >
              {agency.rideIconUrl ? (
                <div className="mb-5 flex justify-center">
                  <Image
                    src={resolveStorefrontImageUrl(agency.rideIconUrl)}
                    alt=""
                    aria-hidden="true"
                    width={56}
                    height={56}
                    unoptimized
                    className="h-14 w-auto rounded-xl object-contain"
                  />
                </div>
              ) : null}
              <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
                <p className="text-sm font-semibold">{ride.origin}</p>
                <div className="mb-1 flex w-20 items-center">
                  <span className="h-2.5 w-2.5 rounded-full bg-brand-primary" />
                  <span className="h-px flex-1 border-t border-dashed border-slate-300" />
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                </div>
                <p className="text-right text-sm font-semibold">{ride.destination}</p>
              </div>

              <div className="mt-6 space-y-3 text-sm text-slate-600">
                <p className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-brand-primary" />
                  Polasci: {ride.departureTimes.join(", ")}
                </p>
                <p className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-brand-primary" />
                  {ride.days}
                </p>
              </div>

              <div className="mt-7 flex items-center justify-between gap-4">
                <p className="text-sm font-semibold text-brand-primary">{ride.lineName}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

function AboutSection({ agency }: { agency: PublicAgencyStorefront }) {
  return (
    <section id="o-nama" className="bg-[#fbfaf8] px-6 py-24 md:py-32 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <MarkdownBlock markdown={agency.aboutMarkdown || ""} />
      </div>
    </section>
  )
}

function StorefrontFooter({
  agency,
  canRenderRides,
  canRenderAbout,
}: {
  agency: PublicAgencyStorefront
  canRenderRides: boolean
  canRenderAbout: boolean
}) {
  const footerLinks = [
    canRenderRides ? { href: "#voznje", label: "Vožnje" } : null,
    canRenderAbout ? { href: "#o-nama", label: "O nama" } : null,
  ].filter((link): link is { href: string; label: string } => Boolean(link))

  const socials = [
    agency.socialLinks.facebookUrl ? { href: agency.socialLinks.facebookUrl, label: "Facebook", Icon: Facebook } : null,
    agency.socialLinks.instagramUrl ? { href: agency.socialLinks.instagramUrl, label: "Instagram", Icon: Instagram } : null,
    agency.socialLinks.twitterUrl ? { href: agency.socialLinks.twitterUrl, label: "X", Icon: Twitter } : null,
    agency.socialLinks.linkedinUrl ? { href: agency.socialLinks.linkedinUrl, label: "LinkedIn", Icon: Linkedin } : null,
    agency.socialLinks.websiteUrl ? { href: agency.socialLinks.websiteUrl, label: "Sajt", Icon: Globe } : null,
  ].filter((item): item is { href: string; label: string; Icon: typeof Globe } => Boolean(item))

  return (
    <footer className="bg-[#12100e] px-6 pt-16 text-slate-300 lg:px-8">
      <div className="mx-auto max-w-7xl py-16">
        <div className="flex flex-col gap-5 md:flex-row md:items-center">
          {agency.logoUrl ? (
            <Image
              src={agency.logoUrl}
              alt={agency.logoAlt || `${agency.name} logo`}
              width={64}
              height={64}
              unoptimized
              className="h-16 w-16 rounded-xl object-cover"
            />
          ) : (
            <span className="flex h-16 w-16 items-center justify-center rounded-xl bg-brand-primary text-xl font-bold text-white">
              {agency.name.slice(0, 1).toUpperCase()}
            </span>
          )}
          <div>
            <p className="text-2xl font-semibold text-white">{agency.name}</p>
            {agency.heroSubtitle ? <p className="mt-1 max-w-2xl text-sm">{agency.heroSubtitle}</p> : null}
          </div>
        </div>

        {agency.footerText ? <p className="mt-8 max-w-3xl text-sm leading-6 text-slate-400">{agency.footerText}</p> : null}

        <div className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
          {footerLinks.length > 0 ? (
            <FooterColumn title="Linkovi">
              {footerLinks.map((link) => (
                <a key={link.href} href={link.href} className="block py-1 text-sm hover:text-white">
                  {link.label}
                </a>
              ))}
            </FooterColumn>
          ) : null}

          <FooterColumn title="Pravno">
            {["Uslovi korišćenja", "Politika privatnosti", "Politika kolačića"].map((label) => (
              <a key={label} href="#" className="block py-1 text-sm hover:text-white">
                {label}
              </a>
            ))}
          </FooterColumn>

          {socials.length > 0 ? (
            <FooterColumn title="Pratite nas">
              <div className="flex flex-wrap gap-2">
                {socials.map(({ href, label, Icon }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={label}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-700 transition hover:border-brand-primary hover:text-white hover:shadow-[0_0_24px_var(--brand-primary)]"
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                ))}
              </div>
            </FooterColumn>
          ) : null}
        </div>
      </div>

      <div className="border-t border-slate-800 py-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 text-xs text-slate-500 md:flex-row md:items-center md:justify-between">
          <p>© 2026 {agency.name}. Sva prava zadržana.</p>
          <a href="/login" className="hover:text-white">
            Powered by SURP
          </a>
        </div>
      </div>
    </footer>
  )
}

function SectionHeading({
  eyebrow,
  title,
  subtitle,
  className,
}: {
  eyebrow: string
  title: string
  subtitle?: string
  className?: string
}) {
  return (
    <div className={className}>
      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-primary">{eyebrow}</p>
      <h2 className="mt-3 max-w-3xl text-4xl font-bold tracking-tight text-slate-950 md:text-5xl">{title}</h2>
      {subtitle ? <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">{subtitle}</p> : null}
    </div>
  )
}

function FooterColumn({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-white">{title}</p>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

function MarkdownBlock({ markdown }: { markdown: string }) {
  return (
    <div className="space-y-6">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h2 className="text-4xl font-bold tracking-tight text-slate-950 md:text-5xl">{children}</h2>
          ),
          h2: ({ children }) => (
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-primary">O nama</p>
              <h2 className="mt-3 text-4xl font-bold tracking-tight text-slate-950 md:text-5xl">{children}</h2>
            </div>
          ),
          h3: ({ children }) => <h3 className="text-2xl font-semibold tracking-tight text-slate-950">{children}</h3>,
          p: ({ children }) => <p className="text-lg leading-relaxed text-slate-600">{children}</p>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-brand-primary pl-5 text-xl italic leading-8 text-slate-700">
              {children}
            </blockquote>
          ),
          ul: ({ children }) => <ul className="list-disc space-y-2 pl-6 text-lg leading-relaxed text-slate-600">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal space-y-2 pl-6 text-lg leading-relaxed text-slate-600">{children}</ol>,
          a: ({ children, href }) => (
            <a href={href} className="font-medium text-brand-primary underline-offset-4 hover:underline">
              {children}
            </a>
          ),
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  )
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values))
}
