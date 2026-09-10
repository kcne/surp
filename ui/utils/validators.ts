import { z } from "zod"

// Station validators
export const stationSchema = z.object({
  name: z.string().min(1, "Naziv stanice je obavezan"),
  address: z.string().min(1, "Adresa je obavezna"),
  category: z.enum(["BUS_STATION", "BUS_STOP"]).optional(),
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
  intermediateStops: z
    .array(
      z.object({
        stationId: z.string().min(1),
        isBoarding: z.boolean(),
        isDropoff: z.boolean(),
      })
    )
    .optional(),
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
const stationTimeSchema = z.object({
  stationId: z.string().min(1),
  orderIndex: z.number().int().min(0),
  stationName: z.string().optional(),
  time: z.string().min(1, "Vreme stanice je obavezno"),
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
  departureTime: z.string().optional(), // Deprecated
  arrivalTime: z.string().optional(), // Deprecated
  daySchedules: z.record(z.string(), z.array(stationTimeSchema)).optional(),
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
      
      if (data.daySchedules && Object.keys(data.daySchedules).length > 0) {
        const allDaysHaveTimes = data.daysOfWeek.every((day) => {
          const stationTimes = data.daySchedules?.[day] || data.daySchedules?.[String(day)]
          if (!stationTimes || stationTimes.length === 0) {
            return false
          }

          return stationTimes.every(
            (stationTime) =>
              Boolean(stationTime.time) && stationTime.time.trim() !== ""
          )
        })
        if (!allDaysHaveTimes) {
          return false
        }
        return true
      }

      return false
    } else {
      return data.date && data.oneTimeDepartureTime && data.oneTimeArrivalTime
    }
  },
  {
    message: "Sva obavezna polja moraju biti popunjena. Za ponavljajuće vožnje unesite vreme za svaku stanicu svakog selektovanog dana.",
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
    message: "Tip putnika je obavezan",
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
    message: "Rola je obavezna",
  }),
  isActive: z.boolean(),
})

export const updateAgencyUserSchema = z.object({
  username: z.string().min(1, "Korisničko ime je obavezno"),
  email: z.string().email("Neispravan format email-a"),
  password: z.string().optional().or(z.literal("")),
  role: z.enum(["MANAGER", "STAFF"], {
    message: "Rola je obavezna",
  }),
  isActive: z.boolean(),
})

export const resetAgencyUserPasswordSchema = z.object({
  newPassword: z.string().min(8, "Lozinka mora imati najmanje 8 karaktera"),
  requirePasswordChange: z.boolean(),
})

// Reservation validators
export const reservationSchema = z.object({
  rideInstanceId: z.string().min(1, "Vožnja je obavezna"),
  passengerId: z.string().min(1, "Putnik je obavezan"),
  seatNumber: z.number().int().positive(),
  departureStationId: z.string().min(1, "Polazna stanica je obavezna"),
  arrivalStationId: z.string().min(1, "Dolazna stanica je obavezna"),
  notes: z.string().max(500, "Napomena može imati najviše 500 karaktera").optional(),
}).refine(
  (data) => data.departureStationId !== data.arrivalStationId,
  {
    message: "Polazna i dolazna stanica moraju biti različite",
    path: ["arrivalStationId"],
  }
)

