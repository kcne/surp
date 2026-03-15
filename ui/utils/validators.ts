import { z } from "zod"

// Station validators
export const stationSchema = z.object({
  name: z.string().min(1, "Naziv stanice je obavezan"),
  address: z.string().min(1, "Adresa je obavezna"),
  category: z.enum(["Autobuska stanica", "Stajalište"]).optional(),
  contactPhone: z
    .string()
    .regex(/^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/, "Neispravan format telefona")
    .optional()
    .or(z.literal("")),
  notes: z.string().optional(),
})

// Line validators
export const lineSchema = z.object({
  name: z.string().optional(),
  departureStationId: z.string().min(1, "Polazna stanica je obavezna"),
  arrivalStationId: z.string().min(1, "Dolazna stanica je obavezna"),
  intermediateStationIds: z.array(z.string()).optional(),
  directionMode: z.enum(["single", "both"]).optional().default("both"),
  distance: z.number().positive().optional(),
  duration: z.number().positive().optional(),
  basePrice: z.number().positive().optional(),
  isActive: z.boolean().optional().default(true),
}).refine(
  (data) => data.departureStationId !== data.arrivalStationId,
  {
    message: "Polazna i dolazna stanica moraju biti različite",
    path: ["arrivalStationId"],
  }
)

// Ride validators
const dayTimeSchema = z.object({
  departureTime: z.string().min(1, "Vreme polaska je obavezno"),
  arrivalTime: z.string().min(1, "Vreme dolaska je obavezno"),
})

export const rideSchema = z.object({
  lineId: z.string().min(1, "Linija je obavezna"),
  busCapacity: z.number().int().positive().default(38),
  type: z.enum(["recurring", "one-time"]),
  status: z.enum(["scheduled", "completed", "cancelled"]).optional().default("scheduled"),
  // Recurring fields
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  daysOfWeek: z.array(z.number().min(0).max(6)).optional(),
  departureTime: z.string().optional(), // Deprecated, kept for backward compatibility
  arrivalTime: z.string().optional(), // Deprecated, kept for backward compatibility
  // dayTimes uses string keys (React Hook Form converts numbers to strings in object keys)
  dayTimes: z.record(z.string(), dayTimeSchema).optional(),
  // One-time fields
  date: z.string().optional(),
  oneTimeDepartureTime: z.string().optional(),
  oneTimeArrivalTime: z.string().optional(),
}).refine(
  (data) => {
    if (data.type === "recurring") {
      if (!data.startDate || !data.daysOfWeek || data.daysOfWeek.length === 0) {
        return false
      }
      
      // Check if dayTimes is provided and has entries for all selected days
      if (data.dayTimes && Object.keys(data.dayTimes).length > 0) {
        // Validate that all selected days have times
        // Convert day to string for lookup (React Hook Form uses string keys)
        const allDaysHaveTimes = data.daysOfWeek.every((day) => {
          // Try both string and number key
          const dayTime = data.dayTimes?.[day] || data.dayTimes?.[String(day)]
          return dayTime?.departureTime && dayTime?.departureTime.trim() !== "" && 
                 dayTime?.arrivalTime && dayTime?.arrivalTime.trim() !== ""
        })
        if (!allDaysHaveTimes) {
          return false
        }
        return true
      }
      
      // Fallback to old format (departureTime/arrivalTime) for backward compatibility
      if (data.departureTime && data.arrivalTime) {
        return true
      }
      
      return false
    } else {
      return data.date && data.oneTimeDepartureTime && data.oneTimeArrivalTime
    }
  },
  {
    message: "Sva obavezna polja moraju biti popunjena za izabrani tip vožnje. Za ponavljajuće vožnje, unesite vreme za svaki selektovani dan.",
  }
)

// Passenger validators
export const passengerSchema = z.object({
  firstName: z.string().min(1, "Ime je obavezno"),
  lastName: z.string().min(1, "Prezime je obavezno"),
  phone: z.string().min(1, "Telefon je obavezan").regex(/^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/, "Neispravan format telefona"),
  email: z.string().email("Neispravan format email-a").optional().or(z.literal("")),
  idCardNumber: z.string().optional(),
  passengerType: z.enum(["dete", "odrasli", "student", "penzioner"], {
    required_error: "Tip putnika je obavezan",
  }),
  address: z.string().optional(),
  notes: z.string().optional(),
})

// Agency user validators
export const createAgencyUserSchema = z.object({
  username: z.string().min(1, "Korisničko ime je obavezno"),
  email: z.string().email("Neispravan format email-a"),
  password: z
    .string()
    .min(8, "Lozinka mora imati najmanje 8 karaktera"),
  role: z.enum(["MANAGER", "STAFF"], {
    required_error: "Rola je obavezna",
  }),
})

export const updateAgencyUserSchema = z.object({
  username: z.string().min(1, "Korisničko ime je obavezno"),
  email: z.string().email("Neispravan format email-a"),
  role: z.enum(["MANAGER", "STAFF"], {
    required_error: "Rola je obavezna",
  }),
  isActive: z.boolean(),
})

// Reservation validators
export const reservationSchema = z.object({
  rideInstanceId: z.string().min(1, "Vožnja je obavezna"),
  passengerId: z.string().min(1, "Putnik je obavezan"),
  seatNumber: z.number().int().positive(),
  departureStationId: z.string().min(1, "Polazna stanica je obavezna"),
  arrivalStationId: z.string().min(1, "Dolazna stanica je obavezna"),
}).refine(
  (data) => data.departureStationId !== data.arrivalStationId,
  {
    message: "Polazna i dolazna stanica moraju biti različite",
    path: ["arrivalStationId"],
  }
)

