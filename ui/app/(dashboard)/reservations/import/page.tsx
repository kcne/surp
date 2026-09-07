"use client"

import Link from "next/link"
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2, Upload } from "lucide-react"
import { Layout } from "@/components/layout/Layout"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ImportDropzone } from "@/components/reservations/import/ImportDropzone"
import { ImportRowsTable } from "@/components/reservations/import/ImportRowsTable"
import { ImportSummaryBar } from "@/components/reservations/import/ImportSummaryBar"
import { useReservationsImportPage } from "@/hooks/useReservationsImportPage"

export default function ReservationsImportPage() {
  const {
    rows,
    summary,
    stations,
    rideInstancesById,
    parseWarnings,
    parseError,
    commitResult,
    isLoadingReference,
    isResolving,
    isCommitting,
    parseFile,
    updateRow,
    removeRow,
    toggleRowExcluded,
    applyStationToAllMatching,
    submit,
    reset,
  } = useReservationsImportPage()

  const hasRows = rows.length > 0

  return (
    <TooltipProvider delayDuration={200}>
      <Layout>
        <div className="space-y-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-bold">
                <Upload className="h-6 w-6 text-primary" />
                Uvoz rezervacija iz CSV-a
              </h1>
              <p className="text-muted-foreground">
                Ucitajte CSV, proverite prepoznate podatke i uvezite rezervacije
              </p>
            </div>

            <Button asChild variant="outline">
              <Link href="/reservations">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Nazad na rezervacije
              </Link>
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">1. Izaberite datoteku</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ImportDropzone
                fileName={parseWarnings?.fileName}
                disabled={isLoadingReference || isCommitting}
                onFileSelected={parseFile}
              />

              {isLoadingReference ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Ucitavanje stanica i voznji...
                </p>
              ) : null}

              {parseError ? (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>CSV nije mogao biti obradjen</AlertTitle>
                  <AlertDescription>{parseError}</AlertDescription>
                </Alert>
              ) : null}

              {parseWarnings && parseWarnings.unmappedHeaders.length > 0 ? (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Nepoznate kolone su preskocene</AlertTitle>
                  <AlertDescription>
                    {parseWarnings.unmappedHeaders.join(", ")}
                  </AlertDescription>
                </Alert>
              ) : null}
            </CardContent>
          </Card>

          {commitResult ? (
            <Alert variant={commitResult.failures.length > 0 ? "destructive" : "default"}>
              {commitResult.failures.length > 0 ? (
                <AlertTriangle className="h-4 w-4" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              <AlertTitle>
                Uvezeno {commitResult.createdReservationCount} rezervacija
                {commitResult.createdPassengerCount > 0
                  ? ` i kreirano ${commitResult.createdPassengerCount} putnika`
                  : ""}
              </AlertTitle>
              <AlertDescription>
                {commitResult.failures.length > 0 ? (
                  <>
                    <ul className="mt-1 space-y-1">
                      {commitResult.failures.map((failure) => (
                        <li key={`${failure.rideInstanceId ?? "row"}-${failure.rowIds.join("-")}`}>
                          {failure.rowIds.length} redova: {failure.message}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2">Neuspeli redovi ostaju u tabeli za ispravku.</p>
                  </>
                ) : (
                  "Svi redovi su uvezeni."
                )}
              </AlertDescription>
            </Alert>
          ) : null}

          {hasRows ? (
            <>
              <ImportSummaryBar
                summary={summary}
                isResolving={isResolving}
                isCommitting={isCommitting}
                onSubmit={submit}
                onReset={reset}
              />

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    2. Proverite i dopunite podatke
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ImportRowsTable
                    rows={rows}
                    stations={stations}
                    rideInstancesById={rideInstancesById}
                    onUpdateRow={updateRow}
                    onRemoveRow={removeRow}
                    onToggleExcluded={toggleRowExcluded}
                    onApplyStationToAllMatching={applyStationToAllMatching}
                  />
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>
      </Layout>
    </TooltipProvider>
  )
}
