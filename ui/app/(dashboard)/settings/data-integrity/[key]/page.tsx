"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2, ShieldAlert, Wrench } from "lucide-react"
import { Layout } from "@/components/layout/Layout"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { InvariantHistoryTable } from "@/components/settings/InvariantHistoryTable"
import { InvariantViolationsTable } from "@/components/settings/InvariantViolationsTable"
import {
  InvariantStatusBadge,
  formatRunMoment,
  invariantStatus,
  triggerLabel,
} from "@/components/settings/invariant-status"
import { useRepairInvariantMutation } from "@/infrastructure/hooks/mutations/useInvariantMutations"
import { useInvariantDetailQuery } from "@/infrastructure/hooks/queries/useInvariantDetailQuery"
import { useAuthStore } from "@/stores/authStore"

export default function InvariantDetailPage() {
  const params = useParams<{ key: string }>()
  const { user } = useAuthStore()
  const invariantKey = decodeURIComponent(
    Array.isArray(params?.key) ? params.key[0] : (params?.key ?? "")
  )

  if (user?.role !== "ADMIN") {
    return (
      <Layout>
        <Alert>
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Potrebne su admin dozvole</AlertTitle>
          <AlertDescription>
            Samo administratori agencije mogu da vide provere podataka.
          </AlertDescription>
        </Alert>
      </Layout>
    )
  }

  return <InvariantDetailContent invariantKey={invariantKey} />
}

function InvariantDetailContent({ invariantKey }: { invariantKey: string }) {
  const detailQuery = useInvariantDetailQuery(invariantKey)
  const repairMutation = useRepairInvariantMutation()

  const detail = detailQuery.data
  const lastRun = detail?.lastRun
  const ranAt = lastRun?.completedAt ?? lastRun?.startedAt
  const manualCount = (detail?.violationCount ?? 0) - (detail?.repairableCount ?? 0)

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-3 mb-1">
            <Link href="/settings/data-integrity">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Ispravnost podataka
            </Link>
          </Button>

          {detailQuery.isLoading ? (
            <Skeleton className="h-8 w-80" />
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold">{detail?.title ?? invariantKey}</h1>
              {detail ? (
                <InvariantStatusBadge
                  status={invariantStatus({
                    checked: detail.checked,
                    violationCount: detail.violationCount,
                    severity: detail.severity,
                  })}
                />
              ) : null}
            </div>
          )}
          <p className="text-sm text-muted-foreground">{invariantKey}</p>
        </div>

        {detailQuery.isError ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Provera nije ucitana</AlertTitle>
            <AlertDescription>
              {detailQuery.error instanceof Error
                ? detailQuery.error.message
                : "Neuspesno ucitavanje provere"}
            </AlertDescription>
          </Alert>
        ) : null}

        {detailQuery.isLoading ? <Skeleton className="h-64 w-full" /> : null}

        {detail ? (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Sta ova provera znaci</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">{detail.description}</p>

                {!detail.checked || !lastRun ? (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Ova provera jos nije pokrenuta</AlertTitle>
                    <AlertDescription>
                      Pokrenite &quot;Proveri sve&quot; na prethodnoj strani da biste dobili prvo
                      stanje.
                    </AlertDescription>
                  </Alert>
                ) : detail.violationCount === 0 ? (
                  <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertTitle>Nema problema</AlertTitle>
                    <AlertDescription>
                      Broj proverenih stavki: {detail.scannedCount}. Poslednja provera{" "}
                      {formatRunMoment(ranAt)} ({triggerLabel(lastRun.trigger)}).
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert variant={detail.severity === "critical" ? "destructive" : "default"}>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>
                      Problemi: {detail.violationCount} od {detail.scannedCount} pregledanih stavki
                    </AlertTitle>
                    <AlertDescription>
                      Poslednja provera {formatRunMoment(ranAt)} ({triggerLabel(lastRun.trigger)}).
                      {detail.repairableCount > 0
                        ? ` Broj stavki koje popravka moze da resi: ${detail.repairableCount}.`
                        : " Nijedan se ne ispravlja automatski."}
                    </AlertDescription>
                  </Alert>
                )}

                {detail.violationCount > 0 && manualCount > 0 ? (
                  <Alert>
                    <Wrench className="h-4 w-4" />
                    <AlertTitle>
                      {detail.repairableCount > 0
                        ? `Broj stavki za rucnu obradu: ${manualCount}`
                        : "Potrebna je rucna obrada"}
                    </AlertTitle>
                    <AlertDescription>{detail.manualAdvice}</AlertDescription>
                  </Alert>
                ) : null}

                {detail.hasRepair && detail.repairableCount > 0 ? (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button type="button" disabled={repairMutation.isPending}>
                        {repairMutation.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Wrench className="mr-2 h-4 w-4" />
                        )}
                        Popravi ({detail.repairableCount})
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Pokrenuti automatsku popravku?</AlertDialogTitle>
                        <AlertDialogDescription asChild>
                          <div className="space-y-2">
                            <p>
                              Popravka ce automatski obraditi {detail.repairableCount} stavki koje
                              sistem moze bezbedno da ispravi bez dodatne odluke.
                            </p>
                            {manualCount > 0 ? (
                              <p>
                                Broj stavki koje ostaju za rucnu obradu: <strong>{manualCount}</strong>.
                                Za njih popravka ne moze sama da donese odluku.
                              </p>
                            ) : null}
                            <p>
                              Posle popravke pokrenite &quot;Proveri sve&quot; da bi istorija
                              zabelezila novo stanje.
                            </p>
                          </div>
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Odustani</AlertDialogCancel>
                        <AlertDialogAction onClick={() => repairMutation.mutate(detail.key)}>
                          Popravi
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                ) : null}
              </CardContent>
            </Card>

            {detail.violations.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Problemi</CardTitle>
                </CardHeader>
                <CardContent>
                  <InvariantViolationsTable violations={detail.violations} />
                </CardContent>
              </Card>
            ) : null}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Istorija provera</CardTitle>
              </CardHeader>
              <CardContent>
                <InvariantHistoryTable points={detail.history} />
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </Layout>
  )
}
