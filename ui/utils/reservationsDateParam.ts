import { isValid, parse, startOfDay } from "date-fns"
import { formatDateToISO } from "@/utils/dateHelpers"

const DATE_PARAM_PATTERN = /^\d{4}-\d{2}-\d{2}$/

// The reservations list keeps its selected day in `?date=YYYY-MM-DD`, so the
// back button, the seat-map breadcrumbs and a refresh all return to it (#126).
// A missing, malformed or past date falls back to today, matching the
// calendar, which does not let a past day be picked.
export function parseReservationsDateParam(value: string | null | undefined, now = new Date()): Date {
  const today = startOfDay(now)
  if (!value || !DATE_PARAM_PATTERN.test(value)) return today

  const parsed = parse(value, "yyyy-MM-dd", today)
  if (!isValid(parsed) || formatDateToISO(parsed) !== value) return today

  return parsed < today ? today : parsed
}

// A past day links to the bare list: the list would show today anyway, and
// the URL should not name a day the page is not showing.
export function reservationsListHref(date?: Date | null, now = new Date()): string {
  if (!date || !isValid(date) || date < startOfDay(now)) return "/reservations"
  return `/reservations?date=${formatDateToISO(date)}`
}
