"use client"

import { ClipboardList } from "lucide-react"
import { Layout } from "@/components/layout/Layout"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { PassengerListFilters } from "@/components/passenger-lists/PassengerListFilters"
import { UpcomingRidesTable } from "@/components/passenger-lists/UpcomingRidesTable"
import { usePassengerListsPage } from "@/hooks/usePassengerListsPage"

export default function PassengerListsPage() {
  const {
    items,
    rideOptions,
    selectedRideId,
    setSelectedRideId,
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    resetFilters,
    hasActiveFilters,
    isLoading,
    isCountsLoading,
    isError,
    error,
    refetch,
  } = usePassengerListsPage()

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <ClipboardList className="h-6 w-6 text-primary" />
            Liste Putnika
          </h1>
          <p className="text-muted-foreground">
            Buduće vožnje iz rasporeda i lista putnika za svaku od njih
          </p>
        </div>

        <PassengerListFilters
          rideOptions={rideOptions}
          selectedRideId={selectedRideId}
          onSelectedRideIdChange={setSelectedRideId}
          fromDate={fromDate}
          onFromDateChange={setFromDate}
          toDate={toDate}
          onToDateChange={setToDate}
          onReset={resetFilters}
          hasActiveFilters={hasActiveFilters}
          resultCount={items.length}
        />

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
            <ClipboardList className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-lg font-medium text-muted-foreground">
              Greska pri ucitavanju rasporeda
            </p>
            <p className="mb-4 text-sm text-muted-foreground">
              {error instanceof Error ? error.message : "Pokrenite ponovno ucitavanje podataka."}
            </p>
            <Button onClick={() => refetch()}>Pokusaj ponovo</Button>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
            <ClipboardList className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-lg font-medium text-muted-foreground">Nema budućih vožnji</p>
            <p className="text-sm text-muted-foreground">
              {hasActiveFilters
                ? "Promenite filtere da biste videli vožnje iz rasporeda."
                : "Dodajte vožnju u raspored da biste videli liste putnika."}
            </p>
          </div>
        ) : (
          <UpcomingRidesTable items={items} isCountsLoading={isCountsLoading} />
        )}
      </div>
    </Layout>
  )
}
