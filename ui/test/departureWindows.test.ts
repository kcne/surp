import { describe, expect, it } from "vitest"
import {
  addDaysToIsoDate,
  splitIntoDepartureWindows,
  windowsCoveringDates,
} from "@/utils/departureWindows"

describe("addDaysToIsoDate", () => {
  it("crosses months, years and leap days without the local zone", () => {
    expect(addDaysToIsoDate("2026-10-31", 1)).toBe("2026-11-01")
    expect(addDaysToIsoDate("2026-12-31", 1)).toBe("2027-01-01")
    expect(addDaysToIsoDate("2028-02-28", 1)).toBe("2028-02-29")
    expect(addDaysToIsoDate("2026-03-29", -1)).toBe("2026-03-28")
  })
})

describe("splitIntoDepartureWindows", () => {
  it("keeps a range of up to 62 days in one window", () => {
    expect(splitIntoDepartureWindows({ from: "2026-10-01", to: "2026-12-01" })).toEqual([
      { from: "2026-10-01", to: "2026-12-01" },
    ])
  })

  it("splits a longer range into 62-day windows from its start", () => {
    expect(splitIntoDepartureWindows({ from: "2026-10-01", to: "2027-01-15" })).toEqual([
      { from: "2026-10-01", to: "2026-12-01" },
      { from: "2026-12-02", to: "2027-01-15" },
    ])
  })

  it("keeps the windows it had when the range grows at its end", () => {
    const first = splitIntoDepartureWindows({ from: "2026-10-01", to: "2026-12-01" })
    const grown = splitIntoDepartureWindows({ from: "2026-10-01", to: "2027-02-01" })
    expect(grown[0]).toEqual(first[0])
  })

  it("returns no window for an empty or reversed range", () => {
    expect(splitIntoDepartureWindows({ from: "", to: "" })).toEqual([])
    expect(splitIntoDepartureWindows({ from: "2026-10-02", to: "2026-10-01" })).toEqual([])
  })
})

describe("windowsCoveringDates", () => {
  it("covers nearby dates with one window and far ones with their own", () => {
    expect(
      windowsCoveringDates(["2026-10-20", "2026-10-05", "2026-10-05", "2027-03-01", "", "bad"])
    ).toEqual([
      { from: "2026-10-05", to: "2026-10-20" },
      { from: "2027-03-01", to: "2027-03-01" },
    ])
  })

  it("starts a new window on the 63rd day", () => {
    expect(windowsCoveringDates(["2026-10-01", "2026-12-01", "2026-12-02"])).toEqual([
      { from: "2026-10-01", to: "2026-12-01" },
      { from: "2026-12-02", to: "2026-12-02" },
    ])
  })
})
