import { describe, expect, it } from "vitest"
import {
  isRunningDeparture,
  toDepartureInstance,
  toRunningDepartureInstances,
} from "@/infrastructure/mappers/departureMappers"
import { departure, ride } from "./fixtures"

describe("isRunningDeparture", () => {
  it("excludes cancelled, dropped and LEGACY departures", () => {
    expect(isRunningDeparture(departure())).toBe(true)
    expect(isRunningDeparture(departure({ cancelledAt: "2026-10-02T10:00:00.000Z" }))).toBe(false)
    expect(isRunningDeparture(departure({ timetableDroppedAt: "2026-10-02T10:00:00.000Z" }))).toBe(false)
    expect(isRunningDeparture(departure({ source: "LEGACY" }))).toBe(false)
  })
})

describe("toDepartureInstance", () => {
  it("names the bus by its departure ID and takes its seats from the departure", () => {
    const instance = toDepartureInstance(
      departure({ id: "dep-9", capacity: 60, activeReservationCount: 12, availableSeats: 48 }),
      ride()
    )

    expect(instance).toMatchObject({
      id: "dep-9",
      source: "BASE",
      rideId: "ride-1",
      date: "2026-10-05",
      departureTime: "09:00",
      arrivalTime: "10:30",
      status: "scheduled",
      reservationCount: 12,
      availableSeats: 48,
    })
    expect(instance.ride.busCapacity).toBe(60)
    expect(instance.ride.line.intermediateStations).toHaveLength(1)
  })

  it("marks an extra bus as ADDITIONAL", () => {
    expect(toDepartureInstance(departure({ source: "EXTRA" }), ride()).source).toBe("ADDITIONAL")
  })

  it("builds the line from the stored stops when the ride is not loaded or has moved line", () => {
    const unloaded = toDepartureInstance(departure())
    expect(unloaded.ride.line.departureStation).toMatchObject({ id: "st-ns", name: "Novi Sad" })
    expect(unloaded.ride.line.arrivalStation).toMatchObject({ id: "st-bg", name: "Beograd" })
    expect(unloaded.ride.line.intermediateStations).toEqual([
      { stationId: "st-in", stationName: "Indjija", order: 1, isBoarding: true, isDropoff: true },
    ])

    const moved = toDepartureInstance(departure(), ride({ line: { ...ride().line, id: "line-2" } }))
    expect(moved.ride.line.id).toBe("line-1")
  })
})

describe("toRunningDepartureInstances", () => {
  it("keeps running departures, ordered by date and time", () => {
    const instances = toRunningDepartureInstances(
      [
        departure({ id: "late", serviceDate: "2026-10-06", departureTime: "07:00" }),
        departure({ id: "cancelled", cancelledAt: "2026-10-02T10:00:00.000Z" }),
        departure({ id: "early", departureTime: "06:00" }),
        departure({ id: "legacy", source: "LEGACY", stops: [] }),
        departure({ id: "noon", departureTime: "12:00", source: "EXTRA" }),
      ],
      [ride()]
    )

    expect(instances.map((instance) => instance.id)).toEqual(["early", "noon", "late"])
  })
})
