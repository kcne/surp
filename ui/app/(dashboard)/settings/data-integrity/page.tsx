"use client"

import Link from "next/link"
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  RefreshCw,
  ShieldAlert,
} from "lucide-react"
import { Layout } from "@/components/layout/Layout"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { InvariantSummaryTable } from "@/components/settings/InvariantSummaryTable"
import { formatRunMoment, triggerLabel } from "@/components/settings/invariant-status"
import { useCheckInvariantsMutation } from "@/infrastructure/hooks/mutations/useInvariantMutations"
import { useInvariantSummaryQuery } from "@/infrastructure/hooks/queries/useInvariantSummaryQuery"
import { useAuthStore } from "@/stores/authStore"

export default function DataIntegrityPage() {
  const { user } = useAuthStore()

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

  return <DataIntegrityContent />
}

function DataIntegrityContent() {
  const summaryQuery = useInvariantSummaryQuery()
  const checkMutation = useCheckInvariantsMutation()

  const summary = summaryQuery.data
  const isBusy = summaryQuery.isFetching || checkMutation.isPending

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Button asChild variant="ghost" size="sm" className="-ml-3 mb-1">
              <Link href="/settings">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Podesavanja
              </Link>
            </Button>
            <h1 className="text-2xl font-bold">Ispravnost podataka</h1>
            <p className="text-muted-foreground">
              Svaka provera je tvrdnja o podacima koja mora da vazi. Proveravaju se same svake
              noci, a ovde mozete da ih pokrenete odmah.
            </p>
          </div>

          <Button type="button" onClick={() => checkMutation.mutate()} disabled={isBusy}>
            {checkMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Proveri sve
          </Button>
        </div>

        {summaryQuery.isError ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Provere nisu ucitane</AlertTitle>
            <AlertDescription>
              {summaryQuery.error instanceof Error
                ? summaryQuery.error.message
                : "Neuspesno ucitavanje provera"}
            </AlertDescription>
          </Alert>
        ) : null}

        {summaryQuery.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : null}

        {summary ? (
          <>
            <SummaryBanner summary={summary} />
            <InvariantSummaryTable items={summary.items} />
          </>
        ) : null}
      </div>
    </Layout>
  )
}

/**
 * The one-sentence answer.
 *
 * "Sve je u redu" on its own is the version of this page that gets trusted for
 * a week after the checks quietly stopped running, so the clean state names the
 * run it is speaking for.
 */
function SummaryBanner({
  summary,
}: {
  summary: NonNullable<ReturnType<typeof useInvariantSummaryQuery>["data"]>
}) {
  const lastRun = summary.lastRun
  const ranAt = lastRun?.completedAt ?? lastRun?.startedAt

  if (!lastRun) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Nijedna provera jos nije pokrenuta</AlertTitle>
        <AlertDescription>
          Broj dostupnih provera: {summary.invariantCount}. Nijedna jos nema zapisan rezultat za ovu
          agenciju. Pokrenite &quot;Proveri sve&quot; da biste dobili prvo stanje.
        </AlertDescription>
      </Alert>
    )
  }

  const ranLine = `Poslednja provera: ${formatRunMoment(ranAt)} (${triggerLabel(
    lastRun.trigger
  )}), ${summary.invariantCount} provera, ${lastRun.windowDays} dana unapred.`

  if (summary.totalViolationCount === 0) {
    return (
      <Alert>
        <CheckCircle2 className="h-4 w-4" />
        <AlertTitle>Nijedna provera ne prijavljuje problem</AlertTitle>
        <AlertDescription>{ranLine}</AlertDescription>
      </Alert>
    )
  }

  return (
    <Alert variant={summary.criticalViolatedCount > 0 ? "destructive" : "default"}>
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>
        {summary.criticalViolatedCount > 0
          ? `Broj kriticnih provera sa problemima: ${summary.criticalViolatedCount}`
          : `Broj provera sa problemima: ${summary.violatedCount}`}
      </AlertTitle>
      <AlertDescription>
        Ukupan broj problema: {summary.totalViolationCount}. {ranLine}
      </AlertDescription>
    </Alert>
  )
}
