"use client"

import { Layout } from "@/components/layout/Layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency } from "@/utils/formatters"
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Activity, BarChart3, Bus, MapPin, Route, Ticket, Wallet } from "lucide-react"

const kpiCards = [
  {
    title: "Ukupno Stanica",
    value: "128",
    subtitle: "+6 novih ovog meseca",
    icon: MapPin,
  },
  {
    title: "Ukupno Linija",
    value: "46",
    subtitle: "38 aktivnih, 8 pauziranih",
    icon: Route,
  },
  {
    title: "Danas Rezervacija",
    value: "312",
    subtitle: "+14% u odnosu na juče",
    icon: Ticket,
  },
  {
    title: "Aktivne Vožnje",
    value: "19",
    subtitle: "Prosečna popunjenost 78%",
    icon: Bus,
  },
]

const reservationsTrendData = [
  { day: "01 Mar", reservations: 182 },
  { day: "02 Mar", reservations: 194 },
  { day: "03 Mar", reservations: 205 },
  { day: "04 Mar", reservations: 228 },
  { day: "05 Mar", reservations: 241 },
  { day: "06 Mar", reservations: 256 },
  { day: "07 Mar", reservations: 271 },
  { day: "08 Mar", reservations: 248 },
  { day: "09 Mar", reservations: 262 },
  { day: "10 Mar", reservations: 276 },
  { day: "11 Mar", reservations: 289 },
  { day: "12 Mar", reservations: 301 },
  { day: "13 Mar", reservations: 309 },
  { day: "14 Mar", reservations: 312 },
]

const revenueTrendData = [
  { day: "01 Mar", revenue: 426000 },
  { day: "02 Mar", revenue: 451000 },
  { day: "03 Mar", revenue: 468000 },
  { day: "04 Mar", revenue: 496000 },
  { day: "05 Mar", revenue: 513000 },
  { day: "06 Mar", revenue: 538000 },
  { day: "07 Mar", revenue: 562000 },
  { day: "08 Mar", revenue: 541000 },
  { day: "09 Mar", revenue: 559000 },
  { day: "10 Mar", revenue: 584000 },
  { day: "11 Mar", revenue: 602000 },
  { day: "12 Mar", revenue: 621000 },
  { day: "13 Mar", revenue: 639000 },
  { day: "14 Mar", revenue: 652000 },
]

const chartColors = {
  reservations: "hsl(var(--chart-1))",
  revenue: "hsl(var(--chart-2))",
}

const tooltipStyle = {
  background: "hsl(var(--background))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  color: "hsl(var(--foreground))",
}

export default function DashboardPage() {
  return (
    <Layout>
      <div className="space-y-6 pb-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <BarChart3 className="h-6 w-6 text-primary" />
            Analitika
          </h1>
          <p className="text-muted-foreground">
            Pregled ključnih metrika rezervacija i performansi linija
          </p>
        </div>

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

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="border-border/80 bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Ticket className="h-4 w-4 text-primary" />
                Rezervacije po danu (14 dana)
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={reservationsTrendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line
                    type="monotone"
                    dataKey="reservations"
                    stroke={chartColors.reservations}
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: chartColors.reservations }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Wallet className="h-4 w-4 text-primary" />
                Prihod po danu (14 dana)
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueTrendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chartColors.revenue} stopOpacity={0.35} />
                      <stop offset="95%" stopColor={chartColors.revenue} stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                  <YAxis
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    tickFormatter={(value) => `${Math.round(value / 1000)}k`}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value) => formatCurrency(Number(value ?? 0))}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke={chartColors.revenue}
                    strokeWidth={2.5}
                    fill="url(#revenueFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  )
}










