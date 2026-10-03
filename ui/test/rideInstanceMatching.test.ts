import { describe, expect, it } from "vitest"
import { toDepartureInstance } from "@/infrastructure/mappers/departureMappers"
import { selectRideInstance } from "@/lib/csv-import"
import type { RideInstance } from "@/types"
import { departure } from "./fixtures"

const morning = toDepartureInstance(departure({ id: "dep-morning", departureTime: "09:00" }))
const evening = toDepartureInstance(departure({ id: "dep-evening", departureTime: "18:00" }))

function byId(...instances: RideInstance[]): Record<string, RideInstance> {
  return Object.fromEntries(instances.map((instance) => [instance.id, instance]))
}

function row(rideInstanceId: string | null, departureStationId = "st-ns", arrivalStationId = "st-bg") {
  return { rideInstanceId, departureStationId, arrivalStationId }
}

describe("selectRideInstance", () => {
  it("takes the only bus that serves an unpicked row", () => {
    expect(selectRideInstance(row(null), [morning], byId(morning))).toEqual({
      candidateIds: ["dep-morning"],
      rideInstanceId: "dep-morning",
    })
  })

  it("leaves an unpicked row for the operator when two buses serve it", () => {
    expect(selectRideInstance(row(null), [morning, evening], byId(morning, evening))).toEqual({
      candidateIds: ["dep-morning", "dep-evening"],
      rideInstanceId: null,
    })
  })

  it("keeps the operator's pick while it still serves the row", () => {
    expect(
      selectRideInstance(row("dep-evening"), [morning, evening], byId(morning, evening))
        .rideInstanceId
    ).toBe("dep-evening")
  })

  it("keeps a pick that stopped running instead of moving the row to the bus that is left", () => {
    // The evening bus was refused and the refetch no longer lists it.
    expect(selectRideInstance(row("dep-evening"), [morning], byId(morning))).toEqual({
      candidateIds: ["dep-morning"],
      rideInstanceId: "dep-evening",
    })
  })

  it("resolves again when a corrected route leaves the pick behind", () => {
    const shortHop = toDepartureInstance(
      departure({
        id: "dep-short",
        stops: [
          { stationId: "st-ns", stationName: "Novi Sad", orderIndex: 0, time: "09:00", isBoarding: true, isDropoff: false },
          { stationId: "st-in", stationName: "Indjija", orderIndex: 1, time: "09:30", isBoarding: false, isDropoff: true },
        ],
      })
    )

    // The pick still runs but ends at Indjija. Corrected to Indjija ->
    // Beograd, the row takes the one bus that goes there.
    expect(
      selectRideInstance(row("dep-short", "st-in", "st-bg"), [shortHop, morning], byId(shortHop, morning))
        .rideInstanceId
    ).toBe("dep-morning")
  })
})
