import { format, addDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from "date-fns"

// Get Serbian day names
export const getDayName = (dayIndex: number): string => {
  const dayNames = ["Nedelja", "Ponedeljak", "Utorak", "Sreda", "Četvrtak", "Petak", "Subota"]
  return dayNames[dayIndex]
}

export const getShortDayName = (dayIndex: number): string => {
  const dayNames = ["Ned", "Pon", "Uto", "Sre", "Čet", "Pet", "Sub"]
  return dayNames[dayIndex]
}

// Format date to YYYY-MM-DD
export const formatDateToISO = (date: Date): string => {
  return format(date, "yyyy-MM-dd")
}

// Format duration in minutes as "Xh Ym" / "Xh" / "Ym"
export const formatDuration = (durationInMinutes?: number): string | null => {
  if (!durationInMinutes || durationInMinutes <= 0) return null

  const hours = Math.floor(durationInMinutes / 60)
  const minutes = durationInMinutes % 60

  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}min`
  }

  if (hours > 0) {
    return `${hours}h`
  }

  return `${minutes}min`
}

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
export const formatDateDisplay = (date: Date | string): string => {
  const d = typeof date === "string" ? parseISODate(date) : date
  return format(d, "d. MMMM yyyy")
}

// Format time for display
export const formatTimeDisplay = (time: string): string => {
  // time is in HH:MM format
  return time
}

