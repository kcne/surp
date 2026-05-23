"use client"

import { useEffect, useMemo, useState } from "react"
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  ConfirmActionDialog,
  DetailLink,
  FormField,
  LoadingButton,
  SuperadminEmptyState,
  SuperadminErrorState,
  SuperadminPageHeader,
  TableSkeleton,
  activeBadge,
  formatMaybeDate,
  statusBadge,
} from "@/components/superadmin/SuperadminShared"
import {
  activatePlatformTenant,
  createPlatformTenant,
  deactivatePlatformTenant,
  listPlatformTenants,
  type PlatformTenant,
} from "@/infrastructure/requests/superadmin.requests"
import { getApiErrorMessage } from "@/infrastructure/utils/errors"
import { Building2, Plus, Search } from "lucide-react"

type StatusFilter = "ALL" | "ACTIVE" | "INACTIVE"

export default function SuperadminAgenciesPage() {
  const [items, setItems] = useState<PlatformTenant[]>([])
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [tenantToToggle, setTenantToToggle] = useState<PlatformTenant | null>(null)
  const [form, setForm] = useState({ slug: "", name: "", timezone: "Europe/Belgrade" })

  const slugError = form.slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug)
    ? "Slug može sadržati mala slova, brojeve i crtice."
    : null

  const load = async () => {
    setLoading(true)
    try {
      const result = await listPlatformTenants({
        search: search || undefined,
        isActive: statusFilter === "ALL" ? undefined : statusFilter === "ACTIVE",
        pageSize: 50,
      })
      setItems(result.items)
      setError(null)
    } catch (err) {
      setError(getApiErrorMessage(err, "Ne možemo da učitamo agencije. Pokušajte ponovo."))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const resultLabel = useMemo(() => `${items.length} agencija`, [items.length])

  const submitCreate = async () => {
    if (!form.slug || !form.name || slugError) {
      return
    }

    setCreating(true)
    try {
      await createPlatformTenant(form)
      toast.success("Agencija je kreirana. Sledeći korak je dodavanje admin korisnika.")
      setForm({ slug: "", name: "", timezone: "Europe/Belgrade" })
      setCreateOpen(false)
      await load()
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Kreiranje agencije nije uspelo."))
    } finally {
      setCreating(false)
    }
  }

  const confirmToggleActive = async () => {
    if (!tenantToToggle) return
    try {
      if (tenantToToggle.isActive) {
        await deactivatePlatformTenant(tenantToToggle.id)
        toast.success("Agencija je deaktivirana")
      } else {
        await activatePlatformTenant(tenantToToggle.id)
        toast.success("Agencija je aktivirana")
      }
      setTenantToToggle(null)
      await load()
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Promena statusa nije uspela."))
    }
  }

  const resetFilters = () => {
    setSearch("")
    setStatusFilter("ALL")
  }

  return (
    <div className="space-y-6">
      <SuperadminPageHeader
        eyebrow="Tenant menadžment"
        title="Agencije"
        subtitle="Upravljanje tenantima, statusom agencija i osnovnim platformskim pokazateljima."
        actions={
          <Button onClick={() => setCreateOpen(true)} className="min-h-11">
            <Plus className="h-4 w-4" />
            Nova agencija
          </Button>
        }
      />

      {error ? <SuperadminErrorState message={error} onRetry={load} /> : null}

      <Card className="border-border/80 bg-card shadow-sm">
        <CardContent className="grid gap-3 pt-6 md:grid-cols-[1fr_220px_auto_auto]">
          <FormField id="agency-search" label="Pretraga agencija">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input id="agency-search" className="pl-9" placeholder="Naziv ili slug agencije" value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => event.key === "Enter" && load()} />
            </div>
          </FormField>
          <FormField id="agency-status" label="Status">
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
              <SelectTrigger id="agency-status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Sve agencije</SelectItem>
                <SelectItem value="ACTIVE">Aktivne</SelectItem>
                <SelectItem value="INACTIVE">Neaktivne</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <div className="flex items-end">
            <Button variant="outline" onClick={load} className="min-h-11 w-full">Primeni filtere</Button>
          </div>
          <div className="flex items-end">
            <Button variant="ghost" onClick={resetFilters} className="min-h-11 w-full">Resetuj</Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{loading ? "Učitavamo agencije..." : `Prikazano: ${resultLabel}`}</span>
      </div>

      <Card className="border-border/80 bg-card shadow-sm">
        <CardContent className="pt-6">
          {loading ? (
            <TableSkeleton columns={6} />
          ) : items.length === 0 ? (
            <SuperadminEmptyState
              icon={Building2}
              title="Nema agencija za prikaz"
              description="Pokušajte da promenite filtere ili kreirajte novu agenciju."
              action={<Button onClick={() => setCreateOpen(true)}>Kreiraj agenciju</Button>}
            />
          ) : (
            <>
              <div className="hidden md:block">
                <Table aria-label="Lista agencija">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Agencija</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Korisnici</TableHead>
                      <TableHead>Rezervacije</TableHead>
                      <TableHead>Javni izlog</TableHead>
                      <TableHead>Poslednja aktivnost</TableHead>
                      <TableHead className="text-right">Akcije</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((tenant) => (
                      <TableRow key={tenant.id}>
                        <TableCell>
                          <DetailLink href={`/superadmin/agencies/${tenant.id}`}>{tenant.name}</DetailLink>
                          <p className="text-xs text-muted-foreground">{tenant.slug}</p>
                        </TableCell>
                        <TableCell>{activeBadge(tenant.isActive)}</TableCell>
                        <TableCell className="tabular-nums">{tenant.kpis?.activeUsers ?? 0}/{tenant.kpis?.totalUsers ?? 0}</TableCell>
                        <TableCell className="tabular-nums">{tenant.kpis?.reservationsInPeriod ?? 0}</TableCell>
                        <TableCell>{tenant.kpis?.storefront.status ? statusBadge(tenant.kpis.storefront.status) : "Nije dostupno"}</TableCell>
                        <TableCell>{formatMaybeDate(tenant.kpis?.lastActivityAt)}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" onClick={() => setTenantToToggle(tenant)} className="min-h-10">
                            {tenant.isActive ? "Deaktiviraj" : "Aktiviraj"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="grid gap-3 md:hidden">
                {items.map((tenant) => (
                  <div key={tenant.id} className="rounded-xl border bg-card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <DetailLink href={`/superadmin/agencies/${tenant.id}`}>{tenant.name}</DetailLink>
                        <p className="text-xs text-muted-foreground">{tenant.slug}</p>
                      </div>
                      {activeBadge(tenant.isActive)}
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-lg bg-muted/40 p-3">
                        <p className="text-xs text-muted-foreground">Korisnici</p>
                        <p className="font-semibold tabular-nums">{tenant.kpis?.activeUsers ?? 0}/{tenant.kpis?.totalUsers ?? 0}</p>
                      </div>
                      <div className="rounded-lg bg-muted/40 p-3">
                        <p className="text-xs text-muted-foreground">Rezervacije</p>
                        <p className="font-semibold tabular-nums">{tenant.kpis?.reservationsInPeriod ?? 0}</p>
                      </div>
                    </div>
                    <Button variant="outline" className="mt-4 min-h-11 w-full" onClick={() => setTenantToToggle(tenant)}>
                      {tenant.isActive ? "Deaktiviraj agenciju" : "Aktiviraj agenciju"}
                    </Button>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova agencija</DialogTitle>
            <DialogDescription>Kreirajte tenant i zatim dodajte prvog admin korisnika na detaljima agencije.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <FormField id="new-agency-name" label="Naziv agencije" required>
              <Input id="new-agency-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </FormField>
            <FormField id="new-agency-slug" label="Slug agencije" helper="Koristi mala slova, brojeve i crtice, npr. nis-ekspres." error={slugError} required>
              <Input id="new-agency-slug" value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value.trim().toLowerCase() })} />
            </FormField>
            <FormField id="new-agency-timezone" label="Vremenska zona">
              <Input id="new-agency-timezone" value={form.timezone} onChange={(event) => setForm({ ...form, timezone: event.target.value })} />
            </FormField>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Odustani</Button>
            <LoadingButton loading={creating} loadingText="Kreiram agenciju..." onClick={submitCreate} disabled={!form.slug || !form.name || Boolean(slugError)}>
              Kreiraj agenciju
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmActionDialog
        open={Boolean(tenantToToggle)}
        onOpenChange={(open) => !open && setTenantToToggle(null)}
        title={tenantToToggle?.isActive ? "Deaktivirati agenciju?" : "Aktivirati agenciju?"}
        description={
          tenantToToggle?.isActive
            ? "Korisnici ove agencije neće moći da koriste platformu dok je ponovo ne aktivirate."
            : "Agencija i njeni korisnici će ponovo moći da koriste platformu."
        }
        confirmLabel={tenantToToggle?.isActive ? "Da, deaktiviraj" : "Da, aktiviraj"}
        destructive={Boolean(tenantToToggle?.isActive)}
        onConfirm={confirmToggleActive}
      />
    </div>
  )
}
