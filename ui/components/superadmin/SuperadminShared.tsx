"use client"

import Link from "next/link"
import type { ComponentType, ReactNode } from "react"
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Circle,
  Clock3,
  Loader2,
  RefreshCw,
  ShieldAlert,
} from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button, type ButtonProps } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { formatDateTime } from "@/utils/formatters"

type Tone = "neutral" | "success" | "warning" | "danger" | "info"

const toneClasses: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground",
  success: "bg-emerald-500/10 text-emerald-700",
  warning: "bg-amber-500/10 text-amber-700",
  danger: "bg-destructive/10 text-destructive",
  info: "bg-primary/10 text-primary",
}

export function SuperadminPageHeader({
  title,
  subtitle,
  eyebrow,
  badge,
  breadcrumbs,
  actions,
}: {
  title: string
  subtitle?: string
  eyebrow?: string
  badge?: ReactNode
  breadcrumbs?: Array<{ label: string; href?: string }>
  actions?: ReactNode
}) {
  return (
    <div className="space-y-4">
      {breadcrumbs?.length ? (
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
          {breadcrumbs.map((item, index) => (
            <div key={`${item.label}-${index}`} className="flex items-center gap-1">
              {index > 0 ? <span>/</span> : null}
              {item.href ? (
                <Link href={item.href} className="rounded-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {item.label}
                </Link>
              ) : (
                <span className="text-foreground">{item.label}</span>
              )}
            </div>
          ))}
        </nav>
      ) : null}

      <div className="flex flex-col gap-4 rounded-2xl border bg-gradient-to-br from-card via-card to-primary/5 p-5 shadow-sm md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          {eyebrow ? <p className="text-xs font-semibold uppercase tracking-wide text-primary">{eyebrow}</p> : null}
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
            {badge}
          </div>
          {subtitle ? <p className="max-w-3xl text-sm leading-6 text-muted-foreground md:text-base">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-col gap-2 sm:flex-row md:shrink-0">{actions}</div> : null}
      </div>
    </div>
  )
}

export const PageHeader = SuperadminPageHeader

export function SuperadminStatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  tone = "neutral",
  loading = false,
}: {
  title: string
  value: ReactNode
  subtitle?: string
  icon?: ComponentType<{ className?: string }>
  tone?: Tone
  loading?: boolean
}) {
  return (
    <Card className="border-border/80 bg-card shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {Icon ? (
          <div className={cn("rounded-lg p-2", toneClasses[tone])}>
            <Icon className="h-4 w-4" aria-hidden="true" />
          </div>
        ) : null}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2" aria-busy="true">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-3 w-28" />
          </div>
        ) : (
          <>
            <div className="text-2xl font-bold tabular-nums md:text-3xl">{value}</div>
            {subtitle ? <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p> : null}
          </>
        )}
      </CardContent>
    </Card>
  )
}

export const StatCard = SuperadminStatCard

export function SuperadminEmptyState({
  icon: Icon = Circle,
  title,
  description,
  action,
}: {
  icon?: ComponentType<{ className?: string }>
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 p-8 text-center">
      <div className="mb-3 rounded-full bg-primary/10 p-3 text-primary">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

export function SuperadminErrorState({
  message,
  onRetry,
}: {
  message: string
  onRetry?: () => void
}) {
  return (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span>{message}</span>
        {onRetry ? (
          <Button variant="outline" size="sm" onClick={onRetry} className="border-destructive/40 bg-background">
            <RefreshCw className="h-4 w-4" />
            Pokušaj ponovo
          </Button>
        ) : null}
      </AlertDescription>
    </Alert>
  )
}

export function KpiGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" aria-busy="true">
      {Array.from({ length: count }).map((_, index) => (
        <Card key={index} className="border-border/80 shadow-sm">
          <CardHeader className="pb-2">
            <Skeleton className="h-4 w-28" />
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-3 w-32" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export function TableSkeleton({ rows = 5, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="space-y-3" aria-busy="true">
      {Array.from({ length: rows }).map((_, row) => (
        <div key={row} className="grid gap-3 rounded-lg border p-4" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {Array.from({ length: columns }).map((__, column) => (
            <Skeleton key={column} className="h-4 w-full" />
          ))}
        </div>
      ))}
    </div>
  )
}

export function FormField({
  id,
  label,
  helper,
  error,
  required,
  children,
}: {
  id: string
  label: string
  helper?: string
  error?: string | null
  required?: boolean
  children: ReactNode
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      {children}
      {helper ? <p className="text-xs text-muted-foreground">{helper}</p> : null}
      {error ? <p className="text-xs text-destructive" role="alert">{error}</p> : null}
    </div>
  )
}

export function LoadingButton({
  loading,
  loadingText = "Radim...",
  children,
  disabled,
  ...props
}: ButtonProps & {
  loading?: boolean
  loadingText?: string
}) {
  return (
    <Button disabled={disabled || loading} aria-busy={loading ? "true" : undefined} {...props}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
      {loading ? loadingText : children}
    </Button>
  )
}

export function ConfirmActionDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = "Odustani",
  destructive = false,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel: string
  cancelLabel?: string
  destructive?: boolean
  onConfirm: () => void
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className={destructive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : undefined}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function StatusBadge({ status }: { status: string }) {
  const tone = getStatusTone(status)
  return (
    <Badge variant={tone === "danger" ? "destructive" : tone === "neutral" ? "secondary" : "default"} className="gap-1.5">
      <span className={cn("h-2 w-2 rounded-full", getStatusDotClass(status))} aria-hidden="true" />
      {formatStatus(status)}
    </Badge>
  )
}

export function statusBadge(status: string) {
  return <StatusBadge status={status} />
}

export function activeBadge(isActive: boolean) {
  return <StatusBadge status={isActive ? "ACTIVE" : "INACTIVE"} />
}

export function formatMaybeDate(value: string | null | undefined): string {
  return value ? formatDateTime(value) : "Nije dostupno"
}

export function formatStatus(status: string): string {
  const labels: Record<string, string> = {
    ACTIVE: "Aktivna",
    INACTIVE: "Neaktivna",
    NEW: "Nov",
    CONTACTED: "Kontaktiran",
    QUALIFIED: "Kvalifikovan",
    FOLLOW_UP: "Za praćenje",
    CONVERTED: "Konvertovan",
    NOT_INTERESTED: "Nije zainteresovan",
    SPAM: "Spam",
    DRAFT: "Nacrt",
    PUBLISHED: "Objavljen",
    SUPERADMIN: "Superadmin",
    ONE_TO_FIVE: "1–5",
    SIX_TO_TWENTY: "6–20",
    TWENTY_ONE_TO_FIFTY: "21–50",
    FIFTY_PLUS: "50+",
  }

  return labels[status] ?? status
}

export function formatAuditAction(action: string): string {
  const labels: Record<string, string> = {
    TENANT_CREATED: "Agencija kreirana",
    TENANT_UPDATED: "Agencija ažurirana",
    TENANT_ACTIVATED: "Agencija aktivirana",
    TENANT_DEACTIVATED: "Agencija deaktivirana",
    TENANT_ADMIN_CREATED: "Admin korisnik kreiran",
    LEAD_UPDATED: "Lead ažuriran",
    LEAD_CONVERTED_TO_TENANT: "Lead konvertovan u agenciju",
  }

  return labels[action] ?? action
}

export function formatTargetType(targetType: string): string {
  const labels: Record<string, string> = {
    TENANT: "Agencija",
    USER: "Korisnik",
    MARKETING_LEAD: "Lead",
  }

  return labels[targetType] ?? targetType
}

export function AuditTimeline({
  items,
  compact = false,
}: {
  items: Array<{
    id: string
    action: string
    targetType: string
    targetId: string
    targetDisplayName?: string | null
    targetTenantId?: string | null
    targetTenantDisplayName?: string | null
    targetLeadId?: string | null
    targetLeadDisplayName?: string | null
    actorDisplayName?: string | null
    createdAt: string
  }>
  compact?: boolean
}) {
  if (items.length === 0) {
    return (
      <SuperadminEmptyState
        icon={Clock3}
        title="Nema audit aktivnosti"
        description="Superadmin akcije će se pojaviti ovde kada budu zabeležene."
      />
    )
  }

  return (
    <ol className="relative space-y-4 border-l pl-5">
      {items.map((item) => (
        <li key={item.id} className="relative">
          <span className="absolute -left-[29px] flex h-5 w-5 items-center justify-center rounded-full border bg-background text-primary">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          <div className={cn("rounded-lg border bg-card p-3", compact && "p-2.5")}>
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-medium">{formatAuditAction(item.action)}</p>
                <p className="text-sm text-muted-foreground">
                  {formatTargetType(item.targetType)}:{" "}
                  <span className="text-foreground">{item.targetDisplayName ?? item.targetTenantDisplayName ?? item.targetLeadDisplayName ?? item.targetId}</span>
                </p>
                {item.actorDisplayName ? <p className="text-xs text-muted-foreground">Korisnik: {item.actorDisplayName}</p> : null}
              </div>
              <time className="text-xs text-muted-foreground">{formatMaybeDate(item.createdAt)}</time>
            </div>
          </div>
        </li>
      ))}
    </ol>
  )
}

export function DetailLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 items-center gap-1 rounded-md font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {children}
      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
    </Link>
  )
}

export function RiskNotice({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div>{children}</div>
    </div>
  )
}

function getStatusTone(status: string): Tone {
  if (["CONVERTED", "PUBLISHED", "ACTIVE", "QUALIFIED"].includes(status)) {
    return "success"
  }
  if (["FOLLOW_UP", "CONTACTED", "DRAFT"].includes(status)) {
    return "warning"
  }
  if (["SPAM", "INACTIVE", "NOT_INTERESTED"].includes(status)) {
    return "danger"
  }
  if (status === "NEW") {
    return "info"
  }
  return "neutral"
}

function getStatusDotClass(status: string): string {
  const tone = getStatusTone(status)
  if (tone === "success") return "bg-emerald-500"
  if (tone === "warning") return "bg-amber-500"
  if (tone === "danger") return "bg-destructive"
  if (tone === "info") return "bg-primary"
  return "bg-muted-foreground"
}
