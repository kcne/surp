"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  AuditTimeline,
  FormField,
  SuperadminEmptyState,
  SuperadminErrorState,
  SuperadminPageHeader,
  formatAuditAction,
  formatMaybeDate,
  formatTargetType,
} from "@/components/superadmin/SuperadminShared"
import { listPlatformAudit, type PlatformAuditEvent } from "@/infrastructure/requests/superadmin.requests"
import { getApiErrorMessage } from "@/infrastructure/utils/errors"
import { Activity } from "lucide-react"

const actions = ["ALL", "TENANT_CREATED", "TENANT_ACTIVATED", "TENANT_DEACTIVATED", "TENANT_ADMIN_CREATED", "LEAD_UPDATED", "LEAD_CONVERTED_TO_TENANT"]
const targetTypes = ["ALL", "TENANT", "USER", "MARKETING_LEAD"]

export default function SuperadminActivityPage() {
  const [items, setItems] = useState<PlatformAuditEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [action, setAction] = useState("ALL")
  const [targetType, setTargetType] = useState("ALL")

  const load = async () => {
    setLoading(true)
    try {
      const result = await listPlatformAudit({
        pageSize: 50,
        action: action === "ALL" ? undefined : action,
        targetType: targetType === "ALL" ? undefined : targetType,
      })
      setItems(result.items)
      setError(null)
    } catch (err) {
      setError(getApiErrorMessage(err, "Ne možemo da učitamo audit log. Pokušajte ponovo."))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="space-y-6">
      <SuperadminPageHeader
        eyebrow="Audit log"
        title="Audit aktivnost"
        subtitle="Pregled superadmin akcija i promena na platformi."
      />

      {error ? <SuperadminErrorState message={error} onRetry={load} /> : null}

      <Card className="border-border/80 bg-card shadow-sm">
        <CardContent className="grid gap-3 pt-6 md:grid-cols-[240px_240px_auto]">
          <FormField id="activity-action" label="Akcija">
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger id="activity-action"><SelectValue /></SelectTrigger>
              <SelectContent>
                {actions.map((item) => <SelectItem key={item} value={item}>{item === "ALL" ? "Sve akcije" : formatAuditAction(item)}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormField>
          <FormField id="activity-target" label="Tip objekta">
            <Select value={targetType} onValueChange={setTargetType}>
              <SelectTrigger id="activity-target"><SelectValue /></SelectTrigger>
              <SelectContent>
                {targetTypes.map((item) => <SelectItem key={item} value={item}>{item === "ALL" ? "Svi objekti" : formatTargetType(item)}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormField>
          <div className="flex items-end">
            <Button variant="outline" onClick={load} className="min-h-11 w-full">Primeni filtere</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <Card className="min-w-0 border-border/80 bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3" aria-busy="true">
                <div className="h-16 animate-pulse rounded-lg bg-muted" />
                <div className="h-16 animate-pulse rounded-lg bg-muted" />
                <div className="h-16 animate-pulse rounded-lg bg-muted" />
              </div>
            ) : (
              <AuditTimeline items={items} />
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0 border-border/80 bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Događaji</CardTitle>
          </CardHeader>
          <CardContent className="min-w-0">
            {loading ? (
              <div className="space-y-3" aria-busy="true">
                <div className="h-24 animate-pulse rounded-xl bg-muted" />
                <div className="h-24 animate-pulse rounded-xl bg-muted" />
                <div className="h-24 animate-pulse rounded-xl bg-muted" />
              </div>
            ) : items.length === 0 ? (
              <SuperadminEmptyState
                icon={Activity}
                title="Nema događaja"
                description="Nema audit događaja za izabrane filtere."
              />
            ) : (
              <div className="space-y-3">
                {items.map((item) => (
                  <AuditEventCard key={item.id} item={item} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function AuditEventCard({ item }: { item: PlatformAuditEvent }) {
  const targetName = item.targetDisplayName ?? item.targetTenantDisplayName ?? item.targetLeadDisplayName ?? "Nije dostupno"

  return (
    <article className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="text-base font-semibold">{formatAuditAction(item.action)}</p>
          <p className="text-sm text-muted-foreground">
            {formatTargetType(item.targetType)}: <span className="font-medium text-foreground">{targetName}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            Korisnik: <span className="font-medium text-foreground">{item.actorDisplayName ?? "Nije dostupno"}</span>
          </p>
          {item.targetTenantDisplayName ? (
            <p className="text-sm text-muted-foreground">
              Tenant: <span className="font-medium text-foreground">{item.targetTenantDisplayName}</span>
            </p>
          ) : null}
        </div>
        <time className="shrink-0 text-sm text-muted-foreground">{formatMaybeDate(item.createdAt)}</time>
      </div>

      <details className="mt-3 rounded-lg bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <summary className="cursor-pointer select-none font-medium text-foreground">Tehnički detalji</summary>
        <div className="mt-2 space-y-1 font-mono">
          <p className="break-all">targetId: {item.targetId}</p>
          <p className="break-all">actorUserId: {item.actorUserId}</p>
          {item.targetTenantId ? <p className="break-all">targetTenantId: {item.targetTenantId}</p> : null}
          {item.targetLeadId ? <p className="break-all">targetLeadId: {item.targetLeadId}</p> : null}
          {item.targetUserId ? <p className="break-all">targetUserId: {item.targetUserId}</p> : null}
        </div>
      </details>
    </article>
  )
}
