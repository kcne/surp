import { beforeEach, describe, expect, it, vi } from "vitest"

import { getCatalog, loadMessages } from "@/i18n/messages"
import { resetMessageReporting } from "@/i18n/reporting"

/**
 * The Serbian emergency fallback, exercised through `loadMessages` — the
 * function production actually calls.
 *
 * `overlayMissing` is unit-tested in `messages.test.ts` and the shipped
 * catalogs are complete by CI, so without this file the wiring between the
 * two is never run: nothing proves `loadMessages` overlays at all, that it
 * skips the overlay for the fallback locale itself, or that it labels each
 * gap with the right namespace. This mocks one catalog into the state CI
 * exists to prevent.
 */
vi.mock("../messages/en/common.json", () => ({
  default: {
    weekdays: {
      long: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
      short: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
      narrow: ["S", "M", "T", "W", "T", "F", "S"],
    },
    // `actions` is translated but incomplete, `states` is missing entirely,
    // and `counts` keeps a plural that must survive the merge intact.
    actions: { save: "Save" },
    counts: { reservations: "{count, plural, one {# reservation} other {# reservations}}" },
  },
}))

beforeEach(() => {
  resetMessageReporting()
})

describe("loadMessages against an incomplete catalog", () => {
  it("keeps every translated message and fills only the gaps", () => {
    const { messages } = loadMessages("en", ["common"])
    const common = messages.common as Record<string, any>

    expect(common.actions.save).toBe("Save")
    // Not translated, so Serbian shows through rather than nothing at all.
    expect(common.actions.cancel).toBe("Otkaži")
    expect(common.states.loading).toBe("Učitavanje…")
  })

  it("reports each gap with its locale, namespace, and full key path", () => {
    const { fallbacks } = loadMessages("en", ["common"])

    expect(fallbacks.every((entry) => entry.locale === "en")).toBe(true)
    expect(fallbacks.every((entry) => entry.namespace === "common")).toBe(true)

    const keys = fallbacks.map((entry) => entry.key)
    expect(keys).toContain("actions.cancel")
    expect(keys).toContain("states.loading")
    expect(keys).toContain("counts.passengers")
    expect(keys).toContain("duration.hour")
    // Present in the mock, so it is not a gap.
    expect(keys).not.toContain("actions.save")
    expect(keys).not.toContain("counts.reservations")
    expect(new Set(keys).size).toBe(keys.length)
  })

  it("leaves the other namespaces untouched", () => {
    const { fallbacks } = loadMessages("en", ["common", "errors"])
    expect(fallbacks.some((entry) => entry.namespace === "errors")).toBe(false)
  })

  it("never falls back for the fallback locale, and does not copy its catalog", () => {
    const { messages, fallbacks } = loadMessages("sr", ["common"])
    expect(fallbacks).toEqual([])
    // Identity, not equality: the overlay is skipped entirely rather than
    // rebuilding an object on every request for the default locale.
    expect(messages.common).toBe(getCatalog("sr", "common"))
  })
})
