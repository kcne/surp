import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { RideInstanceCard } from "@/components/reservations/RideInstanceCard"
import { UpcomingRidesTable } from "@/components/passenger-lists/UpcomingRidesTable"
import { toDepartureInstance } from "@/infrastructure/mappers/departureMappers"
import { departure, ride } from "./fixtures"

/**
 * Two buses of one ride may leave at the same time since #27 PR 4c, and
 * bookings name the bus by departureId, so a screen that offers buses by
 * their time says which of them is the extra.
 */
describe("extra buses at the time of another bus", () => {
  const timetableBus = toDepartureInstance(departure({ id: "dep-1" }), ride())
  const extraBus = toDepartureInstance(departure({ id: "extra-1", source: "EXTRA" }), ride())

  it("marks the extra on the booking card", () => {
    render(
      <>
        <RideInstanceCard instance={timetableBus} durationLabel={null} onViewInfo={vi.fn()} onReserve={vi.fn()} />
        <RideInstanceCard instance={extraBus} durationLabel={null} onViewInfo={vi.fn()} onReserve={vi.fn()} />
      </>
    )

    expect(screen.getByText("Bus")).toBeTruthy()
    expect(screen.getByText("Dodatni bus")).toBeTruthy()
  })

  it("marks the extra in the passenger lists' schedule", () => {
    render(
      <UpcomingRidesTable
        items={[timetableBus, extraBus].map((rideInstance) => ({
          rideInstance,
          passengerCount: 0,
          capacity: 48,
        }))}
        isCountsLoading={false}
      />
    )

    // The desktop table and the mobile cards each show it once.
    expect(screen.getAllByText(/09:00 · dodatni/)).toHaveLength(2)
  })
})
