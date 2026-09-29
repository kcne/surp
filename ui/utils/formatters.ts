/**
 * Legacy formatting entry points, kept so existing call sites keep working
 * while surfaces are translated one at a time.
 *
 * Each of these pins the default locale. New code should import from
 * `@/i18n/format` and pass the active locale instead — see
 * `docs/localization-inventory.md` for which issue owns each surface.
 */

import { DEFAULT_LOCALE } from "@/i18n/locales"
import {
  formatClockTime,
  formatCurrency as formatCurrencyIntl,
  formatDate as formatDateIntl,
  formatDateTime as formatDateTimeIntl,
  getWeekdayName,
} from "@/i18n/format"

export const formatDate = (date: string | Date): string => formatDateIntl(date, DEFAULT_LOCALE)

export const formatDateTime = (date: string | Date): string =>
  formatDateTimeIntl(date, DEFAULT_LOCALE)

export const formatTime = (time: string): string => formatClockTime(time)

export const formatCurrency = (amount: number): string =>
  formatCurrencyIntl(amount, DEFAULT_LOCALE)

// Station formatters
export const formatStationRoute = (stations: Array<{ name: string }>): string => {
  return stations.map((s) => s.name).join(" → ")
}

// Ride formatters
export const formatRideName = (lineName: string, departureTime: string): string => {
  return `${lineName} - ${departureTime}`
}

export const formatDaysOfWeek = (days: number[]): string =>
  days.map((day) => getWeekdayName(day, DEFAULT_LOCALE, "short")).join(", ")

// Passenger formatters
export const formatPassengerName = (firstName: string, lastName: string): string => {
  return `${firstName} ${lastName}`
}

export const formatPhoneNumber = (phone: string): string => {
  // Format phone number for display
  return phone.replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3")
}
