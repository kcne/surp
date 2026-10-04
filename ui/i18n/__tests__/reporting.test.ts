import { IntlErrorCode } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { DEFAULT_LOCALE, FALLBACK_LOCALE } from "@/i18n/locales"
import {
  messageFallback,
  reportIntlError,
  reportMessageFallback,
  reportMissingMessage,
  resetMessageReporting,
} from "@/i18n/reporting"

beforeEach(() => {
  resetMessageReporting()
})

afterEach(() => {
  vi.restoreAllMocks()
})

const spyOnError = () => vi.spyOn(console, "error").mockImplementation(() => {})

describe("reporting a message that fell back", () => {
  it("names the locale and the key", () => {
    const error = spyOnError()
    reportMessageFallback({ locale: "en", namespace: "common", key: "actions.save" })
    expect(error).toHaveBeenCalledTimes(1)
    expect(error.mock.calls[0][0]).toContain("locale=en")
    expect(error.mock.calls[0][0]).toContain("key=common.actions.save")
    expect(error.mock.calls[0][0]).toContain(`"${FALLBACK_LOCALE}"`)
  })

  it("names the locale and the key when nothing can be served", () => {
    const error = spyOnError()
    reportMissingMessage("en", "common.actions.undo")
    expect(error.mock.calls[0][0]).toContain("locale=en")
    expect(error.mock.calls[0][0]).toContain("key=common.actions.undo")
    expect(error.mock.calls[0][0]).toContain("no fallback available")
  })

  it("reports each key once so one gap cannot flood the logs", () => {
    const error = spyOnError()
    const fallback = { locale: "en", namespace: "common", key: "actions.save" } as const
    reportMessageFallback(fallback)
    reportMessageFallback(fallback)
    reportMessageFallback(fallback)
    expect(error).toHaveBeenCalledTimes(1)
  })

  it("keeps the two kinds of gap apart, and each key apart from the next", () => {
    const error = spyOnError()
    reportMessageFallback({ locale: "en", namespace: "common", key: "actions.save" })
    reportMissingMessage("en", "common.actions.save")
    reportMessageFallback({ locale: "en", namespace: "errors", key: "actions.save" })
    reportMessageFallback({ locale: "sr", namespace: "common", key: "actions.save" })
    expect(error).toHaveBeenCalledTimes(4)
  })
})

describe("routing one error from next-intl", () => {
  it("reports a missing message by its original key, once", () => {
    const error = spyOnError()
    const missing = {
      code: IntlErrorCode.MISSING_MESSAGE,
      message: "Could not resolve `common.gone`",
      originalMessage: "common.gone",
    }
    reportIntlError(DEFAULT_LOCALE, missing)
    reportIntlError(DEFAULT_LOCALE, missing)
    expect(error).toHaveBeenCalledTimes(1)
    expect(error.mock.calls[0][0]).toContain(`locale=${DEFAULT_LOCALE}`)
    expect(error.mock.calls[0][0]).toContain("key=common.gone")
  })

  it("falls back to the error message when next-intl gives no original", () => {
    const error = spyOnError()
    reportIntlError(DEFAULT_LOCALE, {
      code: IntlErrorCode.MISSING_MESSAGE,
      message: "common.anonymous",
    })
    expect(error.mock.calls[0][0]).toContain("key=common.anonymous")
  })

  it("is loud every time about a malformed message, which is a catalog bug", () => {
    const error = spyOnError()
    const broken = { code: IntlErrorCode.INVALID_MESSAGE, message: "bad ICU in common.broken" }
    reportIntlError(DEFAULT_LOCALE, broken)
    reportIntlError(DEFAULT_LOCALE, broken)
    // No per-key dedupe here: unlike a gap, this never resolves itself.
    expect(error).toHaveBeenCalledTimes(2)
    expect(error.mock.calls[0][0]).toContain(IntlErrorCode.INVALID_MESSAGE)
    expect(error.mock.calls[0][0]).toContain("bad ICU in common.broken")
  })
})

describe("what renders when no catalog has the key", () => {
  it("renders the full path, so it is obvious on screen and greppable", () => {
    expect(messageFallback({ namespace: "common", key: "actions.undo" })).toBe("common.actions.undo")
  })

  it("renders a bare key when there is no namespace", () => {
    expect(messageFallback({ key: "orphan" })).toBe("orphan")
  })
})
