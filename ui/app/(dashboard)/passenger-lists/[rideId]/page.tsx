"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { ClipboardList } from "lucide-react"
import { Layout } from "@/components/layout/Layout"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { PassengerListTable } from "@/components/passenger-lists/PassengerListTable"
import { usePassengerListDetailPage } from "@/hooks/usePassengerListDetailPage"
import { formatTimeDisplay } from "@/utils/dateHelpers"

export default function PassengerListDetailPage() {
  const params = useParams<{ rideId: string }>()
  const rideId = decodeURIComponent(params?.rideId ?? "")
  const {
    rideInstance,
    rows,
    heading,
    passengerCount,
    capacity,
    freeSeats,
    isLoading,
    isRowsLoading,
    isNotFound,
  } = usePassengerListDetailPage({ rideId })

  if (isNotFound) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <ClipboardList className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-lg font-medium text-muted-foreground">Vožnja nije pronađena</p>
          <p className="mb-4 text-sm text-muted-foreground">
            Vožnja za traženi datum više ne postoji u rasporedu.
          </p>
          <Button asChild>
            <Link href="/passenger-lists">Nazad na liste putnika</Link>
          </Button>
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
      <div className="space-y-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/passenger-lists">Liste Putnika</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{rideInstance.ride.line.name}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="rounded-lg border bg-card p-4">
          <h1 className="text-xl font-bold sm:text-2xl">{rideInstance.ride.line.name}</h1>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Polazak</p>
              <p className="font-medium tabular-nums">
                {formatTimeDisplay(rideInstance.departureTime)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Dolazak</p>
              <p className="font-medium tabular-nums">
                {formatTimeDisplay(rideInstance.arrivalTime)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Putnici</p>
              <p className="font-medium tabular-nums">
                {passengerCount}/{capacity}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Slobodno</p>
              <p className="font-medium tabular-nums">{freeSeats}</p>
            </div>
          </div>
        </div>

        {isRowsLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
            <ClipboardList className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-lg font-medium text-muted-foreground">Nema rezervacija</p>
            <p className="text-sm text-muted-foreground">
              Za ovu vožnju još uvek nema aktivnih rezervacija.
            </p>
          </div>
        ) : (
          <PassengerListTable heading={heading} rows={rows} />
        )}
      </div>
    </Layout>
  )
}
