"use client"

import { useEffect, useRef } from "react"
import { useParams } from "next/navigation"
import { FileText } from "lucide-react"
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
    }).then((doc) => {
      if (isCurrent) {
        window.location.replace(URL.createObjectURL(doc.output("blob")))
      }
    })

    return () => {
      isCurrent = false
    }
  }, [heading, isLoading, isRowsLoading, rideInstance, rows])

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
        <p className="font-medium">Otvaram listu putnika kao PDF…</p>
        <p className="text-sm text-muted-foreground">
          PDF će se otvoriti u ovom tabu, spreman za štampanje.
        </p>
      </div>
    </Layout>
  )
}
