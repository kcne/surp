import { format, addDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from "date-fns"

import { DEFAULT_LOCALE } from "@/i18n/locales"
import {
  formatBusinessDate,
  formatClockTime,
  formatDate as formatDateIntl,
  formatDuration as formatDurationIntl,
  getWeekdayName,
} from "@/i18n/format"

/**
 * Day names pinned to the default locale, kept for call sites that have not
 * been translated yet. New code should call `getWeekdayName` from
 * `@/i18n/format` with the active locale.
 */
export const getDayName = (dayIndex: number): string =>
  getWeekdayName(dayIndex, DEFAULT_LOCALE, "long")

export const getShortDayName = (dayIndex: number): string =>
  getWeekdayName(dayIndex, DEFAULT_LOCALE, "short")

// Format date to YYYY-MM-DD
export const formatDateToISO = (date: Date): string => {
  return format(date, "yyyy-MM-dd")
}

// Format duration in minutes as "Xh Ym" / "Xh" / "Ym"
export const formatDuration = (durationInMinutes?: number): string | null =>
  formatDurationIntl(durationInMinutes, DEFAULT_LOCALE)

// Parse YYYY-MM-DD to Date
export const parseISODate = (dateString: string): Date => {
  return new Date(dateString + "T00:00:00")
}

// Get all dates in a month
export const getDatesInMonth = (date: Date): Date[] => {
  const start = startOfMonth(date)
  const end = endOfMonth(date)
  return eachDayOfInterval({ start, end })
}

// Check if date is in range
export const isDateInRange = (date: Date, startDate: Date, endDate?: Date): boolean => {
  if (endDate) {
    return date >= startDate && date <= endDate
  }
  return date >= startDate
}

// Generate dates for recurring ride (3 months ahead)
export const generateRideInstanceDates = (
  startDate: Date,
  endDate: Date | undefined,
  daysOfWeek: number[]
): Date[] => {
  const dates: Date[] = []
  const threeMonthsFromNow = addDays(new Date(), 90)
  const effectiveEndDate = endDate && endDate < threeMonthsFromNow ? endDate : threeMonthsFromNow

  let currentDate = new Date(startDate)
  while (currentDate <= effectiveEndDate) {
    const dayOfWeek = currentDate.getDay()
    if (daysOfWeek.includes(dayOfWeek)) {
      dates.push(new Date(currentDate))
    }
    currentDate = addDays(currentDate, 1)
  }

  return dates
}

// Check if date matches exception
export const isExceptionDate = (date: Date, exceptions: Array<{ date: string; type: string }>): boolean => {
  return exceptions.some((ex) => isSameDay(parseISODate(ex.date), date))
}

// Format date for display
export const formatDateDisplay = (date: Date | string): string =>
  typeof date === "string"
    ? formatBusinessDate(date, DEFAULT_LOCALE)
    : formatDateIntl(date, DEFAULT_LOCALE)

// Format time for display
export const formatTimeDisplay = (time: string): string => formatClockTime(time)

