import { describe, expect, it } from "vitest"

import {
  localeFromCookie,
  localeFromSegment,
  localizePathname,
  splitLocaleSegment,
} from "@/i18n/routing"

describe("splitLocaleSegment", () => {
  it("finds a locale that occupies the whole first segment", () => {
    expect(splitLocaleSegment("/en")).toEqual({ segment: "en", rest: "/" })
    expect(splitLocaleSegment("/en/cene")).toEqual({ segment: "en", rest: "/cene" })
    expect(splitLocaleSegment("/sr/blog/neki-post")).toEqual({
      segment: "sr",
      rest: "/blog/neki-post",
    })
  })

  it("does not treat a slug that starts with a locale as one", () => {
    // `/srbija-tours` is an agency, not the Serbian home page. Matching by
    // string prefix here would make that storefront unreachable.
    expect(splitLocaleSegment("/srbija-tours")).toEqual({
      segment: null,
      rest: "/srbija-tours",
    })
    expect(splitLocaleSegment("/energo-trans")).toEqual({
      segment: null,
      rest: "/energo-trans",
    })
  })

  it("leaves an unprefixed path alone", () => {
    expect(splitLocaleSegment("/")).toEqual({ segment: null, rest: "/" })
    expect(splitLocaleSegment("/dashboard")).toEqual({ segment: null, rest: "/dashboard" })
  })

  it("normalises a trailing slash after the segment", () => {
    expect(splitLocaleSegment("/en/")).toEqual({ segment: "en", rest: "/" })
  })

  it("ignores a locale that is not the first segment", () => {
    expect(splitLocaleSegment("/blog/en")).toEqual({ segment: null, rest: "/blog/en" })
  })
})

describe("localizePathname", () => {
  it("leaves Serbian unprefixed, so existing links keep working", () => {
    expect(localizePathname("sr", "/")).toBe("/")
    expect(localizePathname("sr", "/cene")).toBe("/cene")
  })

  it("prefixes English without translating the slug", () => {
    expect(localizePathname("en", "/")).toBe("/en")
    expect(localizePathname("en", "/cene")).toBe("/en/cene")
    expect(localizePathname("en", "/blog/neki-post")).toBe("/en/blog/neki-post")
  })

  it("round-trips with splitLocaleSegment", () => {
    for (const pathname of ["/", "/cene", "/blog/neki-post"]) {
      const { rest } = splitLocaleSegment(localizePathname("en", pathname))
      expect(rest).toBe(pathname)
    }
  })
})

describe("localeFromSegment", () => {
  it("accepts a registered locale", () => {
    expect(localeFromSegment("en")).toBe("en")
    expect(localeFromSegment("sr")).toBe("sr")
  })

  it("falls back to the default rather than throwing", () => {
    // A page in the wrong language beats a 500 on a marketing page.
    expect(localeFromSegment("de")).toBe("sr")
    expect(localeFromSegment(undefined)).toBe("sr")
    expect(localeFromSegment(42)).toBe("sr")
  })
})

describe("localeFromCookie", () => {
  it("reads a saved locale", () => {
    expect(localeFromCookie("en")).toBe("en")
  })

  it("ignores an absent or unknown value so the browser is consulted instead", () => {
    expect(localeFromCookie(undefined)).toBeNull()
    expect(localeFromCookie("")).toBeNull()
    expect(localeFromCookie("de")).toBeNull()
    expect(localeFromCookie("en-GB")).toBeNull()
  })
})
