"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Layout } from "@/components/layout/Layout"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { getAccessToken, getTenantSlug } from "@/infrastructure/utils/storage"
import type { StorefrontAdminResponse, StorefrontSections, StorefrontUpdatePayload } from "@/lib/storefront"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/stores/authStore"
import { Eye, Globe2, ImageIcon, Link2, Palette, PowerOff, Save, Send, Share2, Sparkles, Store } from "lucide-react"
import { toast } from "sonner"
import {
  getStorefrontAction,
  publishStorefrontAction,
  saveStorefrontAction,
  unpublishStorefrontAction,
} from "./actions"

type TextField =
  | "heroTitle"
  | "heroSubtitle"
  | "heroImageUrl"
  | "heroImageAlt"
  | "aboutMarkdown"
  | "footerText"
  | "logoUrl"
  | "logoAlt"
  | "primaryColor"
  | "seoTitle"
  | "seoDescription"
  | "ogImageUrl"
  | "facebookUrl"
  | "instagramUrl"
  | "twitterUrl"
  | "linkedinUrl"
  | "websiteUrl"

type StorefrontFormState = Record<TextField, string> & {
  sectionsEnabled: StorefrontSections
}

const DEFAULT_SECTIONS: StorefrontSections = {
  hero: true,
  rides: true,
  about: true,
}

const EMPTY_FORM: StorefrontFormState = {
  heroTitle: "",
  heroSubtitle: "",
  heroImageUrl: "",
  heroImageAlt: "",
  aboutMarkdown: "",
  footerText: "",
  logoUrl: "",
  logoAlt: "",
  primaryColor: "#1D4ED8",
  seoTitle: "",
  seoDescription: "",
  ogImageUrl: "",
  facebookUrl: "",
  instagramUrl: "",
  twitterUrl: "",
  linkedinUrl: "",
  websiteUrl: "",
  sectionsEnabled: DEFAULT_SECTIONS,
}

const SECTION_LABELS: Record<keyof StorefrontSections, string> = {
  hero: "Uvodna sekcija",
  rides: "Vožnje",
  about: "O nama",
}

const SECTION_DESCRIPTIONS: Record<keyof StorefrontSections, string> = {
  hero: "Glavni naslov, opis i slika na vrhu stranice.",
  rides: "Prikazuje aktivne vožnje iz sistema ako postoje.",
  about: "Tekst o agenciji iz Markdown polja.",
}

export default function StorefrontDashboardPage() {
  const { hasHydrated, isAuthenticated, user } = useAuthStore()
  const [storefront, setStorefront] = useState<StorefrontAdminResponse | null>(null)
  const [form, setForm] = useState<StorefrontFormState>(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingAction, setSavingAction] = useState<"save" | "publish" | "unpublish" | null>(null)

  const auth = useMemo(() => {
    if (!hasHydrated || !isAuthenticated) {
      return null
    }

    const accessToken = getAccessToken()
    const tenantSlug = getTenantSlug()

    return accessToken && tenantSlug ? { accessToken, tenantSlug } : null
  }, [hasHydrated, isAuthenticated])

  useEffect(() => {
    if (!hasHydrated || !isAuthenticated || !auth) {
      return
    }

    const authContext = auth
    let cancelled = false

    async function loadStorefront() {
      setLoading(true)
      setError(null)
      try {
        const response = await getStorefrontAction(authContext)
        if (!cancelled) {
          setStorefront(response)
          setForm(mapStorefrontToForm(response))
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Greška pri učitavanju javnog izloga")
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadStorefront()

    return () => {
      cancelled = true
    }
  }, [auth, hasHydrated, isAuthenticated])

  const updateField = (field: TextField, value: string) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  const updateSection = (section: keyof StorefrontSections, value: boolean) => {
    setForm((current) => ({
      ...current,
      sectionsEnabled: {
        ...current.sectionsEnabled,
        [section]: value,
      },
    }))
  }

  const handleSave = async () => {
    if (!auth) {
      toast.error("Nedostaje sesija za prijavu")
      return
    }

    setSavingAction("save")
    setError(null)
    try {
      const response = await saveStorefrontAction(auth, mapFormToPayload(form))
      setStorefront(response)
      setForm(mapStorefrontToForm(response))
      toast.success("Javni izlog je sačuvan")
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "Greška pri čuvanju javnog izloga"
      setError(message)
      toast.error(message)
    } finally {
      setSavingAction(null)
    }
  }

  const handlePublishChange = async (action: "publish" | "unpublish") => {
    if (!auth) {
      toast.error("Nedostaje sesija za prijavu")
      return
    }

    setSavingAction(action)
    setError(null)
    try {
      const response =
        action === "publish" ? await publishStorefrontAction(auth) : await unpublishStorefrontAction(auth)
      setStorefront(response)
      setForm(mapStorefrontToForm(response))
      toast.success(action === "publish" ? "Javni izlog je objavljen" : "Objava javnog izloga je povučena")
    } catch (publishError) {
      const message = publishError instanceof Error ? publishError.message : "Greška pri promeni statusa objave"
      setError(message)
      toast.error(message)
    } finally {
      setSavingAction(null)
    }
  }

  if (!hasHydrated || !isAuthenticated) {
    return null
  }

  const canManageStorefront = user?.role === "ADMIN" || user?.role === "MANAGER"

  if (!canManageStorefront) {
    return (
      <Layout>
        <div className="rounded-lg border border-dashed p-12 text-center">
          <Store className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-lg font-medium">Nemate pristup podešavanjima javnog izloga.</p>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="space-y-8">
        <div className="overflow-hidden rounded-2xl border bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white shadow-sm">
          <div className="relative px-6 py-7 md:px-8">
            <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.35),transparent_45%)]" />
            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15">
                    <Store className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Javni izlog</h1>
                      {storefront ? (
                        <Badge
                          className={cn(
                            "border-white/20 text-xs",
                            storefront.status === "PUBLISHED"
                              ? "bg-emerald-400/15 text-emerald-100"
                              : "bg-amber-400/15 text-amber-100"
                          )}
                        >
                          {translateStatus(storefront.status)}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-slate-300">
                      Uredite javnu stranicu agencije, brending i osnovne SEO podatke.
                    </p>
                  </div>
                </div>

                {storefront ? (
                  <div className="flex flex-wrap gap-2 text-xs text-slate-300">
                    <span className="rounded-full bg-white/10 px-3 py-1">/{storefront.tenantSlug}</span>
                    <span className="rounded-full bg-white/10 px-3 py-1">{storefront.tenantName}</span>
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2">
                {storefront ? (
                  <Button variant="secondary" asChild>
                    <Link href={`/${storefront.tenantSlug}`} target="_blank">
                      <Eye className="mr-2 h-4 w-4" />
                      Pregled
                    </Link>
                  </Button>
                ) : null}
                <Button onClick={handleSave} disabled={Boolean(savingAction) || loading}>
                  <Save className="mr-2 h-4 w-4" />
                  {savingAction === "save" ? "Čuvanje..." : "Sačuvaj"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => handlePublishChange("publish")}
                  disabled={Boolean(savingAction) || loading}
                >
                  <Send className="mr-2 h-4 w-4" />
                  {savingAction === "publish" ? "Objavljivanje..." : "Objavi"}
                </Button>
                <Button
                  variant="outline"
                  className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                  onClick={() => handlePublishChange("unpublish")}
                  disabled={Boolean(savingAction) || loading}
                >
                  <PowerOff className="mr-2 h-4 w-4" />
                  {savingAction === "unpublish" ? "Povlačenje..." : "Povuci objavu"}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(360px,0.85fr)]">
          <div className="space-y-6">
            <Card className="overflow-hidden shadow-sm">
              <CardHeader>
                <div className="flex items-start gap-3">
                  <span className="rounded-xl bg-primary/10 p-2 text-primary">
                    <Sparkles className="h-5 w-5" />
                  </span>
                  <div>
                    <CardTitle>Osnovni sadržaj</CardTitle>
                    <CardDescription>Naslov, opis i tekst koji korisnici prvo vide na javnoj stranici.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Naslov uvodne sekcije" value={form.heroTitle} onChange={(value) => updateField("heroTitle", value)} />
                  <Field
                    label="Podnaslov uvodne sekcije"
                    value={form.heroSubtitle}
                    onChange={(value) => updateField("heroSubtitle", value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="aboutMarkdown">O nama (Markdown)</Label>
                  <Textarea
                    id="aboutMarkdown"
                    value={form.aboutMarkdown}
                    rows={8}
                    onChange={(event) => updateField("aboutMarkdown", event.target.value)}
                  />
                </div>
                <Field label="Tekst futera" value={form.footerText} onChange={(value) => updateField("footerText", value)} />
              </CardContent>
            </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <div className="flex items-start gap-3">
                <span className="rounded-xl bg-primary/10 p-2 text-primary">
                  <ImageIcon className="h-5 w-5" />
                </span>
                <div>
                  <CardTitle>Brending i slike</CardTitle>
                  <CardDescription>Dodajte linkove za slike i primarnu boju koja oblikuje javnu stranicu.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <Field
                  label="Link uvodne slike"
                  value={form.heroImageUrl}
                  onChange={(value) => updateField("heroImageUrl", value)}
                />
                <Field
                  label="Opis uvodne slike"
                  value={form.heroImageAlt}
                  onChange={(value) => updateField("heroImageAlt", value)}
                />
                <Field label="Link logotipa" value={form.logoUrl} onChange={(value) => updateField("logoUrl", value)} />
                <Field
                  label="Opis logotipa"
                  value={form.logoAlt}
                  onChange={(value) => updateField("logoAlt", value)}
                />
              </div>
              <div className="grid gap-3 rounded-xl border bg-muted/30 p-4 md:grid-cols-[auto_1fr] md:items-center">
                <div className="flex items-center gap-3">
                  <span className="rounded-xl bg-background p-2 text-primary shadow-sm">
                    <Palette className="h-5 w-5" />
                  </span>
                  <div>
                    <Label htmlFor="primaryColor">Primarna boja</Label>
                    <p className="text-xs text-muted-foreground">Koristi se za dugmad i akcente.</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 md:justify-end">
                  <Input
                    id="primaryColor"
                    type="color"
                    value={form.primaryColor || "#1D4ED8"}
                    onChange={(event) => updateField("primaryColor", event.target.value)}
                    className="h-11 w-20 cursor-pointer p-1"
                  />
                  <code className="rounded-md bg-background px-2 py-1 text-xs">{form.primaryColor || "#1D4ED8"}</code>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <div className="flex items-start gap-3">
                <span className="rounded-xl bg-primary/10 p-2 text-primary">
                  <Globe2 className="h-5 w-5" />
                </span>
                <div>
                  <CardTitle>SEO i deljenje</CardTitle>
                  <CardDescription>Podaci koji se koriste za pretraživače i prikaz pri deljenju linka.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="SEO naslov" value={form.seoTitle} onChange={(value) => updateField("seoTitle", value)} />
                <Field
                  label="SEO opis"
                  value={form.seoDescription}
                  onChange={(value) => updateField("seoDescription", value)}
                />
                <Field label="Link slike za deljenje" value={form.ogImageUrl} onChange={(value) => updateField("ogImageUrl", value)} />
              </div>
            </CardContent>
          </Card>
          </div>

          <div className="space-y-6">
            <StorefrontPreview storefront={storefront} form={form} />

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>Sekcije</CardTitle>
                <CardDescription>Uključite ili sakrijte blokove javne stranice.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {(Object.keys(form.sectionsEnabled) as Array<keyof StorefrontSections>).map((section) => (
                  <div key={section} className="flex items-center justify-between gap-4 rounded-xl border bg-background p-4">
                    <div>
                      <p className="text-sm font-medium">{SECTION_LABELS[section]}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{SECTION_DESCRIPTIONS[section]}</p>
                    </div>
                    <Switch
                      checked={form.sectionsEnabled[section]}
                      onCheckedChange={(checked) => updateSection(section, checked)}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <div className="flex items-start gap-3">
                  <span className="rounded-xl bg-primary/10 p-2 text-primary">
                    <Share2 className="h-5 w-5" />
                  </span>
                  <div>
                    <CardTitle>Društvene mreže</CardTitle>
                    <CardDescription>Linkovi se prikazuju u futeru javne stranice.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Field label="Facebook link" value={form.facebookUrl} onChange={(value) => updateField("facebookUrl", value)} />
                <Field
                  label="Instagram link"
                  value={form.instagramUrl}
                  onChange={(value) => updateField("instagramUrl", value)}
                />
                <Field label="X link" value={form.twitterUrl} onChange={(value) => updateField("twitterUrl", value)} />
                <Field
                  label="LinkedIn link"
                  value={form.linkedinUrl}
                  onChange={(value) => updateField("linkedinUrl", value)}
                />
                <Field label="Link sajta" value={form.websiteUrl} onChange={(value) => updateField("websiteUrl", value)} />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  )
}

function StorefrontPreview({
  storefront,
  form,
}: {
  storefront: StorefrontAdminResponse | null
  form: StorefrontFormState
}) {
  const brandColor = form.primaryColor || "#1D4ED8"
  const title = form.heroTitle || storefront?.tenantName || "Naziv agencije"
  const subtitle = form.heroSubtitle || "Kratak opis ponude i vrednosti agencije biće prikazan ovde."
  const agencyName = storefront?.tenantName || "Agencija"
  const agencySlug = storefront?.tenantSlug || "agencija"
  const initials = agencyName.slice(0, 1).toUpperCase()

  return (
    <Card className="overflow-hidden shadow-sm">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Pregled izgleda</CardTitle>
            <CardDescription>Brzi prikaz najvažnijih elemenata javne stranice.</CardDescription>
          </div>
          <Badge variant="outline" className="shrink-0">
            <Link2 className="mr-1 h-3 w-3" />/{agencySlug}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full bg-cover bg-center text-xs font-bold text-white"
                style={{
                  backgroundColor: brandColor,
                  backgroundImage: form.logoUrl ? `url("${form.logoUrl}")` : undefined,
                }}
              >
                {form.logoUrl ? null : initials}
              </div>
              <span className="text-sm font-semibold">{agencyName}</span>
            </div>
            <span className="text-xs text-muted-foreground">Vožnje uskoro</span>
          </div>

          <div
            className="relative min-h-[220px] bg-slate-950"
            style={{
              backgroundImage: form.heroImageUrl ? `url("${form.heroImageUrl}")` : undefined,
              backgroundPosition: "center",
              backgroundSize: "cover",
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-slate-950/90 via-slate-950/65 to-slate-950/20" />
            <div className="relative flex min-h-[220px] flex-col justify-end p-5 text-white">
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: brandColor }}>
                {agencyName}
              </p>
              <h3 className="mt-2 line-clamp-2 text-2xl font-bold leading-tight">{title}</h3>
              <p className="mt-2 line-clamp-3 text-sm text-slate-200">{subtitle}</p>
              <div className="mt-4">
                <span
                  className="inline-flex rounded-lg px-3 py-2 text-xs font-semibold text-white"
                  style={{ backgroundColor: brandColor }}
                >
                  Istražite vožnje
                </span>
              </div>
            </div>
          </div>

          <div className="grid gap-3 p-4">
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs font-semibold text-slate-500">O nama</p>
              <p className="mt-1 line-clamp-2 text-sm text-slate-700">
                {stripMarkdown(form.aboutMarkdown) || "Kratak opis agencije biće prikazan kada unesete tekst."}
              </p>
            </div>
            <Separator />
            <div className="flex flex-wrap gap-2">
              {(Object.keys(form.sectionsEnabled) as Array<keyof StorefrontSections>)
                .filter((section) => form.sectionsEnabled[section])
                .map((section) => (
                  <span key={section} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                    {SECTION_LABELS[section]}
                  </span>
                ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const id = label.toLowerCase().replaceAll(" ", "-")

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  )
}

function translateStatus(status: StorefrontAdminResponse["status"]): string {
  return status === "PUBLISHED" ? "Objavljeno" : "Nacrt"
}

function stripMarkdown(value: string): string {
  return value
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\n+/g, " ")
    .trim()
}

function mapStorefrontToForm(storefront: StorefrontAdminResponse): StorefrontFormState {
  return {
    heroTitle: storefront.heroTitle || "",
    heroSubtitle: storefront.heroSubtitle || "",
    heroImageUrl: storefront.heroImageUrl || "",
    heroImageAlt: storefront.heroImageAlt || "",
    aboutMarkdown: storefront.aboutMarkdown || "",
    footerText: storefront.footerText || "",
    logoUrl: storefront.logoUrl || "",
    logoAlt: storefront.logoAlt || "",
    primaryColor: storefront.primaryColor || "#1D4ED8",
    seoTitle: storefront.seoTitle || "",
    seoDescription: storefront.seoDescription || "",
    ogImageUrl: storefront.ogImageUrl || "",
    facebookUrl: storefront.socialLinks.facebookUrl || "",
    instagramUrl: storefront.socialLinks.instagramUrl || "",
    twitterUrl: storefront.socialLinks.twitterUrl || "",
    linkedinUrl: storefront.socialLinks.linkedinUrl || "",
    websiteUrl: storefront.socialLinks.websiteUrl || "",
    sectionsEnabled: storefront.sectionsEnabled,
  }
}

function mapFormToPayload(form: StorefrontFormState): StorefrontUpdatePayload {
  return {
    heroTitle: form.heroTitle,
    heroSubtitle: form.heroSubtitle,
    heroImageUrl: form.heroImageUrl || undefined,
    heroImageAlt: form.heroImageAlt,
    aboutMarkdown: form.aboutMarkdown,
    footerText: form.footerText,
    logoUrl: form.logoUrl || undefined,
    logoAlt: form.logoAlt,
    primaryColor: form.primaryColor || undefined,
    sectionsEnabled: form.sectionsEnabled,
    seoTitle: form.seoTitle,
    seoDescription: form.seoDescription,
    ogImageUrl: form.ogImageUrl || undefined,
    facebookUrl: form.facebookUrl || undefined,
    instagramUrl: form.instagramUrl || undefined,
    twitterUrl: form.twitterUrl || undefined,
    linkedinUrl: form.linkedinUrl || undefined,
    websiteUrl: form.websiteUrl || undefined,
  }
}
