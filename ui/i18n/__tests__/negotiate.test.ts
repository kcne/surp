import { describe, expect, it } from "vitest"

import { negotiateLocale } from "@/i18n/negotiate"

describe("negotiateLocale", () => {
  it("has no opinion without a header", () => {
    expect(negotiateLocale(null)).toBeNull()
    expect(negotiateLocale(undefined)).toBeNull()
    expect(negotiateLocale("")).toBeNull()
  })

  it("matches a language listed exactly", () => {
    expect(negotiateLocale("en")).toBe("en")
    expect(negotiateLocale("sr")).toBe("sr")
  })

  it("matches a regional variant to its language", () => {
    // One English catalog serves every English-speaking region.
    expect(negotiateLocale("en-GB")).toBe("en")
    expect(negotiateLocale("en-AU,en;q=0.9")).toBe("en")
    expect(negotiateLocale("sr-Latn-RS")).toBe("sr")
  })

  it("is case insensitive", () => {
    expect(negotiateLocale("EN-gb")).toBe("en")
  })

  it("prefers the highest weight, not the first entry", () => {
    expect(negotiateLocale("sr;q=0.2, en;q=0.9")).toBe("en")
    expect(negotiateLocale("en;q=0.3, sr;q=0.8")).toBe("sr")
  })

  it("keeps header order when weights tie", () => {
    expect(negotiateLocale("en, sr")).toBe("en")
    expect(negotiateLocale("sr, en")).toBe("sr")
  })

  it("treats a missing weight as the strongest preference", () => {
    expect(negotiateLocale("sr;q=0.9, en")).toBe("en")
  })

  it("honours a rejection rather than treating it as a weak preference", () => {
    // `q=0` means "not acceptable". A reader who rejected English must not be
    // handed English just because nothing else matched.
    expect(negotiateLocale("en;q=0")).toBeNull()
    expect(negotiateLocale("en;q=0, sr;q=0.1")).toBe("sr")
    expect(negotiateLocale("en;q=0.0")).toBeNull()
  })

  it("ignores the wildcard, which names no catalog", () => {
    expect(negotiateLocale("*")).toBeNull()
    expect(negotiateLocale("de, *")).toBeNull()
    expect(negotiateLocale("*, en")).toBe("en")
  })

  it("returns nothing for languages the product does not ship", () => {
    expect(negotiateLocale("de-DE,de;q=0.9,fr;q=0.8")).toBeNull()
  })

  it("skips malformed entries instead of failing the request", () => {
    expect(negotiateLocale(",,;;")).toBeNull()
    expect(negotiateLocale("!!!, en")).toBe("en")
    expect(negotiateLocale("english")).toBeNull()
    // A weight outside 0..1 is malformed, so that entry is dropped.
    expect(negotiateLocale("en;q=7")).toBeNull()
    expect(negotiateLocale("en;q=abc")).toBeNull()
    expect(negotiateLocale("en;q=7, sr;q=0.5")).toBe("sr")
  })

  it("tolerates the whitespace real browsers send", () => {
    expect(negotiateLocale("  sr-RS ;  q=0.2 ,  en-GB ; q=0.9 ")).toBe("en")
  })
})
