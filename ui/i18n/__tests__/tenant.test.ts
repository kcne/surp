import { describe, expect, it } from "vitest"

import { formatCurrency } from "@/i18n/format"
import {
  DEFAULT_TIME_ZONE,
  fromBusinessDate,
  getCurrencyFractionDigits,
  getTimeZoneOffsetMinutes,
  isBusinessDateShape,
  isSameBusinessDate,
  parseBusinessDate,
  toBusinessDate,
} from "@/i18n/tenant"

/**
 * The suite runs under TZ=America/New_York (see vitest.config.mts). Every
 * expectation below would differ if any of these functions leaked the process
 * timezone, which is the failure mode worth guarding.
 */
describe("toBusinessDate", () => {
  it("uses the tenant timezone, not the process timezone", () => {
    // 00:30 in Belgrade on the 21st, still 18:30 on the 20th in New York.
    expect(toBusinessDate("2025-09-20T22:30:00Z")).toBe("2025-09-21")
  })

  it("rolls over exactly at tenant midnight", () => {
    expect(toBusinessDate("2025-09-20T21:59:59Z")).toBe("2025-09-20")
    expect(toBusinessDate("2025-09-20T22:00:00Z")).toBe("2025-09-21")
  })

  it("rolls over at the right instant in winter, when the offset is +01:00", () => {
    expect(toBusinessDate("2025-01-20T22:59:59Z")).toBe("2025-01-20")
    expect(toBusinessDate("2025-01-20T23:00:00Z")).toBe("2025-01-21")
  })

  it("holds one date across the spring-forward transition", () => {
    // 00:30, 01:30 CET, then 03:30 CEST — all still 30 March in Belgrade.
    expect(toBusinessDate("2025-03-29T23:30:00Z")).toBe("2025-03-30")
    expect(toBusinessDate("2025-03-30T00:30:00Z")).toBe("2025-03-30")
    expect(toBusinessDate("2025-03-30T01:30:00Z")).toBe("2025-03-30")
  })

  it("holds one date across the fall-back transition", () => {
    // 02:30 CEST and 02:30 CET are different instants on the same date.
    expect(toBusinessDate("2025-10-26T00:30:00Z")).toBe("2025-10-26")
    expect(toBusinessDate("2025-10-26T01:30:00Z")).toBe("2025-10-26")
  })

  it("accepts an explicit timezone for tenants outside Serbia", () => {
    expect(toBusinessDate("2025-09-20T22:30:00Z", "America/New_York")).toBe("2025-09-20")
  })
})

describe("getTimeZoneOffsetMinutes", () => {
  it("reports standard and summer time for the tenant", () => {
    expect(getTimeZoneOffsetMinutes("2025-01-15T12:00:00Z")).toBe(60)
    expect(getTimeZoneOffsetMinutes("2025-07-15T12:00:00Z")).toBe(120)
  })

  it("changes at the transition instant, not at local midnight", () => {
    expect(getTimeZoneOffsetMinutes("2025-03-30T00:59:59Z")).toBe(60)
    expect(getTimeZoneOffsetMinutes("2025-03-30T01:00:00Z")).toBe(120)
    expect(getTimeZoneOffsetMinutes("2025-10-26T00:59:59Z")).toBe(120)
    expect(getTimeZoneOffsetMinutes("2025-10-26T01:00:00Z")).toBe(60)
  })
})

describe("fromBusinessDate", () => {
  it("resolves tenant midnight on an ordinary day", () => {
    expect(fromBusinessDate("2025-09-21").toISOString()).toBe("2025-09-20T22:00:00.000Z")
    expect(fromBusinessDate("2025-01-21").toISOString()).toBe("2025-01-20T23:00:00.000Z")
  })

  it("resolves midnight on both sides of the spring-forward day", () => {
    // Still CET at midnight, so the day starts at 23:00 UTC the day before.
    expect(fromBusinessDate("2025-03-30").toISOString()).toBe("2025-03-29T23:00:00.000Z")
    expect(fromBusinessDate("2025-03-31").toISOString()).toBe("2025-03-30T22:00:00.000Z")
  })

  it("resolves midnight on both sides of the fall-back day", () => {
    expect(fromBusinessDate("2025-10-26").toISOString()).toBe("2025-10-25T22:00:00.000Z")
    expect(fromBusinessDate("2025-10-27").toISOString()).toBe("2025-10-26T23:00:00.000Z")
  })

  it("moves a wall-clock time that the spring-forward skips to the next valid instant", () => {
    // 02:30 never happens on 30 March; it resolves to 03:30 CEST.
    const resolved = fromBusinessDate("2025-03-30", DEFAULT_TIME_ZONE, { hour: 2, minute: 30 })
    expect(resolved.toISOString()).toBe("2025-03-30T01:30:00.000Z")
  })

  it("picks the second occurrence of a wall-clock time the fall-back repeats", () => {
    // 02:30 happens twice on 26 October; the standard-time one is chosen.
    const resolved = fromBusinessDate("2025-10-26", DEFAULT_TIME_ZONE, { hour: 2, minute: 30 })
    expect(resolved.toISOString()).toBe("2025-10-26T01:30:00.000Z")
    expect(getTimeZoneOffsetMinutes(resolved)).toBe(60)
  })

  it("round-trips every business date across both transitions", () => {
    for (const date of ["2025-03-29", "2025-03-30", "2025-03-31", "2025-10-25", "2025-10-26", "2025-10-27"]) {
      expect(toBusinessDate(fromBusinessDate(date))).toBe(date)
    }
  })

  it("rejects anything that is not a business date", () => {
    expect(() => fromBusinessDate("2025-9-1")).toThrow(TypeError)
    expect(() => fromBusinessDate("2025-09-21T10:00:00Z")).toThrow(TypeError)
  })

  it("rejects a wall-clock time that is not on a 24-hour clock", () => {
    // An hour of 24 or 30 would silently land on the following day.
    expect(() => fromBusinessDate("2025-09-21", DEFAULT_TIME_ZONE, { hour: 24 })).toThrow(TypeError)
    expect(() => fromBusinessDate("2025-09-21", DEFAULT_TIME_ZONE, { hour: 30 })).toThrow(TypeError)
    expect(() => fromBusinessDate("2025-09-21", DEFAULT_TIME_ZONE, { hour: -1 })).toThrow(TypeError)
    expect(() => fromBusinessDate("2025-09-21", DEFAULT_TIME_ZONE, { minute: 60 })).toThrow(TypeError)
    expect(() => fromBusinessDate("2025-09-21", DEFAULT_TIME_ZONE, { hour: 1.5 })).toThrow(TypeError)
    expect(() => fromBusinessDate("2025-09-21", DEFAULT_TIME_ZONE, { minute: NaN })).toThrow(TypeError)
  })

  it("accepts the edges of the clock", () => {
    expect(
      fromBusinessDate("2025-09-21", DEFAULT_TIME_ZONE, { hour: 23, minute: 59 }).toISOString()
    ).toBe("2025-09-21T21:59:00.000Z")
  })

  it("rejects a well-shaped string that is not a real calendar day", () => {
    // `Date.UTC` would roll these over silently — to 2 March and 1 January.
    expect(() => fromBusinessDate("2025-02-30")).toThrow(TypeError)
    expect(() => fromBusinessDate("2025-13-01")).toThrow(TypeError)
    expect(() => fromBusinessDate("2025-00-10")).toThrow(TypeError)
    expect(() => fromBusinessDate("2025-04-31")).toThrow(TypeError)
  })
})

describe("parseBusinessDate", () => {
  it("returns midnight UTC on the named day", () => {
    expect(parseBusinessDate("2025-09-21")?.toISOString()).toBe("2025-09-21T00:00:00.000Z")
  })

  it("accepts a leap day only in a leap year", () => {
    expect(parseBusinessDate("2024-02-29")?.toISOString()).toBe("2024-02-29T00:00:00.000Z")
    expect(parseBusinessDate("2025-02-29")).toBeNull()
  })

  it("returns null for a rolled-over or malformed date", () => {
    expect(parseBusinessDate("2025-02-30")).toBeNull()
    expect(parseBusinessDate("2025-13-01")).toBeNull()
    // Two-digit years are remapped to 19xx by `Date.UTC`.
    expect(parseBusinessDate("0025-01-01")).toBeNull()
    expect(parseBusinessDate("not a date")).toBeNull()
  })

  it("separates shape from validity", () => {
    expect(isBusinessDateShape("2025-02-30")).toBe(true)
    expect(isBusinessDateShape("2025-2-3")).toBe(false)
  })
})

describe("getCurrencyFractionDigits", () => {
  it("pins dinars to whole units and leaves subunit currencies alone", () => {
    expect(getCurrencyFractionDigits("RSD")).toBe(0)
    expect(getCurrencyFractionDigits()).toBe(0)
    expect(getCurrencyFractionDigits("EUR")).toBe(2)
  })

  it("canonicalises the currency code, as Intl does", () => {
    // `Intl.NumberFormat` accepts "rsd"; a case-sensitive lookup would miss
    // the table and price dinars with two decimal places.
    expect(getCurrencyFractionDigits("rsd")).toBe(0)
    expect(formatCurrency(1500.5, "sr", { currency: "rsd" })).toBe(
      formatCurrency(1500.5, "sr", { currency: "RSD" })
    )
  })
})

describe("isSameBusinessDate", () => {
  it("compares in tenant time", () => {
    // 23:30 and 00:30 New York time, but 05:30 and 06:30 in Belgrade.
    expect(isSameBusinessDate("2025-09-21T03:30:00Z", "2025-09-21T04:30:00Z")).toBe(true)
    expect(isSameBusinessDate("2025-09-20T21:59:00Z", "2025-09-20T22:01:00Z")).toBe(false)
  })
})
