import { createTranslator } from "next-intl"
import { describe, expect, it } from "vitest"

import { formats } from "@/i18n/formats"
import {
  DEFAULT_LOCALE,
  FALLBACK_LOCALE,
  SUPPORTED_LOCALES,
  getFormattingLocale,
  toAppLocale,
} from "@/i18n/locales"
import {
  getCatalog,
  loadMessages,
  overlayMissing,
  type AppMessages,
} from "@/i18n/messages"
import { MESSAGE_NAMESPACES, ROOT_NAMESPACES } from "@/i18n/namespaces"

function translatorFor<N extends "common" | "errors">(
  locale: (typeof SUPPORTED_LOCALES)[number],
  namespace: N
) {
  const { messages } = loadMessages(locale, [namespace])
  return createTranslator({
    locale: getFormattingLocale(locale),
    messages: messages as AppMessages,
    namespace,
    formats,
  })
}

describe("loadMessages", () => {
  it("loads every namespace for every locale", () => {
    for (const locale of SUPPORTED_LOCALES) {
      const { messages } = loadMessages(locale)
      expect(Object.keys(messages).sort()).toEqual([...MESSAGE_NAMESPACES].sort())
    }
  })

  it("returns only the namespaces asked for", () => {
    const { messages } = loadMessages("sr", ROOT_NAMESPACES)
    expect(Object.keys(messages).sort()).toEqual([...ROOT_NAMESPACES].sort())
    expect(messages.marketing).toBeUndefined()
  })

  it("reports no fallbacks when the catalogs are complete", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(loadMessages(locale).fallbacks).toEqual([])
    }
  })
})

describe("typed keys", () => {
  it("resolves a key that exists", () => {
    expect(translatorFor("sr", "common")("actions.save")).toBe("Sačuvaj")
    expect(translatorFor("en", "common")("actions.save")).toBe("Save")
  })

  it("exposes the curated calendar arrays", () => {
    for (const locale of SUPPORTED_LOCALES) {
      const common = getCatalog(locale, "common")
      expect(common.weekdays.long).toHaveLength(7)
      expect(common.weekdays.short).toHaveLength(7)
      expect(common.weekdays.narrow).toHaveLength(7)
      expect(common.months.long).toHaveLength(12)
      expect(common.months.short).toHaveLength(12)
    }
  })

  it("writes Serbian in Latin script with diacritics", () => {
    const serbian = JSON.stringify(getCatalog("sr", "common"))
    expect(serbian).toMatch(/[čćžšđČĆŽŠĐ]/u)
    // Cyrillic anywhere in the Serbian catalog is a mistake.
    expect(serbian).not.toMatch(/[Ѐ-ӿ]/u)
  })
})

describe("ICU support", () => {
  it("interpolates arguments", () => {
    expect(translatorFor("sr", "common")("pagination.pageOf", { page: 2, total: 7 })).toBe(
      "Strana 2 od 7"
    )
    expect(translatorFor("en", "common")("pagination.pageOf", { page: 2, total: 7 })).toBe(
      "Page 2 of 7"
    )
  })

  it("selects Serbian one, few, and other forms", () => {
    const t = translatorFor("sr", "common")
    expect(t("counts.reservations", { count: 0 })).toBe("Nema rezervacija")
    expect(t("counts.reservations", { count: 1 })).toBe("1 rezervacija")
    expect(t("counts.reservations", { count: 2 })).toBe("2 rezervacije")
    expect(t("counts.reservations", { count: 4 })).toBe("4 rezervacije")
    expect(t("counts.reservations", { count: 5 })).toBe("5 rezervacija")
    expect(t("counts.reservations", { count: 21 })).toBe("21 rezervacija")
    expect(t("counts.reservations", { count: 22 })).toBe("22 rezervacije")
    expect(t("counts.reservations", { count: 100 })).toBe("100 rezervacija")
  })

  it("selects English one and other forms", () => {
    const t = translatorFor("en", "common")
    expect(t("counts.reservations", { count: 0 })).toBe("No reservations")
    expect(t("counts.reservations", { count: 1 })).toBe("1 reservation")
    expect(t("counts.reservations", { count: 2 })).toBe("2 reservations")
    expect(t("counts.reservations", { count: 21 })).toBe("21 reservations")
  })

  it("covers zero, one, and many for every count message in both languages", () => {
    for (const locale of SUPPORTED_LOCALES) {
      const t = translatorFor(locale, "common")
      for (const key of ["counts.passengers", "counts.reservations", "counts.seats"] as const) {
        for (const count of [0, 1, 2, 5, 21, 22, 100]) {
          const rendered = t(key, { count })
          expect(rendered).not.toBe("")
          expect(rendered).not.toContain("{")
        }
      }
    }
  })

  it("interpolates error messages with a code", () => {
    const t = translatorFor("en", "errors")
    expect(t("withCode", { message: t("notFound"), code: "RIDE_NOT_FOUND" })).toBe(
      "The requested record was not found. (code: RIDE_NOT_FOUND)"
    )
  })
})

describe("formatting inside messages", () => {
  /**
   * next-intl formats `{value, date}` and `{value, number}` with the locale it
   * was configured with. Handing it the registry key "sr" would render
   * "септембар" and join lists with "и", so the boundary passes the
   * formatting tag instead.
   */
  it("renders embedded dates in Serbian Latin", () => {
    const t = createTranslator({
      locale: getFormattingLocale("sr"),
      messages: { probe: { line: "Polazak {departure, date, long}" } } as unknown as AppMessages,
      namespace: "probe" as never,
      formats,
      timeZone: "Europe/Belgrade",
    }) as unknown as (key: string, values?: Record<string, unknown>) => string

    const rendered = t("line", { departure: new Date("2025-09-21T10:00:00Z") })
    expect(rendered).toBe("Polazak 21. septembar 2025.")
    expect(rendered).not.toMatch(/[Ѐ-ӿ]/u)
  })

  it("renders embedded prices in the tenant currency", () => {
    const t = createTranslator({
      locale: getFormattingLocale("en"),
      messages: { probe: { line: "Total {amount, number, currency}" } } as unknown as AppMessages,
      namespace: "probe" as never,
      formats,
    }) as unknown as (key: string, values?: Record<string, unknown>) => string

    expect(t("line", { amount: 1500 })).toContain("RSD")
  })

  it("maps the formatting tag back to the registry key", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(toAppLocale(getFormattingLocale(locale))).toBe(locale)
      expect(toAppLocale(locale)).toBe(locale)
    }
    expect(toAppLocale("de-DE")).toBe(DEFAULT_LOCALE)
  })
})

describe("emergency fallback", () => {
  // What a catalog would look like if a translator shipped a gap. CI rejects
  // this, so the overlay only ever covers an accident in production.
  const complete = {
    greeting: "Zdravo {name}",
    counts: { seats: "{count, plural, one {# mesto} few {# mesta} other {# mesta}}" },
    nested: { deep: "Duboko" },
  }
  const incomplete = { greeting: "Hello {name}", counts: {}, nested: {} }

  function overlay(target: unknown, source: unknown) {
    const keys: string[] = []
    const merged = overlayMissing(target, source, "", (key) => keys.push(key))
    return { merged: merged as Record<string, any>, keys }
  }

  it("keeps the translated message and fills only the gaps", () => {
    const { merged, keys } = overlay(incomplete, complete)
    expect(merged.greeting).toBe("Hello {name}")
    expect(keys.sort()).toEqual(["counts.seats", "nested.deep"])
  })

  it("keeps ICU working on a fallen-back message, arguments included", () => {
    const { merged } = overlay(incomplete, complete)
    // The synthetic namespace exists only in this test, so the translator is
    // read through a loose signature rather than the app's key types.
    const t = createTranslator({
      locale: getFormattingLocale("en"),
      messages: { probe: merged } as unknown as AppMessages,
      namespace: "probe" as never,
    }) as unknown as (key: string, values?: Record<string, unknown>) => string
    // Serbian text, but still formatted — a plain string substitution at
    // render time would have lost the count and the plural selection.
    expect(t("counts.seats", { count: 3 })).toBe("3 mesta")
    expect(t("nested.deep")).toBe("Duboko")
  })

  it("reports every leaf under a whole missing subtree", () => {
    const { keys } = overlay({}, { a: { b: { c: "x", d: "y" } } })
    expect(keys.sort()).toEqual(["a.b.c", "a.b.d"])
  })

  it("falls back to the default locale, which is Serbian", () => {
    expect(FALLBACK_LOCALE).toBe(DEFAULT_LOCALE)
    expect(FALLBACK_LOCALE).toBe("sr")
  })
})
