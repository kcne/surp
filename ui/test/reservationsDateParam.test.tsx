import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react"
import { format } from "date-fns"
import { srLatn } from "date-fns/locale"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { departure } from "./fixtures"
import { createQueryWrapper } from "./queryWrapper"

const navigation = vi.hoisted(() => ({
  searchParams: new URLSearchParams(),
  replace: vi.fn(),
}))
const api = vi.hoisted(() => ({
  departuresControllerList: vi.fn(),
  departuresControllerGetById: vi.fn(),
  ridesControllerList: vi.fn(),
  reservationsControllerList: vi.fn(),
  reservationsControllerMoveSeat: vi.fn(),
  storefrontControllerGetRideIcon: vi.fn(),
}))

vi.mock("@/infrastructure/generated/surp-api", () => api)
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: navigation.replace, push: vi.fn() }),
  useSearchParams: () => navigation.searchParams,
  useParams: () => ({ rideInstanceId: "dep-1" }),
  usePathname: () => "/reservations/dep-1",
}))
vi.mock("@/components/layout/Layout", () => ({
  Layout: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

import ReservationsPage from "@/app/(dashboard)/reservations/page"
import SeatMapPage from "@/app/(dashboard)/reservations/[rideInstanceId]/page"
import { useReservationsDashboardPage } from "@/hooks/useReservationsDashboardPage"
import { parseReservationsDateParam, reservationsListHref } from "@/utils/reservationsDateParam"
import { formatDateToISO } from "@/utils/dateHelpers"

const NOW = new Date(2026, 9, 4, 14, 30)
const EMPTY_PAGE = { status: 200, data: { items: [], total: 0 } }

// No vitest globals, so Testing Library does not unmount between tests itself.
afterEach(cleanup)

function freezeClock() {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(NOW)
}

describe("parseReservationsDateParam", () => {
  it("reads a future or current day", () => {
    expect(formatDateToISO(parseReservationsDateParam("2026-10-12", NOW))).toBe("2026-10-12")
    expect(formatDateToISO(parseReservationsDateParam("2026-10-04", NOW))).toBe("2026-10-04")
  })

  it.each([
    ["missing", null],
    ["empty", ""],
    ["not a date", "sutra"],
    ["wrong shape", "4.10.2026"],
    ["impossible day", "2026-02-30"],
    ["past day", "2026-10-03"],
  ])("falls back to today when the date is %s", (_case, value) => {
    expect(formatDateToISO(parseReservationsDateParam(value, NOW))).toBe("2026-10-04")
  })
})

describe("reservationsListHref", () => {
  it("carries today or a future day in ?date=", () => {
    expect(reservationsListHref(new Date(2026, 9, 12), NOW)).toBe("/reservations?date=2026-10-12")
    expect(reservationsListHref(new Date(2026, 9, 4), NOW)).toBe("/reservations?date=2026-10-04")
  })

  it("links to the bare list without a usable date", () => {
    expect(reservationsListHref(undefined, NOW)).toBe("/reservations")
    expect(reservationsListHref(new Date("invalid"), NOW)).toBe("/reservations")
  })

  it("links to the bare list for a past day, which the list would not show", () => {
    expect(reservationsListHref(new Date(2026, 9, 3), NOW)).toBe("/reservations")
  })
})

describe("useReservationsDashboardPage", () => {
  beforeEach(() => {
    freezeClock()
    navigation.searchParams = new URLSearchParams()
    navigation.replace.mockReset()
    api.ridesControllerList.mockReset().mockResolvedValue(EMPTY_PAGE)
    api.departuresControllerList.mockReset().mockResolvedValue(EMPTY_PAGE)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("selects the day named in the URL", () => {
    navigation.searchParams = new URLSearchParams("date=2026-10-12")

    const { result } = renderHook(() => useReservationsDashboardPage(), {
      wrapper: createQueryWrapper(),
    })

    expect(formatDateToISO(result.current.selectedDate)).toBe("2026-10-12")
    expect(navigation.replace).not.toHaveBeenCalled()
  })

  it("selects today without a date in the URL and leaves the URL alone", () => {
    const { result } = renderHook(() => useReservationsDashboardPage(), {
      wrapper: createQueryWrapper(),
    })

    expect(formatDateToISO(result.current.selectedDate)).toBe("2026-10-04")
    expect(navigation.replace).not.toHaveBeenCalled()
  })

  it("follows the URL when its date changes", () => {
    navigation.searchParams = new URLSearchParams("date=2026-10-12")
    const { result, rerender } = renderHook(() => useReservationsDashboardPage(), {
      wrapper: createQueryWrapper(),
    })

    navigation.searchParams = new URLSearchParams("date=2026-10-20")
    rerender()

    expect(formatDateToISO(result.current.selectedDate)).toBe("2026-10-20")
  })

  it.each([
    ["past", "2026-10-03"],
    ["malformed", "sutra"],
  ])("rewrites a %s date in the URL to today", (_case, value) => {
    navigation.searchParams = new URLSearchParams({ date: value })

    renderHook(() => useReservationsDashboardPage(), { wrapper: createQueryWrapper() })

    expect(navigation.replace).toHaveBeenCalledWith("/reservations?date=2026-10-04", {
      scroll: false,
    })
  })

  it("replaces the history entry instead of pushing one when a day is picked", () => {
    const replaceState = vi.spyOn(window.history, "replaceState").mockImplementation(() => {})
    const pushState = vi.spyOn(window.history, "pushState")
    const { result } = renderHook(() => useReservationsDashboardPage(), {
      wrapper: createQueryWrapper(),
    })

    act(() => result.current.setSelectedDate(new Date(2026, 9, 7)))

    expect(replaceState).toHaveBeenCalledWith(null, "", "/reservations?date=2026-10-07")
    expect(pushState).not.toHaveBeenCalled()
    expect(navigation.replace).not.toHaveBeenCalled()
  })
})

describe("reservations list page", () => {
  beforeEach(() => {
    freezeClock()
    navigation.searchParams = new URLSearchParams("date=2026-10-12")
    navigation.replace.mockReset()
    api.ridesControllerList.mockReset().mockResolvedValue(EMPTY_PAGE)
    api.departuresControllerList.mockReset().mockResolvedValue(EMPTY_PAGE)
    api.storefrontControllerGetRideIcon.mockReset().mockResolvedValue({ status: 404, data: null })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("shows and loads the day named in the URL", async () => {
    render(<ReservationsPage />, { wrapper: createQueryWrapper() })

    const label = format(new Date(2026, 9, 12), "d. MMMM yyyy", { locale: srLatn })
    expect(await screen.findByRole("button", { name: label })).toBeTruthy()
    await waitFor(() =>
      expect(api.departuresControllerList).toHaveBeenCalledWith({ from: "2026-10-12", to: "2026-10-12" })
    )
  })

  it("puts a quick-picked day in the URL", async () => {
    const replaceState = vi.spyOn(window.history, "replaceState").mockImplementation(() => {})
    render(<ReservationsPage />, { wrapper: createQueryWrapper() })

    fireEvent.click(await screen.findByRole("button", { name: "Sutra" }))

    expect(replaceState).toHaveBeenCalledWith(null, "", "/reservations?date=2026-10-05")
  })
})

describe("seat map breadcrumbs", () => {
  beforeEach(() => {
    freezeClock()
    api.ridesControllerList.mockReset().mockResolvedValue(EMPTY_PAGE)
    api.reservationsControllerList.mockReset().mockResolvedValue(EMPTY_PAGE)
    api.departuresControllerGetById.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function breadcrumbHrefs() {
    const nav = screen.getByRole("navigation", { name: "breadcrumb" })
    return Array.from(nav.querySelectorAll("a")).map((link) => link.getAttribute("href"))
  }

  it("link back to the list on the departure's day, not the seat-map URL's", async () => {
    navigation.searchParams = new URLSearchParams("date=2026-10-05")
    api.departuresControllerGetById.mockResolvedValue({
      status: 200,
      data: departure({ serviceDate: "2026-10-06" }),
    })

    render(<SeatMapPage />, { wrapper: createQueryWrapper() })

    expect(await screen.findByRole("link", { name: "Rezervacije" })).toBeTruthy()
    await waitFor(() =>
      expect(breadcrumbHrefs()).toEqual([
        "/reservations?date=2026-10-06",
        "/reservations?date=2026-10-06",
      ])
    )
  })

  it("link to the bare list for a past departure", async () => {
    navigation.searchParams = new URLSearchParams("date=2026-10-01")
    api.departuresControllerGetById.mockResolvedValue({
      status: 200,
      data: departure({ serviceDate: "2026-10-01" }),
    })

    render(<SeatMapPage />, { wrapper: createQueryWrapper() })

    expect(await screen.findByRole("link", { name: "Rezervacije" })).toBeTruthy()
    await waitFor(() => expect(breadcrumbHrefs()).toEqual(["/reservations", "/reservations"]))
  })
})
