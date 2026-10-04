import { describe, expect, it } from "vitest"
import {
  parseLegacyInstanceId,
  parseLegacyPassengerListLink,
  resolveLegacyDeparture,
} from "@/utils/legacyDepartureLinks"
import { departure } from "./fixtures"

describe("parseLegacyInstanceId", () => {
  it("reads the ride, date and time of an old seat-map ID, with or without its source", () => {
    expect(parseLegacyInstanceId("ride-1:2026-10-05:09:00:BASE")).toEqual({
      rideId: "ride-1",
      date: "2026-10-05",
      departureTime: "09:00",
    })
    expect(parseLegacyInstanceId("ride-1:2026-10-05:09:00")).toEqual({
      rideId: "ride-1",
      date: "2026-10-05",
      departureTime: "09:00",
    })
  })

  it("leaves a departure ID alone", () => {
    expect(parseLegacyInstanceId("4b9c1a52-0d6e-4f7e-9a51-0c3c2f9b1d77")).toBeNull()
    expect(parseLegacyInstanceId("ride-1:not-a-date:09:00")).toBeNull()
  })
})

describe("parseLegacyPassengerListLink", () => {
  it("needs both a date and a time", () => {
    expect(parseLegacyPassengerListLink("ride-1", "2026-10-05", "09:00")).toEqual({
      rideId: "ride-1",
      date: "2026-10-05",
      departureTime: "09:00",
    })
    expect(parseLegacyPassengerListLink("dep-1", null, null)).toBeNull()
    expect(parseLegacyPassengerListLink("ride-1", "2026-10-05", "9h")).toBeNull()
  })
})

describe("resolveLegacyDeparture", () => {
  const link = { rideId: "ride-1", date: "2026-10-05", departureTime: "09:00" }

  it("finds the one departure the link meant", () => {
    expect(
      resolveLegacyDeparture(
        [
          departure({ id: "dep-other-time", departureTime: "15:00" }),
          departure({ id: "dep-other-ride", rideId: "ride-2" }),
          departure({ id: "dep-meant" }),
        ],
        link
      )
    ).toBe("dep-meant")
  })

  it("refuses to guess between two buses, or when none matches", () => {
    expect(
      resolveLegacyDeparture(
        [departure({ id: "dep-a" }), departure({ id: "dep-b", source: "EXTRA" })],
        link
      )
    ).toBeNull()
    expect(resolveLegacyDeparture([departure({ departureTime: "10:00" })], link)).toBeNull()
  })
})
