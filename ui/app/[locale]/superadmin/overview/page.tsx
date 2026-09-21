"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  AuditTimeline,
  KpiGridSkeleton,
  SuperadminEmptyState,
  SuperadminErrorState,
  SuperadminPageHeader,
  SuperadminStatCard,
} from "@/components/superadmin/SuperadminShared"
import {
  getPlatformAnalyticsOverview,
  listPlatformAudit,
  type PlatformAnalyticsOverview,
  type PlatformAuditEvent,
} from "@/infrastructure/requests/superadmin.requests"
import { getApiErrorMessage } from "@/infrastructure/utils/errors"
import { Activity, BarChart3, Building2, Store, Ticket, TrendingUp, UserRoundPlus, Users } from "lucide-react"

const tooltipStyle = {
  background: "hsl(var(--background))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "10px",
  color: "hsl(var(--foreground))",
}

function formatShortDate(value: string): string {
  const date = new Date(value)
  return date.toLocaleDateString("sr-RS", { day: "2-digit", month: "2-digit" })
}

export default function SuperadminOverviewPage() {
  const [overview, setOverview] = useState<PlatformAnalyticsOverview | null>(null)
  const [activity, setActivity] = useState<PlatformAuditEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const [overviewResult, auditResult] = await Promise.all([
        getPlatformAnalyticsOverview(),
        listPlatformAudit({ pageSize: 6 }),
      ])
      setOverview(overviewResult)
      setActivity(auditResult.items)
      setError(null)
    } catch (err) {
      setError(getApiErrorMessage(err, "Ne možemo da učitamo pregled platforme. Pokušajte ponovo."))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const summary = overview?.summary
  const rangeLabel = overview ? `${formatShortDate(overview.range.fromDate)} – ${formatShortDate(overview.range.toDate)}` : "Poslednjih 30 dana"
  const topAgencyChartData = useMemo(
    () =>
      overview?.topAgencies.map((agency) => ({
        name: agency.tenantName,
        rezervacije: agency.reservationsInPeriod,
      })) ?? [],
    [overview]
  )

  return (
    <div className="space-y-6">
      <SuperadminPageHeader
        eyebrow="Superadmin"
        title="Kontrolni centar platforme"
        subtitle="Pregled agencija, leadova, rezervacija i aktivnosti na SURP platformi."
        badge={<span className="rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">Period: {rangeLabel}</span>}
      />

      {error ? <SuperadminErrorState message={error} onRetry={load} /> : null}

      {loading ? (
        <KpiGridSkeleton count={8} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SuperadminStatCard title="Aktivne agencije" value={`${summary?.activeAgencies ?? 0}/${summary?.totalAgencies ?? 0}`} subtitle="Agencije koje trenutno koriste sistem" icon={Building2} tone="success" />
          <SuperadminStatCard title="Aktivni korisnici" value={`${summary?.activeUsers ?? 0}/${summary?.totalUsers ?? 0}`} subtitle="Korisnici sa aktivnim nalogom" icon={Users} tone="info" />
          <SuperadminStatCard title="Rezervacije" value={summary?.reservationsInPeriod ?? 0} subtitle="U izabranom periodu" icon={Ticket} tone="info" />
          <SuperadminStatCard title="Konverzija leadova" value={`${summary?.leadConversionRatePercent ?? 0}%`} subtitle={`${summary?.convertedLeadsInPeriod ?? 0} konvertovanih`} icon={TrendingUp} tone="success" />
          <SuperadminStatCard title="Aktivne vožnje" value={summary?.activeRides ?? 0} subtitle={`${summary?.activeLines ?? 0} aktivnih linija`} icon={BarChart3} tone="neutral" />
          <SuperadminStatCard title="Putnici" value={summary?.totalPassengers ?? 0} subtitle="Ukupno kroz sve agencije" icon={Users} tone="neutral" />
          <SuperadminStatCard title="Otvoreni tiketi" value={summary?.openTickets ?? 0} subtitle="Tiketi koji traže pažnju" icon={Activity} tone={summary?.openTickets ? "warning" : "success"} />
          <SuperadminStatCard title="Objavljeni javni izlozi" value={summary?.publishedStorefronts ?? 0} subtitle="Aktivni javni profili" icon={Store} tone="success" />
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(360px,0.8fr)]">
        <Card className="border-border/80 bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Trend rezervacija i leadova</CardTitle>
          </CardHeader>
          <CardContent className="h-[320px]">
            {loading ? (
              <div className="h-full animate-pulse rounded-lg bg-muted" aria-busy="true" />
            ) : overview?.dailyTrend.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={overview.dailyTrend} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tickFormatter={formatShortDate} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                  <Tooltip contentStyle={tooltipStyle} labelFormatter={(value) => formatShortDate(String(value))} />
                  <Legend />
                  <Line type="monotone" dataKey="reservations" name="Rezervacije" stroke="hsl(var(--chart-1))" strokeWidth={2.5} dot={{ r: 2 }} />
                  <Line type="monotone" dataKey="leads" name="Leadovi" stroke="hsl(var(--chart-2))" strokeWidth={2.5} strokeDasharray="5 5" dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <SuperadminEmptyState title="Nema podataka za grafikon" description="Još nema dovoljno rezervacija ili leadova u izabranom periodu." />
            )}
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Top agencije po rezervacijama</CardTitle>
          </CardHeader>
          <CardContent className="h-[320px]">
            {loading ? (
              <div className="h-full animate-pulse rounded-lg bg-muted" aria-busy="true" />
            ) : topAgencyChartData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topAgencyChartData} layout="vertical" margin={{ top: 10, right: 20, left: 15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="rezervacije" name="Rezervacije" fill="hsl(var(--chart-3))" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <SuperadminEmptyState title="Nema top agencija" description="Top lista će se pojaviti kada agencije budu imale rezervacije." />
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/80 bg-card shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Poslednja superadmin aktivnost</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3" aria-busy="true">
              <div className="h-16 animate-pulse rounded-lg bg-muted" />
              <div className="h-16 animate-pulse rounded-lg bg-muted" />
              <div className="h-16 animate-pulse rounded-lg bg-muted" />
            </div>
          ) : (
            <AuditTimeline items={activity} compact />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
