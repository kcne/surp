"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  ConfirmActionDialog,
  FormField,
  LoadingButton,
  RiskNotice,
  SuperadminErrorState,
  SuperadminPageHeader,
  SuperadminStatCard,
  activeBadge,
  formatMaybeDate,
  formatStatus,
  statusBadge,
} from "@/components/superadmin/SuperadminShared"
import {
  convertPlatformLead,
  getPlatformLead,
  updatePlatformLead,
  type ConvertPlatformLeadPayload,
  type PlatformLead,
  type PlatformLeadStatus,
} from "@/infrastructure/requests/superadmin.requests"
import { getApiErrorMessage } from "@/infrastructure/utils/errors"
import { Building2, Mail, MessageSquare, Phone, Save, UserRoundPlus } from "lucide-react"

const statuses: PlatformLeadStatus[] = ["NEW", "CONTACTED", "QUALIFIED", "FOLLOW_UP", "CONVERTED", "NOT_INTERESTED", "SPAM"]

export default function SuperadminLeadDetailPage() {
  const params = useParams<{ id: string }>()
  const leadId = params?.id ?? ""
  const [lead, setLead] = useState<PlatformLead | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [converting, setConverting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<PlatformLeadStatus>("NEW")
  const [notes, setNotes] = useState("")
  const [convertOpen, setConvertOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [convertForm, setConvertForm] = useState<ConvertPlatformLeadPayload>({
    tenantSlug: "",
    tenantName: "",
    timezone: "Europe/Belgrade",
    adminUsername: "",
    adminEmail: "",
    adminPassword: "",
    requirePasswordChange: true,
  })

  const load = async () => {
    setLoading(true)
    try {
      const result = await getPlatformLead(leadId)
      setLead(result)
      setStatus(result.status)
      setNotes(result.notes ?? "")
      setConvertForm((current) => ({
        ...current,
        tenantName: current.tenantName || result.agencyName,
        adminEmail: current.adminEmail || result.email,
        tenantSlug: current.tenantSlug || suggestSlug(result.agencyName),
      }))
      setError(null)
    } catch (err) {
      setError(getApiErrorMessage(err, "Ne možemo da učitamo lead. Pokušajte ponovo."))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId])

  const hasUnsavedChanges = useMemo(() => {
    return Boolean(lead && (lead.status !== status || (lead.notes ?? "") !== notes))
  }, [lead, notes, status])

  const saveLead = async () => {
    setSaving(true)
    try {
      const updated = await updatePlatformLead(leadId, { status, notes })
      setLead(updated)
      toast.success("Lead je ažuriran")
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Ažuriranje leada nije uspelo."))
    } finally {
      setSaving(false)
    }
  }

  const convertLead = async () => {
    setConverting(true)
    try {
      await convertPlatformLead(leadId, convertForm)
      toast.success("Lead je konvertovan u agenciju")
      setConfirmOpen(false)
      setConvertOpen(false)
      await load()
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Konverzija leada nije uspela."))
    } finally {
      setConverting(false)
    }
  }

  if (error) {
    return (
      <div className="space-y-6">
        <SuperadminPageHeader
          title="Lead nije dostupan"
          subtitle="Proverite da li lead postoji ili pokušajte ponovo."
          breadcrumbs={[{ label: "Superadmin", href: "/superadmin/overview" }, { label: "Leadovi", href: "/superadmin/leads" }, { label: "Detalji" }]}
        />
        <SuperadminErrorState message={error} onRetry={load} />
      </div>
    )
  }

  if (loading || !lead) {
    return (
      <div className="space-y-6">
        <SuperadminPageHeader title="Učitavamo lead..." subtitle="Pripremamo kontakt podatke i CRM status." />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="h-72 animate-pulse rounded-xl bg-muted" />
          <div className="h-72 animate-pulse rounded-xl bg-muted" />
        </div>
      </div>
    )
  }

  const converted = Boolean(lead.convertedTenantId)

  return (
    <div className="space-y-6">
      <SuperadminPageHeader
        eyebrow="Detalji leada"
        title={lead.name}
        subtitle={`${lead.email} · ${lead.agencyName}`}
        breadcrumbs={[{ label: "Superadmin", href: "/superadmin/overview" }, { label: "Leadovi", href: "/superadmin/leads" }, { label: lead.name }]}
        badge={statusBadge(lead.status)}
        actions={
          <>
            <LoadingButton variant="outline" loading={saving} loadingText="Čuvam izmene..." onClick={saveLead} disabled={!hasUnsavedChanges}>
              <Save className="h-4 w-4" />
              Sačuvaj izmene
            </LoadingButton>
            {converted ? (
              <Button asChild className="min-h-11">
                <Link href={`/superadmin/agencies/${lead.convertedTenantId}`}>Otvori agenciju</Link>
              </Button>
            ) : (
              <Button onClick={() => setConvertOpen(true)} className="min-h-11">
                <Building2 className="h-4 w-4" />
                Konvertuj u agenciju
              </Button>
            )}
          </>
        }
      />

      {hasUnsavedChanges ? <RiskNotice>Imate nesačuvane izmene u CRM panelu.</RiskNotice> : null}

      <div className="grid gap-4 md:grid-cols-3">
        <SuperadminStatCard title="Status leada" value={statusBadge(lead.status)} icon={UserRoundPlus} tone="info" />
        <SuperadminStatCard title="Email" value={lead.confirmationEmailSentAt ? "Potvrda poslata" : "Nije dostupno"} icon={Mail} tone={lead.lastEmailError ? "danger" : "success"} subtitle={lead.lastEmailError ?? undefined} />
        <SuperadminStatCard title="Konverzija" value={converted ? "Konvertovan" : "Nije konvertovan"} icon={Building2} tone={converted ? "success" : "warning"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
        <div className="space-y-4">
          <Card className="border-border/80 bg-card shadow-sm">
            <CardHeader><CardTitle className="text-base">Kontakt i agencija</CardTitle></CardHeader>
            <CardContent className="grid gap-4 text-sm md:grid-cols-2">
              <div>
                <p className="text-muted-foreground">Ime</p>
                <p className="font-medium">{lead.name}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Email</p>
                <p className="font-medium">{lead.email}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Telefon</p>
                <p className="font-medium">{lead.phone ?? "Nije dostupno"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Agencija</p>
                <p className="font-medium">{lead.agencyName}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Polazaka dnevno</p>
                <p className="font-medium">{formatStatus(lead.departuresPerDay)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Kreiran</p>
                <p className="font-medium">{formatMaybeDate(lead.createdAt)}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-card shadow-sm">
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><MessageSquare className="h-4 w-4 text-primary" />Poruka</CardTitle></CardHeader>
            <CardContent>
              <div className="whitespace-pre-wrap rounded-lg border bg-muted/20 p-4 text-sm leading-6">
                {lead.message ?? "Lead nije ostavio dodatnu poruku."}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border/80 bg-card shadow-sm">
          <CardHeader><CardTitle className="text-base">CRM ažuriranje</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <FormField id="lead-status" label="Status leada" required>
              <Select value={status} onValueChange={(value) => setStatus(value as PlatformLeadStatus)}>
                <SelectTrigger id="lead-status"><SelectValue /></SelectTrigger>
                <SelectContent>{statuses.map((item) => <SelectItem key={item} value={item}>{formatStatus(item)}</SelectItem>)}</SelectContent>
              </Select>
            </FormField>
            <FormField id="lead-notes" label="Interne beleške" helper="Beleške vidi samo interni superadmin tim.">
              <Textarea id="lead-notes" value={notes} onChange={(event) => setNotes(event.target.value)} rows={8} />
            </FormField>
            <LoadingButton className="w-full" loading={saving} loadingText="Čuvam lead..." onClick={saveLead} disabled={!hasUnsavedChanges}>
              Sačuvaj lead
            </LoadingButton>
          </CardContent>
        </Card>
      </div>

      <Dialog open={convertOpen} onOpenChange={setConvertOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Konvertuj lead u agenciju</DialogTitle>
            <DialogDescription>Proverite podatke pre kreiranja nove agencije i admin korisnika.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField id="convert-tenant-name" label="Naziv agencije" required>
              <Input id="convert-tenant-name" value={convertForm.tenantName} onChange={(event) => setConvertForm({ ...convertForm, tenantName: event.target.value })} />
            </FormField>
            <FormField id="convert-tenant-slug" label="Slug agencije" helper="Mala slova, brojevi i crtice." required>
              <Input id="convert-tenant-slug" value={convertForm.tenantSlug} onChange={(event) => setConvertForm({ ...convertForm, tenantSlug: event.target.value.trim().toLowerCase() })} />
            </FormField>
            <FormField id="convert-timezone" label="Vremenska zona">
              <Input id="convert-timezone" value={convertForm.timezone} onChange={(event) => setConvertForm({ ...convertForm, timezone: event.target.value })} />
            </FormField>
            <FormField id="convert-admin-username" label="Korisničko ime admina" required>
              <Input id="convert-admin-username" value={convertForm.adminUsername} onChange={(event) => setConvertForm({ ...convertForm, adminUsername: event.target.value })} />
            </FormField>
            <FormField id="convert-admin-email" label="Admin email" required>
              <Input id="convert-admin-email" type="email" value={convertForm.adminEmail} onChange={(event) => setConvertForm({ ...convertForm, adminEmail: event.target.value })} />
            </FormField>
            <FormField id="convert-admin-password" label="Privremena lozinka" helper="Najmanje 8 karaktera." required>
              <Input id="convert-admin-password" type="password" value={convertForm.adminPassword} onChange={(event) => setConvertForm({ ...convertForm, adminPassword: event.target.value })} />
            </FormField>
            <div className="md:col-span-2 flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Zahtevaj promenu lozinke</p>
                <p className="text-xs text-muted-foreground">Preporučeno za novog admin korisnika.</p>
              </div>
              <Switch checked={convertForm.requirePasswordChange} onCheckedChange={(checked) => setConvertForm({ ...convertForm, requirePasswordChange: checked })} aria-label="Zahtevaj promenu lozinke" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConvertOpen(false)}>Odustani</Button>
            <Button onClick={() => setConfirmOpen(true)} disabled={!convertForm.tenantSlug || !convertForm.tenantName || !convertForm.adminUsername || convertForm.adminPassword.length < 8}>
              Nastavi na potvrdu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmActionDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Konvertovati lead u agenciju?"
        description="Biće kreirana nova agencija i admin korisnik, a lead će biti označen kao konvertovan. Proverite podatke pre potvrde."
        confirmLabel={converting ? "Konvertujem..." : "Da, konvertuj"}
        onConfirm={convertLead}
      />
    </div>
  )
}

function suggestSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
