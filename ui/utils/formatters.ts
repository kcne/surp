// Date formatters
export const formatDate = (date: string | Date): string => {
  const d = typeof date === "string" ? new Date(date) : date
  return d.toLocaleDateString("sr-RS", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

export const formatDateTime = (date: string | Date): string => {
  const d = typeof date === "string" ? new Date(date) : date
  return d.toLocaleString("sr-RS", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export const formatTime = (time: string): string => {
  // time is in HH:MM format
  return time
}

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("sr-RS", {
    style: "currency",
    currency: "RSD",
  }).format(amount)
}

// Station formatters
export const formatStationRoute = (stations: Array<{ name: string }>): string => {
  return stations.map((s) => s.name).join(" → ")
}

// Ride formatters
export const formatRideName = (lineName: string, departureTime: string): string => {
  return `${lineName} - ${departureTime}`
}

export const formatDaysOfWeek = (days: number[]): string => {
  const dayNames = ["Ned", "Pon", "Uto", "Sre", "Čet", "Pet", "Sub"]
  return days.map((d) => dayNames[d]).join(", ")
}

// Passenger formatters
export const formatPassengerName = (firstName: string, lastName: string): string => {
  return `${firstName} ${lastName}`
}

export const formatPhoneNumber = (phone: string): string => {
  // Format phone number for display
  return phone.replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3")
}










