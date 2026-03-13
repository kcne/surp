
// User Types
export interface User {
  id: string
  username: string
  email?: string
  name?: string
  role?: string
}

// Station Types
export type StationCategory = "Autobuska stanica" | "Stajalište"

export interface Station {
  id: string
  name: string
  address: string
  category?: StationCategory
  contactPhone?: string
  notes?: string
  createdAt?: string
  updatedAt?: string
}

export type StationFormData = Omit<Station, 'id' | 'createdAt' | 'updatedAt'>

// Line Types
export interface LineStation {
  stationId: string
  stationName: string
  order: number
  distanceFromStart?: number
  estimatedTimeFromStart?: number
}

export interface Line {
  id: string
  name: string
  departureStation: Station
  arrivalStation: Station
  intermediateStations: LineStation[]
  directionMode?: "single" | "both"
  direction?: "outbound" | "return"
  pairKey?: string
  distance?: number // km
  duration?: number // minutes
  basePrice?: number
  isActive: boolean
  createdAt?: string
  updatedAt?: string
}

export type LineFormData = {
  name?: string
  departureStationId: string
  arrivalStationId: string
  intermediateStationIds?: string[]
  directionMode?: "single" | "both"
  distance?: number
  duration?: number
  basePrice?: number
  isActive?: boolean
}

// Ride Types
export type RideType = 'recurring' | 'one-time'

export type RideStatus = 'scheduled' | 'completed' | 'cancelled'

export interface RideException {
  id: string
  date: string // YYYY-MM-DD
  type: 'skip' | 'additional'
  departureTime?: string // HH:MM
  arrivalTime?: string // HH:MM
}

export interface DayTime {
  departureTime: string // HH:MM
  arrivalTime: string // HH:MM
}

export interface Ride {
  id: string
  name: string // Auto-generated
  line: Line
  busCapacity: number
  type: RideType
  status: RideStatus
  
  // Recurring ride fields
  startDate?: string // YYYY-MM-DD
  endDate?: string // YYYY-MM-DD (optional)
  daysOfWeek?: number[] // 0 = Sunday, 1 = Monday, etc.
  departureTime?: string // HH:MM (deprecated, use dayTimes instead)
  arrivalTime?: string // HH:MM (deprecated, use dayTimes instead)
  dayTimes?: Record<number, DayTime> // Map of day number (0-6) to times
  exceptions?: RideException[]
  
  // One-time ride fields
  date?: string // YYYY-MM-DD
  oneTimeDepartureTime?: string // HH:MM
  oneTimeArrivalTime?: string // HH:MM
  
  createdAt?: string
  updatedAt?: string
}

export type RideFormData = {
  lineId: string
  busCapacity?: number
  type: RideType
  status?: RideStatus
  // Recurring fields
  startDate?: string
  endDate?: string
  daysOfWeek?: number[]
  departureTime?: string // Deprecated, use dayTimes instead
  arrivalTime?: string // Deprecated, use dayTimes instead
  dayTimes?: Record<number, DayTime> // Map of day number (0-6) to times
  exceptions?: RideException[]
  // One-time fields
  date?: string
  oneTimeDepartureTime?: string
  oneTimeArrivalTime?: string
}

// Ride Instance Types
export interface RideInstance {
  id: string
  rideId: string
  ride: Ride
  date: string // YYYY-MM-DD
  departureTime: string // HH:MM
  arrivalTime: string // HH:MM
  status: RideStatus
  reservationCount?: number
  availableSeats?: number
}

// Passenger Types
export type PassengerType = 'dete' | 'odrasli' | 'student' | 'penzioner'

export interface Passenger {
  id: string
  firstName: string
  lastName: string
  phone: string
  email?: string
  idCardNumber?: string
  passengerType: PassengerType
  dateOfBirth?: string // YYYY-MM-DD
  address?: string
  notes?: string
  createdAt?: string
  updatedAt?: string
}

export type PassengerFormData = Omit<Passenger, 'id' | 'createdAt' | 'updatedAt'>

// Reservation Types
export interface Reservation {
  id: string
  rideInstanceId: string
  rideInstance: RideInstance
  passengerId: string
  passenger: Passenger
  seatNumber: number
  departureStationId: string
  departureStation: Station
  arrivalStationId: string
  arrivalStation: Station
  status: 'active' | 'cancelled'
  createdAt?: string
  updatedAt?: string
}

export type ReservationFormData = {
  rideInstanceId: string
  passengerId: string
  seatNumber: number
  departureStationId: string
  arrivalStationId: string
  status?: 'active' | 'cancelled'
}

// Seat Map Types
export interface SeatInfo {
  seatNumber: number
  status: 'available' | 'reserved' | 'selected'
  reservation?: Reservation
  isSelected?: boolean
}

export interface SeatMapData {
  seats: SeatInfo[]
  capacity: number
  availableCount: number
  reservedCount: number
}

// UI Types
export interface Notification {
  id: string
  message: string
  type: 'success' | 'error' | 'warning' | 'info'
  timestamp: number
}

// API Response Types
export interface ApiResponse<T> {
  data: T
  message?: string
  error?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
}
