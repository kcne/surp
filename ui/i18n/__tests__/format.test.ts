import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  compareStrings,
  formatBusinessDate,
  formatClockTime,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatDuration,
  formatList,
  formatNumber,
  formatPercent,
  formatTime,
  formatWeekdays,
  getFirstDayOfWeek,
  getMonthNames,
  getPluralCategory,
  getWeekdayName,
  getWeekdayNames,
  sortByString,
} from "@/i18n/format"
import { SUPPORTED_LOCALES } from "@/i18n/locales"

const SEPTEMBER_21 = "2025-09-21"

describe("formatDate", () => {
  it("renders Serbian in Latin script", () => {
    // Plain `sr-RS` would render "септембар" here.
    expect(formatDate(SEPTEMBER_21, "sr")).toBe("21. septembar 2025.")
    expect(formatDate(SEPTEMBER_21, "sr", { style: "medium" })).toBe("21. sep 2025.")
    expect(formatDate(SEPTEMBER_21, "sr", { style: "short" })).toBe("21.09.2025.")
  })

  it("renders English in en-US order", () => {
    expect(formatDate(SEPTEMBER_21, "en")).toBe("September 21, 2025")
    expect(formatDate(SEPTEMBER_21, "en", { style: "medium" })).toBe("Sep 21, 2025")
    expect(formatDate(SEPTEMBER_21, "en", { style: "short" })).toBe("09/21/2025")
  })

  it("treats a bare YYYY-MM-DD as a calendar date the process timezone cannot shift", () => {
    // TZ is America/New_York in this suite; a naive parse would say the 20th.
    expect(formatDate(SEPTEMBER_21, "sr", { style: "short" })).toBe("21.09.2025.")
    expect(formatBusinessDate(SEPTEMBER_21, "en", { style: "short" })).toBe("09/21/2025")
  })

  it("renders an instant in tenant time", () => {
    // 00:30 on the 21st in Belgrade, 18:30 on the 20th in New York.
    expect(formatDate("2025-09-20T22:30:00Z", "sr", { style: "short" })).toBe("21.09.2025.")
    expect(formatDate("2025-09-20T22:30:00Z", "en", { style: "short" })).toBe("09/21/2025")
  })

  it("leaves a value that is not a business date untouched", () => {
    expect(formatBusinessDate("not a date", "sr")).toBe("not a date")
  })
})

describe("formatDateTime and formatTime", () => {
  it("keeps a 24-hour clock in both languages", () => {
    const afternoon = "2025-09-21T12:30:00Z" // 14:30 in Belgrade
    expect(formatTime(afternoon, "sr")).toBe("14:30")
    // `en-US` on its own would render "02:30 PM".
    expect(formatTime(afternoon, "en")).toBe("14:30")
  })

  it("renders date and time together in tenant time", () => {
    expect(formatDateTime("2025-09-20T22:30:00Z", "sr")).toBe("21. septembar 2025. 00:30")
    expect(formatDateTime("2025-09-20T22:30:00Z", "en")).toBe("September 21, 2025 at 00:30")
  })

  it("renders the two 02:30s of the fall-back night as the same wall clock", () => {
    expect(formatTime("2025-10-26T00:30:00Z", "sr")).toBe("02:30")
    expect(formatTime("2025-10-26T01:30:00Z", "sr")).toBe("02:30")
  })

  it("skips the hour the spring-forward removes", () => {
    expect(formatTime("2025-03-30T00:59:00Z", "sr")).toBe("01:59")
    expect(formatTime("2025-03-30T01:00:00Z", "sr")).toBe("03:00")
  })
})

describe("formatClockTime", () => {
  it("normalises a stored timetable time without touching a timezone", () => {
    expect(formatClockTime("7:05")).toBe("07:05")
    expect(formatClockTime("07:05")).toBe("07:05")
    expect(formatClockTime("23:59:00")).toBe("23:59")
    expect(formatClockTime(" 9:00 ")).toBe("09:00")
  })

  it("passes anything unrecognised through unchanged", () => {
    expect(formatClockTime("")).toBe("")
    expect(formatClockTime("noon")).toBe("noon")
  })
})

describe("formatDuration", () => {
  it("renders hours and minutes", () => {
    expect(formatDuration(135, "sr")).toBe("2h 15min")
    expect(formatDuration(120, "sr")).toBe("2h")
    expect(formatDuration(45, "sr")).toBe("45min")
  })

  it("takes its units from the catalog, so both languages stay in step", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(formatDuration(135, locale)).toBe("2h 15min")
    }
  })

  it("has nothing to show for a missing or non-positive duration", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(formatDuration(0, locale)).toBeNull()
      expect(formatDuration(-5, locale)).toBeNull()
      expect(formatDuration(undefined, locale)).toBeNull()
      expect(formatDuration(null, locale)).toBeNull()
    }
  })

  it("drops the empty half rather than rendering a zero", () => {
    expect(formatDuration(60, "sr")).toBe("1h")
    expect(formatDuration(59, "sr")).toBe("59min")
    expect(formatDuration(1, "sr")).toBe("1min")
  })
})

describe("numbers and currency", () => {
  /** CLDR separates amount and currency code with a non-breaking space. */
  const NBSP = "\u00a0"

  it("uses each language's separators", () => {
    expect(formatNumber(1234567.89, "sr")).toBe("1.234.567,89")
    expect(formatNumber(1234567.89, "en")).toBe("1,234,567.89")
  })

  it("keeps dinars as dinars in both languages", () => {
    expect(formatCurrency(1500, "sr")).toBe(`1.500${NBSP}RSD`)
    expect(formatCurrency(1500, "en")).toBe(`RSD${NBSP}1,500`)
  })

  it("pins dinar fraction digits so ICU version changes cannot move a price", () => {
    expect(formatCurrency(1500.5, "sr")).toBe(`1.501${NBSP}RSD`)
    expect(formatCurrency(0, "en")).toBe(`RSD${NBSP}0`)
  })

  it("still honours a currency that has subunits", () => {
    expect(formatCurrency(1500.5, "en", { currency: "EUR" })).toBe("€1,500.50")
  })

  it("formats percentages", () => {
    expect(formatPercent(0.875, "sr")).toBe("87,5%")
    expect(formatPercent(0.875, "en")).toBe("87.5%")
  })
})

describe("formatList", () => {
  it("joins with each language's conjunction", () => {
    expect(formatList(["Pon", "Sre", "Pet"], "sr")).toBe("Pon, Sre i Pet")
    expect(formatList(["Mon", "Wed", "Fri"], "en")).toBe("Mon, Wed, and Fri")
  })

  it("handles zero, one, and two items", () => {
    expect(formatList([], "sr")).toBe("")
    expect(formatList(["Pon"], "sr")).toBe("Pon")
    expect(formatList(["Pon", "Sre"], "sr")).toBe("Pon i Sre")
  })
})

describe("getPluralCategory", () => {
  it("knows Serbian has a few form that English does not", () => {
    expect(getPluralCategory(0, "sr")).toBe("other")
    expect(getPluralCategory(1, "sr")).toBe("one")
    expect(getPluralCategory(2, "sr")).toBe("few")
    expect(getPluralCategory(5, "sr")).toBe("other")
    expect(getPluralCategory(21, "sr")).toBe("one")
    expect(getPluralCategory(22, "sr")).toBe("few")
  })

  it("has only one and other in English", () => {
    expect(getPluralCategory(0, "en")).toBe("other")
    expect(getPluralCategory(1, "en")).toBe("one")
    expect(getPluralCategory(2, "en")).toBe("other")
    expect(getPluralCategory(21, "en")).toBe("other")
  })
})

describe("calendar", () => {
  it("starts the week where each language expects", () => {
    expect(getFirstDayOfWeek("sr")).toBe(1)
    expect(getFirstDayOfWeek("en")).toBe(0)
    expect(getWeekdayNames("sr")[0]).toEqual({ index: 1, label: "Ponedeljak" })
    expect(getWeekdayNames("en")[0]).toEqual({ index: 0, label: "Sunday" })
  })

  it("keeps index aligned with Date#getDay whatever the start of week", () => {
    for (const locale of SUPPORTED_LOCALES) {
      const names = getWeekdayNames(locale)
      expect(names).toHaveLength(7)
      expect(new Set(names.map((day) => day.index))).toEqual(new Set([0, 1, 2, 3, 4, 5, 6]))
      for (const { index, label } of names) {
        expect(getWeekdayName(index, locale)).toBe(label)
      }
    }
  })

  it("serves short and narrow widths", () => {
    expect(getWeekdayNames("sr", { width: "short" })[0].label).toBe("Pon")
    expect(getWeekdayName(4, "sr", "short")).toBe("Čet")
    expect(getWeekdayName(4, "sr", "narrow")).toBe("Č")
    expect(getWeekdayName(4, "en", "short")).toBe("Thu")
  })

  it("wraps out-of-range day indices", () => {
    expect(getWeekdayName(7, "sr")).toBe("Nedelja")
    expect(getWeekdayName(-1, "sr")).toBe("Subota")
  })

  it("names all twelve months in both languages", () => {
    expect(getMonthNames("sr")).toHaveLength(12)
    expect(getMonthNames("sr")[8]).toBe("Septembar")
    expect(getMonthNames("en")[8]).toBe("September")
    expect(getMonthNames("sr", "short")[8]).toBe("Sep")
  })

  it("lists selected weekdays in the locale's own week order", () => {
    expect(formatWeekdays([5, 1, 3], "sr")).toBe("Pon, Sre i Pet")
    // English weeks start on Sunday, so Sunday leads.
    expect(formatWeekdays([1, 0], "en")).toBe("Sun and Mon")
    expect(formatWeekdays([1, 0], "sr")).toBe("Pon i Ned")
  })
})

describe("sorting", () => {
  const towns = ["Šabac", "Subotica", "Sombor", "Čačak", "Beograd", "Niš"]

  it("orders Serbian Latin diacritics after their base letters", () => {
    expect(sortByString(towns, (town) => town, "sr")).toEqual([
      "Beograd",
      "Čačak",
      "Niš",
      "Sombor",
      "Subotica",
      "Šabac",
    ])
  })

  it("differs from English collation, which treats Š as S", () => {
    expect(sortByString(towns, (town) => town, "en")).toEqual([
      "Beograd",
      "Čačak",
      "Niš",
      "Šabac",
      "Sombor",
      "Subotica",
    ])
  })

  it("does not mutate the input", () => {
    const input = [...towns]
    sortByString(input, (town) => town, "sr")
    expect(input).toEqual(towns)
  })

  it("compares numbers inside strings by value", () => {
    expect(compareStrings("Peron 2", "Peron 10", "sr")).toBeLessThan(0)
  })
})

describe("what these helpers drag into the browser", () => {
  /**
   * `format.ts` is the one i18n module client components reach, through the
   * shims in `utils/`. `messages.ts` holds every namespace behind a runtime
   * `CATALOGS[locale][namespace]` lookup that no bundler can tree-shake, so
   * importing it from here puts all eleven namespaces of both languages in
   * the browser bundle — invisible today, because nine catalogs are still
   * empty, and unbounded once #70 onwards fill them.
   *
   * Only `common` may be reached from here; it is sent to every client
   * anyway. Anything else belongs behind `NextIntlClientProvider`.
   */
  it("imports only the common catalog, never the full registry", () => {
    const source = readFileSync(join(__dirname, "..", "format.ts"), "utf8")
    const specifiers = [...source.matchAll(/from "([^"]+)"/g)].map((match) => match[1])

    expect(specifiers).not.toContain("./messages")
    expect(specifiers.filter((specifier) => specifier.includes("/messages/")).sort()).toEqual([
      "./messages/en/common.json",
      "./messages/sr/common.json",
    ])
    // The remaining local imports must stay free of the registry too.
    expect(specifiers.filter((specifier) => specifier.startsWith("./")).sort()).toEqual([
      "./locales",
      "./messages/en/common.json",
      "./messages/sr/common.json",
      "./tenant",
    ])
  })
})
