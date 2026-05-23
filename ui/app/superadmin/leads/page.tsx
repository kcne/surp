"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  DetailLink,
  FormField,
  SuperadminEmptyState,
  SuperadminErrorState,
  SuperadminPageHeader,
  SuperadminStatCard,
  TableSkeleton,
  formatMaybeDate,
  formatStatus,
  statusBadge,
} from "@/components/superadmin/SuperadminShared"
import {
  listPlatformLeads,
  type PlatformLead,
  type PlatformLeadStatus,
} from "@/infrastructure/requests/superadmin.requests"
import { getApiErrorMessage } from "@/infrastructure/utils/errors"
import { MailCheck, MailWarning, Search, UserRoundPlus, Users } from "lucide-react"

const statuses: PlatformLeadStatus[] = ["NEW", "CONTACTED", "QUALIFIED", "FOLLOW_UP", "CONVERTED", "NOT_INTERESTED", "SPAM"]
type ConvertedFilter = "ALL" | "CONVERTED" | "NOT_CONVERTED"

export default function SuperadminLeadsPage() {
  const [items, setItems] = useState<PlatformLead[]>([])
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<PlatformLeadStatus | "ALL">("ALL")
  const [convertedFilter, setConvertedFilter] = useState<ConvertedFilter>("ALL")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const result = await listPlatformLeads({
        search: search || undefined,
        status: status === "ALL" ? undefined : status,
        converted: convertedFilter === "ALL" ? undefined : convertedFilter === "CONVERTED",
        pageSize: 50,
      })
      setItems(result.items)
      setError(null)
    } catch (err) {
      setError(getApiErrorMessage(err, "Ne možemo da učitamo leadove. Pokušajte ponovo."))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const statusCounts = useMemo(() => {
    return statuses.reduce<Record<PlatformLeadStatus, number>>((acc, item) => {
      acc[item] = items.filter((lead) => lead.status === item).length
      return acc
    }, {} as Record<PlatformLeadStatus, number>)
  }, [items])

  const resetFilters = () => {
    setSearch("")
    setStatus("ALL")
    setConvertedFilter("ALL")
  }

  return (
    <div className="space-y-6">
      <SuperadminPageHeader
        eyebrow="Prodajni pipeline"
        title="Leadovi"
        subtitle="Pratite prodajni pipeline i konvertujte kvalifikovane agencije."
      />

      {error ? <SuperadminErrorState message={error} onRetry={load} /> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SuperadminStatCard title="Novi leadovi" value={statusCounts.NEW ?? 0} subtitle="U trenutno prikazanim rezultatima" icon={UserRoundPlus} tone="info" loading={loading} />
        <SuperadminStatCard title="Kvalifikovani" value={statusCounts.QUALIFIED ?? 0} subtitle="Spremni za sledeći korak" icon={Users} tone="success" loading={loading} />
        <SuperadminStatCard title="Za praćenje" value={statusCounts.FOLLOW_UP ?? 0} subtitle="Potrebna naredna akcija" icon={MailWarning} tone="warning" loading={loading} />
        <SuperadminStatCard title="Konvertovani" value={statusCounts.CONVERTED ?? 0} subtitle="Pretvoreni u agencije" icon={MailCheck} tone="success" loading={loading} />
      </div>

      <Card className="border-border/80 bg-card shadow-sm">
        <CardContent className="grid gap-3 pt-6 md:grid-cols-[1fr_220px_220px_auto_auto]">
          <FormField id="lead-search" label="Pretraga leadova">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input id="lead-search" className="pl-9" placeholder="Ime, email ili agencija" value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => event.key === "Enter" && load()} />
            </div>
          </FormField>
          <FormField id="lead-status" label="Status">
            <Select value={status} onValueChange={(value) => setStatus(value as PlatformLeadStatus | "ALL")}>
              <SelectTrigger id="lead-status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Svi statusi</SelectItem>
                {statuses.map((item) => <SelectItem key={item} value={item}>{formatStatus(item)}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormField>
          <FormField id="lead-converted" label="Konverzija">
            <Select value={convertedFilter} onValueChange={(value) => setConvertedFilter(value as ConvertedFilter)}>
              <SelectTrigger id="lead-converted"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Svi leadovi</SelectItem>
                <SelectItem value="CONVERTED">Konvertovani</SelectItem>
                <SelectItem value="NOT_CONVERTED">Nekonvertovani</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <div className="flex items-end">
            <Button variant="outline" onClick={load} className="min-h-11 w-full">Primeni</Button>
          </div>
          <div className="flex items-end">
            <Button variant="ghost" onClick={resetFilters} className="min-h-11 w-full">Resetuj</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/80 bg-card shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">{loading ? "Učitavamo leadove..." : `Prikazano: ${items.length} leadova`}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <TableSkeleton columns={6} />
          ) : items.length === 0 ? (
            <SuperadminEmptyState
              icon={UserRoundPlus}
              title="Nema leadova za prikaz"
              description="Leadovi će se pojaviti kada neko pošalje marketing formu ili kada promenite filtere."
              action={<Button variant="outline" onClick={resetFilters}>Resetuj filtere</Button>}
            />
          ) : (
            <>
              <div className="hidden md:block">
                <Table aria-label="Lista leadova">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kontakt</TableHead>
                      <TableHead>Agencija</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Potencijal</TableHead>
                      <TableHead>Email status</TableHead>
                      <TableHead>Kreiran</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((lead) => (
                      <TableRow key={lead.id}>
                        <TableCell>
                          <DetailLink href={`/superadmin/leads/${lead.id}`}>{lead.name}</DetailLink>
                          <p className="text-xs text-muted-foreground">{lead.email}</p>
                        </TableCell>
                        <TableCell>{lead.agencyName}</TableCell>
                        <TableCell>{statusBadge(lead.status)}</TableCell>
                        <TableCell>{formatStatus(lead.departuresPerDay)}</TableCell>
                        <TableCell>{lead.lastEmailError ? statusBadge("SPAM") : lead.confirmationEmailSentAt ? "Potvrda poslata" : "Nije dostupno"}</TableCell>
                        <TableCell>{formatMaybeDate(lead.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="grid gap-3 md:hidden">
                {items.map((lead) => (
                  <div key={lead.id} className="rounded-xl border bg-card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <DetailLink href={`/superadmin/leads/${lead.id}`}>{lead.name}</DetailLink>
                        <p className="text-xs text-muted-foreground">{lead.email}</p>
                      </div>
                      {statusBadge(lead.status)}
                    </div>
                    <div className="mt-4 grid gap-2 text-sm">
                      <p><span className="text-muted-foreground">Agencija:</span> {lead.agencyName}</p>
                      <p><span className="text-muted-foreground">Potencijal:</span> {formatStatus(lead.departuresPerDay)}</p>
                      <p><span className="text-muted-foreground">Kreiran:</span> {formatMaybeDate(lead.createdAt)}</p>
                    </div>
                    <Button asChild variant="outline" className="mt-4 min-h-11 w-full">
                      <Link href={`/superadmin/leads/${lead.id}`}>Otvori lead</Link>
                    </Button>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
