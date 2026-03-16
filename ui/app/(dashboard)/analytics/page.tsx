"use client"

import { useMemo } from "react"
import { Layout } from "@/components/layout/Layout"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useDashboardAnalyticsPage } from "@/hooks/useDashboardAnalyticsPage"
import { formatDateTime } from "@/utils/formatters"
import {
  AreaChart,
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bus,
  MapPin,
  Route,
  Ticket,
  Users,
} from "lucide-react"

const chartColors = {
  reservations: "hsl(var(--chart-1))",
  occupancy: "hsl(var(--chart-2))",
  topLines: "hsl(var(--chart-3))",
}

const tooltipStyle = {
  background: "hsl(var(--background))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  color: "hsl(var(--foreground))",
}

function formatShortDate(value: string): string {
  const date = new Date(value)

  return date.toLocaleDateString("sr-RS", {
    day: "2-digit",
    month: "2-digit",
  })
}

function formatPercent(value: number): string {
  return `${Math.round(value)}%`
}

function getActionBadgeVariant(action: string): "default" | "secondary" {
  if (action === "CREATED") {
    return "default"
  }

  return "secondary"
}

function formatActor(actor: unknown): string {
  if (typeof actor === "string" && actor.length > 0) {
    return actor
  }

  if (actor && typeof actor === "object") {
    return "system"
  }

  return "n/a"
}

export default function DashboardPage() {
  const {
    isLoading,
    errorMessage,
    dashboard,
    occupancy,
    reservationsTrend,
    occupancyTrend,
    topLines,
    auditItems,
  } = useDashboardAnalyticsPage()

  const kpiCards = useMemo(() => {
    if (!dashboard) {
      return []
    }

    return [
      {
        title: "Ukupno rezervacija",
        value: dashboard.summary.totalReservations.toLocaleString("sr-RS"),
        subtitle: `${dashboard.summary.activeReservations.toLocaleString("sr-RS")} aktivnih`,
        icon: Ticket,
      },
      {
        title: "Aktivne vožnje",
        value: dashboard.summary.activeRides.toLocaleString("sr-RS"),
        subtitle: `${dashboard.summary.activeLines.toLocaleString("sr-RS")} aktivnih linija`,
        icon: Bus,
      },
      {
        title: "Putnici",
        value: dashboard.summary.totalPassengers.toLocaleString("sr-RS"),
        subtitle: `${dashboard.summary.activePassengers.toLocaleString("sr-RS")} aktivnih`,
        icon: Users,
      },
      {
        title: "Stanice",
        value: dashboard.summary.totalStations.toLocaleString("sr-RS"),
        subtitle: `${dashboard.summary.uniqueBookedPassengers.toLocaleString("sr-RS")} jedinstveno rezervisalo`,
        icon: MapPin,
      },
    ]
  }, [dashboard])

  const topLinesChartData = useMemo(() => {
    return topLines.map((line) => ({
      lineName: line.lineName,
      totalReservations: line.totalReservations,
      utilizationPercent: line.utilizationPercent,
    }))
  }, [topLines])

  return (
    <Layout>
      <div className="space-y-6 pb-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <BarChart3 className="h-6 w-6 text-primary" />
            Analitika
          </h1>
          <p className="text-muted-foreground">
            Metrike i trendovi direktno iz reporting API-ja
          </p>
        </div>

        {errorMessage ? (
          <Card className="border-border/80 bg-card shadow-sm">
            <CardContent className="flex items-center gap-2 pt-6 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4" />
              {errorMessage}
            </CardContent>
          </Card>
        ) : null}

        {isLoading && kpiCards.length === 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {kpiCards.map((item) => {
              const Icon = item.icon

              return (
                <Card key={item.title} className="border-border/80 bg-card shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{item.title}</CardTitle>
                    <div className="rounded-md bg-primary/10 p-1.5 text-primary">
                      <Icon className="h-4 w-4" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{item.value}</div>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Activity className="h-3 w-3" />
                      {item.subtitle}
                    </p>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="border-border/80 bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Ticket className="h-4 w-4 text-primary" />
                Rezervacije po danu
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
              {reservationsTrend.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Nema podataka za izabrani period.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={reservationsTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatShortDate}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      labelFormatter={(value) => formatShortDate(String(value))}
                    />
                    <Line
                      type="monotone"
                      dataKey="activeReservations"
                      name="Aktivne"
                      stroke={chartColors.reservations}
                      strokeWidth={2.5}
                      dot={{ r: 2 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="cancelledReservations"
                      name="Otkazane"
                      stroke="hsl(var(--destructive))"
                      strokeWidth={2}
                      dot={{ r: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Route className="h-4 w-4 text-primary" />
                Trend popunjenosti
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
              {occupancyTrend.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Nema podataka za izabrani period.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={occupancyTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="occupancyFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={chartColors.occupancy} stopOpacity={0.35} />
                        <stop offset="95%" stopColor={chartColors.occupancy} stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatShortDate}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    />
                    <YAxis
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                      tickFormatter={(value) => `${value}%`}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(value) => `${Number(value).toFixed(1)}%`}
                      labelFormatter={(value) => formatShortDate(String(value))}
                    />
                    <Area
                      type="monotone"
                      dataKey="utilizationPercent"
                      name="Popunjenost"
                      stroke={chartColors.occupancy}
                      strokeWidth={2.5}
                      fill="url(#occupancyFill)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="border-border/80 bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Top linije</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {topLinesChartData.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nema top linija za izabrani period.</p>
              ) : (
                <>
                  <div className="h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topLinesChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis
                          dataKey="lineName"
                          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                          interval={0}
                          angle={-20}
                          textAnchor="end"
                          height={56}
                        />
                        <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Bar dataKey="totalReservations" fill={chartColors.topLines} radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="space-y-2">
                    {topLines.map((line) => (
                      <div key={line.lineId} className="flex items-center justify-between rounded-md border p-2 text-sm">
                        <span className="truncate pr-2">{line.lineName}</span>
                        <span className="text-muted-foreground">{formatPercent(line.utilizationPercent)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Poslednje audit promene</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {auditItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nema audit zapisa za izabrane filtere.</p>
              ) : (
                auditItems.map((item) => (
                  <div key={`${item.entity}-${item.entityId}-${item.changedAt}`} className="rounded-md border p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Badge variant={getActionBadgeVariant(item.action)}>{item.action}</Badge>
                        <span>{item.entity}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{formatDateTime(item.changedAt)}</span>
                    </div>

                    <div className="text-xs text-muted-foreground">
                      entityId: {item.entityId} | actor: {formatActor(item.actorUserId)}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="border-border/80 bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Sažetak popunjenosti</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Aktivne rezervacije</p>
              <p className="text-xl font-semibold">
                {occupancy?.summary.totalActiveReservations.toLocaleString("sr-RS") ?? "0"}
              </p>
            </div>

            <div className="rounded-md border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Ukupan kapacitet</p>
              <p className="text-xl font-semibold">
                {occupancy?.summary.totalCapacity.toLocaleString("sr-RS") ?? "0"}
              </p>
            </div>

            <div className="rounded-md border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Ukupna popunjenost</p>
              <p className="text-xl font-semibold">
                {occupancy ? formatPercent(occupancy.summary.overallUtilizationPercent) : "0%"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  )
}










