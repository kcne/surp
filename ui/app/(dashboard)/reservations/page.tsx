"use client"

import { Layout } from "@/components/layout/Layout"
import { RidesListPanel } from "@/components/reservations/RidesListPanel"
import { useReservationsDashboardPage } from "@/hooks/useReservationsDashboardPage"
import { Ticket } from "lucide-react"

export default function ReservationsPage() {
  const { rideInstances, selectedDate, loading } = useReservationsDashboardPage()

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
          selectedDate={selectedDate}
          rideInstances={rideInstances}
          loading={loading}
        />
      </div>
    </Layout>
  )
}
