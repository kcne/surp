"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useParams } from "next/navigation"
import { FileText } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Layout } from "@/components/layout/Layout"
import { Skeleton } from "@/components/ui/skeleton"
import { usePassengerListDetailPage } from "@/hooks/usePassengerListDetailPage"
import { PASSENGER_LIST_HEADERS, toPassengerListCells } from "@/utils/passengerListHelpers"
import { createPassengerListPdf } from "@/utils/passengerListPdf"

export default function PassengerListDetailPage() {
  const params = useParams<{ rideId: string }>()
  const rideId = decodeURIComponent(params?.rideId ?? "")
  const {
    rideInstance,
    rows,
    heading,
    isLoading,
    isRowsLoading,
    isNotFound,
  } = usePassengerListDetailPage({ rideId })
  const hasOpenedPdf = useRef(false)
  const [pdfError, setPdfError] = useState<string | null>(null)
  const [exportAttempt, setExportAttempt] = useState(0)

  const retryPdfExport = useCallback(() => {
    setPdfError(null)
    setExportAttempt((attempt) => attempt + 1)
  }, [])

  useEffect(() => {
    if (hasOpenedPdf.current || isLoading || isRowsLoading || !rideInstance) {
      return
    }

    hasOpenedPdf.current = true
    let isCurrent = true

    void createPassengerListPdf({
      heading,
      headers: [...PASSENGER_LIST_HEADERS],
      rows: rows.map((row) => toPassengerListCells(row)),
      groupedRowIndexes: new Set(
        rows.flatMap((row, index) => (row.hasGroupOverlay ? [index] : []))
      ),
    })
      .then((doc) => {
        if (isCurrent) {
          window.location.replace(URL.createObjectURL(doc.output("blob")))
        }
      })
      .catch(() => {
        if (isCurrent) {
          hasOpenedPdf.current = false
          setPdfError("PDF lista nije mogla biti pripremljena. Pokušajte ponovo.")
        }
      })

    return () => {
      isCurrent = false
    }
  }, [exportAttempt, heading, isLoading, isRowsLoading, rideInstance, rows])

  if (isNotFound) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <FileText className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-lg font-medium text-muted-foreground">Vožnja nije pronađena</p>
          <p className="mb-4 text-sm text-muted-foreground">
            Vožnja za traženi datum više ne postoji u rasporedu.
          </p>
        </div>
      </Layout>
    )
  }

  if (isLoading || !rideInstance) {
    return (
      <Layout>
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center">
        <FileText className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
        {pdfError ? (
          <Alert variant="destructive" className="max-w-md text-left">
            <AlertTitle>PDF nije otvoren</AlertTitle>
            <AlertDescription className="space-y-3">
              <p>{pdfError}</p>
              <Button type="button" variant="outline" onClick={retryPdfExport}>
                Pokušaj ponovo
              </Button>
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <p className="font-medium">Otvaram listu putnika kao PDF…</p>
            <p className="text-sm text-muted-foreground">
              PDF će se otvoriti u ovom tabu, spreman za štampanje.
            </p>
          </>
        )}
      </div>
    </Layout>
  )
}
