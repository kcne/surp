"use client"

import { useEffect } from "react"
import { Layout } from "@/components/layout/Layout"
import { RidesListPanel } from "@/components/reservations/RidesListPanel"
import { useRidesStore } from "@/stores/ridesStore"
import { Ticket } from "lucide-react"

function isValidDate(date: any): date is Date {
  return date instanceof Date && !isNaN(date.getTime())
}

export default function ReservationsPage() {
  const { fetchRides, fetchRideInstances, rideInstances, selectedDate, setSelectedDate, loading } =
    useRidesStore()

  // Initialize: fetch GTFS trip instances for the persisted date on mount
  useEffect(() => {
    fetchRides()
    if (selectedDate && isValidDate(selectedDate)) {
      fetchRideInstances(selectedDate)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run on mount

  const handleDateSelect = (date: Date | undefined) => {
    if (date && isValidDate(date)) {
      setSelectedDate(date)
      fetchRideInstances(date)
    }
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Ticket className="h-6 w-6 text-primary" />
            Rezervacije
          </h1>
          <p className="text-muted-foreground">
            Upravljajte rezervacijama autobuskih karata
          </p>
        </div>

        <RidesListPanel
          selectedDate={selectedDate && isValidDate(selectedDate) ? selectedDate : undefined}
          rideInstances={rideInstances}
          loading={loading}
        />
      </div>
    </Layout>
  )
}
