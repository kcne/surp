"use client"

import { useEffect, useState } from "react"
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
import { Switch } from "@/components/ui/switch"
import {
  FormField,
  KpiGridSkeleton,
  LoadingButton,
  RiskNotice,
  SuperadminErrorState,
  SuperadminPageHeader,
  SuperadminStatCard,
  activeBadge,
  formatMaybeDate,
  statusBadge,
} from "@/components/superadmin/SuperadminShared"
import {
  createPlatformTenantAdmin,
  getPlatformTenant,
  type PlatformTenant,
} from "@/infrastructure/requests/superadmin.requests"
import { getApiErrorMessage } from "@/infrastructure/utils/errors"
import { Activity, Bus, Store, Ticket, UserPlus, Users } from "lucide-react"

export default function SuperadminAgencyDetailPage() {
  const params = useParams<{ id: string }>()
  const tenantId = params?.id ?? ""
  const [tenant, setTenant] = useState<PlatformTenant | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [adminDialogOpen, setAdminDialogOpen] = useState(false)
  const [creatingAdmin, setCreatingAdmin] = useState(false)
  const [form, setForm] = useState({ username: "", email: "", password: "", requirePasswordChange: true })

  const load = async () => {
    setLoading(true)
    try {
      setTenant(await getPlatformTenant(tenantId))
      setError(null)
    } catch (err) {
      setError(getApiErrorMessage(err, "Ne možemo da učitamo agenciju. Pokušajte ponovo."))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId])

  const createAdmin = async () => {
    if (!tenant) return
    setCreatingAdmin(true)
    try {
      await createPlatformTenantAdmin(tenant.id, form)
      toast.success("Admin korisnik je kreiran")
      setForm({ username: "", email: "", password: "", requirePasswordChange: true })
      setAdminDialogOpen(false)
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Kreiranje admin korisnika nije uspelo."))
    } finally {
      setCreatingAdmin(false)
    }
  }

  if (error) {
    return (
      <div className="space-y-6">
        <SuperadminPageHeader
          title="Agencija nije dostupna"
          subtitle="Proverite da li agencija postoji ili pokušajte ponovo."
          breadcrumbs={[{ label: "Superadmin", href: "/superadmin/overview" }, { label: "Agencije", href: "/superadmin/agencies" }, { label: "Detalji" }]}
        />
        <SuperadminErrorState message={error} onRetry={load} />
      </div>
    )
  }

  if (loading || !tenant) {
    return (
      <div className="space-y-6">
        <SuperadminPageHeader title="Učitavamo agenciju..." subtitle="Pripremamo detalje i pokazatelje agencije." />
        <KpiGridSkeleton count={8} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <SuperadminPageHeader
        eyebrow="Detalji agencije"
        title={tenant.name}
        subtitle={`${tenant.slug} · ${tenant.timezone ?? "bez vremenske zone"} · kreirana ${formatMaybeDate(tenant.createdAt)}`}
        breadcrumbs={[{ label: "Superadmin", href: "/superadmin/overview" }, { label: "Agencije", href: "/superadmin/agencies" }, { label: tenant.name }]}
        badge={activeBadge(tenant.isActive)}
        actions={
          <Button onClick={() => setAdminDialogOpen(true)} className="min-h-11">
            <UserPlus className="h-4 w-4" />
            Dodaj admina
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SuperadminStatCard title="Korisnici" value={`${tenant.kpis?.activeUsers ?? 0}/${tenant.kpis?.totalUsers ?? 0}`} subtitle="Aktivni / ukupno" icon={Users} tone="info" />
        <SuperadminStatCard title="Rezervacije" value={tenant.kpis?.reservationsInPeriod ?? 0} subtitle="Poslednjih 30 dana" icon={Ticket} tone="success" />
        <SuperadminStatCard title="Vožnje / linije" value={`${tenant.kpis?.activeRides ?? 0}/${tenant.kpis?.activeLines ?? 0}`} subtitle="Aktivne vožnje i linije" icon={Bus} tone="neutral" />
        <SuperadminStatCard title="Tiketi" value={(tenant.kpis?.openTickets ?? 0) + (tenant.kpis?.inProgressTickets ?? 0)} subtitle="Otvoreni i u toku" icon={Activity} tone={(tenant.kpis?.openTickets ?? 0) > 0 ? "warning" : "success"} />
        <SuperadminStatCard title="Putnici" value={`${tenant.kpis?.activePassengers ?? 0}/${tenant.kpis?.totalPassengers ?? 0}`} subtitle="Aktivni / ukupno" icon={Users} tone="neutral" />
        <SuperadminStatCard title="Javni izlog" value={tenant.kpis?.storefront.status ? statusBadge(tenant.kpis.storefront.status) : "Nije dostupan"} subtitle={formatMaybeDate(tenant.kpis?.storefront.publishedAt)} icon={Store} tone={tenant.kpis?.storefront.status === "PUBLISHED" ? "success" : "warning"} />
        <SuperadminStatCard title="Poslednja aktivnost" value={formatMaybeDate(tenant.kpis?.lastActivityAt)} icon={Activity} tone="info" />
        <SuperadminStatCard title="Status agencije" value={activeBadge(tenant.isActive)} icon={Activity} tone={tenant.isActive ? "success" : "danger"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card className="border-border/80 bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Profil agencije</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm md:grid-cols-2">
            <div>
              <p className="text-muted-foreground">Tenant ID</p>
              <p className="break-all font-mono text-xs">{tenant.id}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Slug</p>
              <p className="font-medium">{tenant.slug}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Vremenska zona</p>
              <p className="font-medium">{tenant.timezone ?? "Nije dostupno"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Ažurirana</p>
              <p className="font-medium">{formatMaybeDate(tenant.updatedAt)}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Operativni status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!tenant.isActive ? (
              <RiskNotice>Agencija je trenutno deaktivirana. Korisnici ne mogu da koriste sistem dok je ponovo ne aktivirate.</RiskNotice>
            ) : null}
            {tenant.kpis?.storefront.status !== "PUBLISHED" ? (
              <RiskNotice>Javni izlog nije objavljen. Agencija možda nema aktivan javni profil.</RiskNotice>
            ) : null}
            {!tenant.kpis?.lastActivityAt ? (
              <RiskNotice>Nema zabeležene aktivnosti za ovu agenciju.</RiskNotice>
            ) : null}
            <Button variant="outline" asChild className="min-h-11 w-full">
              <Link href="/superadmin/agencies">Nazad na agencije</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Dialog open={adminDialogOpen} onOpenChange={setAdminDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dodaj admina agencije</DialogTitle>
            <DialogDescription>Admin korisnik dobija pristup upravljanju agencijom. Privremenu lozinku podelite sigurnim kanalom.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <FormField id="admin-username" label="Korisničko ime" required>
              <Input id="admin-username" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} />
            </FormField>
            <FormField id="admin-email" label="Email adresa" required>
              <Input id="admin-email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
            </FormField>
            <FormField id="admin-password" label="Privremena lozinka" helper="Najmanje 8 karaktera. Korisnik može biti primoran da je promeni pri prvoj prijavi." required>
              <Input id="admin-password" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
            </FormField>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Zahtevaj promenu lozinke</p>
                <p className="text-xs text-muted-foreground">Preporučeno za nove admin naloge.</p>
              </div>
              <Switch checked={form.requirePasswordChange} onCheckedChange={(checked) => setForm({ ...form, requirePasswordChange: checked })} aria-label="Zahtevaj promenu lozinke" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdminDialogOpen(false)}>Odustani</Button>
            <LoadingButton loading={creatingAdmin} loadingText="Kreiram admina..." onClick={createAdmin} disabled={!form.username || !form.email || form.password.length < 8}>
              Kreiraj admin korisnika
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
