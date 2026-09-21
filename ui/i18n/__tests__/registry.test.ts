import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { formats } from "@/i18n/formats"
import {
  DEFAULT_LOCALE,
  FALLBACK_LOCALE,
  LOCALES,
  SUPPORTED_LOCALES,
  getFormattingLocale,
  getLocale,
  isSupportedLocale,
} from "@/i18n/locales"
import { MESSAGE_NAMESPACES, ROOT_NAMESPACES } from "@/i18n/namespaces"
import { resolveRequestLocale } from "@/i18n/resolve-locale"

describe("locale registry", () => {
  it("ships Serbian and English, with Serbian as the default", () => {
    expect(SUPPORTED_LOCALES).toEqual(["sr", "en"])
    expect(DEFAULT_LOCALE).toBe("sr")
    expect(FALLBACK_LOCALE).toBe("sr")
    expect(SUPPORTED_LOCALES).toContain(DEFAULT_LOCALE)
  })

  it("describes every locale completely", () => {
    for (const locale of SUPPORTED_LOCALES) {
      const definition = getLocale(locale)
      expect(definition.locale).toBe(locale)
      expect(definition.formattingLocale).toBeTruthy()
      expect(definition.htmlLang).toBeTruthy()
      expect(definition.ogLocale).toMatch(/^[a-z]{2}_[A-Z]{2}$/)
      expect(definition.nativeName).toBeTruthy()
      expect(definition.englishName).toBeTruthy()
      expect([0, 1]).toContain(definition.firstDayOfWeek)
    }
  })

  it("uses formatting locales Intl actually recognises", () => {
    for (const locale of SUPPORTED_LOCALES) {
      const tag = getFormattingLocale(locale)
      expect(Intl.DateTimeFormat.supportedLocalesOf([tag])).toEqual([tag])
      expect(Intl.NumberFormat.supportedLocalesOf([tag])).toEqual([tag])
      expect(Intl.Collator.supportedLocalesOf([tag])).toEqual([tag])
    }
  })

  it("keeps Serbian formatting in Latin script", () => {
    // `sr-RS` alone resolves to Cyrillic, which the product does not use.
    expect(getFormattingLocale("sr")).toContain("Latn")
  })

  it("recognises only registered locales", () => {
    expect(isSupportedLocale("sr")).toBe(true)
    expect(isSupportedLocale("en")).toBe(true)
    expect(isSupportedLocale("de")).toBe(false)
    expect(isSupportedLocale("sr-Latn")).toBe(false)
    expect(isSupportedLocale(undefined)).toBe(false)
  })

  it("has one definition per supported locale and no extras", () => {
    expect(Object.keys(LOCALES).sort()).toEqual([...SUPPORTED_LOCALES].sort())
  })
})

describe("namespace registry", () => {
  it("covers the agreed product domains", () => {
    expect([...MESSAGE_NAMESPACES].sort()).toEqual([
      "auth",
      "common",
      "dashboard",
      "errors",
      "exports",
      "marketing",
      "passengers",
      "reservations",
      "schedules",
      "storefront",
      "superAdmin",
    ])
  })

  it("keeps the root bundle small, since every page pays for it", () => {
    expect(ROOT_NAMESPACES).toEqual(["common", "errors"])
    for (const namespace of ROOT_NAMESPACES) {
      expect(MESSAGE_NAMESPACES).toContain(namespace)
    }
  })

  it("has a catalog file per locale per namespace", () => {
    for (const locale of SUPPORTED_LOCALES) {
      for (const namespace of MESSAGE_NAMESPACES) {
        const path = join(__dirname, "..", "messages", locale, `${namespace}.json`)
        expect(existsSync(path), `${locale}/${namespace}.json`).toBe(true)
        expect(() => JSON.parse(readFileSync(path, "utf8"))).not.toThrow()
      }
    }
  })
})

describe("named formats", () => {
  it("keeps schedule times on a 24-hour clock", () => {
    expect(formats.dateTime.time.hourCycle).toBe("h23")
    expect(formats.dateTime.dateTime.hourCycle).toBe("h23")
  })

  it("prices in the tenant currency rather than the reader's", () => {
    expect(formats.number.currency.currency).toBe("RSD")
  })
})

describe("request locale", () => {
  it("reads the locale from the route segment", () => {
    expect(resolveRequestLocale({ locale: "en" })).toBe("en")
    expect(resolveRequestLocale({ locale: "sr" })).toBe("sr")
  })

  it("falls back to the default for a segment the registry does not know", () => {
    // The middleware only ever rewrites to a registered locale, so this means
    // the segment was reached some other way. A page in the wrong language is
    // a better answer than a 500.
    expect(resolveRequestLocale({ locale: "de" })).toBe(DEFAULT_LOCALE)
    expect(resolveRequestLocale({})).toBe(DEFAULT_LOCALE)
  })
})
