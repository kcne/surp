import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { Ride, RideInstance, RideFormData, RideException } from "@/types"
import { ridesApi } from "@/lib/api"
import { toast } from "sonner"
import { useLinesStore } from "./linesStore"
import { generateRideInstanceDates, isExceptionDate, formatDateToISO, parseISODate } from "@/utils/dateHelpers"
import { useReservationsStore } from "./reservationsStore"

interface RidesState {
  rides: Ride[]
  rideInstances: RideInstance[]
  selectedRide: Ride | null
  selectedDate: Date
  loading: boolean
  error: string | null
  fetchRides: () => Promise<void>
  fetchRideInstances: (date: Date) => Promise<void>
  createRide: (data: RideFormData) => Promise<void>
  updateRide: (id: string, data: Partial<RideFormData>) => Promise<void>
  cancelRide: (id: string) => Promise<void>
  generateRideInstances: (ride: Ride) => RideInstance[]
  setSelectedRide: (ride: Ride | null) => void
  setSelectedDate: (date: Date) => void
  clearError: () => void
}

// Helper to generate ride name
const generateRideName = (lineName: string): string => {
  return lineName
}

export const useRidesStore = create<RidesState>()(
  persist(
    (set, get) => {
      // Helper to ensure selectedDate is a Date object
      const ensureDate = (date: Date | string | undefined): Date => {
        if (date instanceof Date) return date
        if (typeof date === 'string') return new Date(date)
        return new Date()
      }

      // Get initial selectedDate from storage if available
      let initialSelectedDate = new Date()
      if (typeof window !== 'undefined') {
        try {
          const stored = localStorage.getItem('rides-storage')
          if (stored) {
            const parsed = JSON.parse(stored)
            if (parsed.state?.selectedDate) {
              initialSelectedDate = ensureDate(parsed.state.selectedDate)
            }
          }
        } catch {
          // Ignore parse errors
        }
      }

      return {
        rides: [],
        rideInstances: [],
        selectedRide: null,
        selectedDate: initialSelectedDate,
        loading: false,
        error: null,

  fetchRides: async () => {
    set({ loading: true, error: null })
    try {
      // TODO: Replace with actual API call
      // const response = await ridesApi.getAll()
      // set({ rides: response.data, loading: false })

      // For now, use existing rides from store (persisted in localStorage)
      // Don't overwrite existing rides
      const currentRides = get().rides
      set({ loading: false })
    } catch (error: any) {
      set({
        loading: false,
        error: error?.message || "Greška pri učitavanju vožnji",
      })
      toast.error("Greška pri učitavanju vožnji")
    }
  },

  fetchRideInstances: async (date: Date) => {
    set({ loading: true, error: null, selectedDate: date })
    try {
      // TODO: Replace with actual API call
      // const dateString = formatDateToISO(date)
      // const response = await ridesApi.getInstances(dateString)
      // set({ rideInstances: response.data, loading: false })

      // For now, generate instances from rides
      const rides = get().rides
      const instances: RideInstance[] = []

      // Get reservations from reservations store to calculate seat counts
      const allReservations = useReservationsStore.getState().allReservations

      rides.forEach((ride) => {
        if (ride.status === "cancelled") return

        const rideDate = formatDateToISO(date)
        const isException = ride.exceptions?.some((ex) => ex.date === rideDate)

        if (ride.type === "recurring") {
          if (!ride.startDate || !ride.daysOfWeek || ride.daysOfWeek.length === 0) {
            return
          }

          const startDate = new Date(ride.startDate + "T00:00:00")
          if (date < startDate) return

          if (ride.endDate) {
            const endDate = new Date(ride.endDate + "T00:00:00")
            if (date > endDate) return
          }

          const dayOfWeek = date.getDay()
          if (!ride.daysOfWeek.includes(dayOfWeek)) return

          // Check if this date is an exception
          const exception = ride.exceptions?.find((ex) => ex.date === rideDate)
          if (exception?.type === "skip") return

          // Get times for this day - prefer dayTimes, fallback to old format
          let departureTime: string | undefined
          let arrivalTime: string | undefined

          if (exception) {
            // Exception overrides everything
            departureTime = exception.departureTime
            arrivalTime = exception.arrivalTime
          } else if (ride.dayTimes && ride.dayTimes[dayOfWeek]) {
            // Use per-day times
            departureTime = ride.dayTimes[dayOfWeek].departureTime
            arrivalTime = ride.dayTimes[dayOfWeek].arrivalTime
          } else if (ride.departureTime && ride.arrivalTime) {
            // Fallback to old format
            departureTime = ride.departureTime
            arrivalTime = ride.arrivalTime
          }

          if (!departureTime || !arrivalTime) return

          const instanceId = `${ride.id}-${rideDate}`
          // Get reservations for this instance
          const reservations = allReservations[instanceId] || []
          // Count only active reservations
          const reservationCount = reservations.filter((r) => r.status === "active").length
          const capacity = ride.busCapacity
          const availableSeats = capacity - reservationCount

          instances.push({
            id: instanceId,
            rideId: ride.id,
            ride,
            date: rideDate,
            departureTime,
            arrivalTime,
            status: ride.status,
            reservationCount,
            availableSeats,
          })
        } else if (ride.type === "one-time") {
          if (ride.date === rideDate && ride.oneTimeDepartureTime && ride.oneTimeArrivalTime) {
            const instanceId = `${ride.id}-${rideDate}`
            // Get reservations for this instance
            const reservations = allReservations[instanceId] || []
            // Count only active reservations
            const reservationCount = reservations.filter((r) => r.status === "active").length
            const capacity = ride.busCapacity
            const availableSeats = capacity - reservationCount

            instances.push({
              id: instanceId,
              rideId: ride.id,
              ride,
              date: rideDate,
              departureTime: ride.oneTimeDepartureTime,
              arrivalTime: ride.oneTimeArrivalTime,
              status: ride.status,
              reservationCount,
              availableSeats,
            })
          }
        }
      })

      set({ rideInstances: instances, loading: false })
    } catch (error: any) {
      set({
        loading: false,
        error: error?.message || "Greška pri učitavanju instanci vožnji",
      })
      toast.error("Greška pri učitavanju instanci vožnji")
    }
  },

  createRide: async (data: RideFormData) => {
    set({ loading: true, error: null })
    try {
      // TODO: Replace with actual API call
      // const response = await ridesApi.create(data as Ride)
      // set((state) => ({ rides: [...state.rides, response.data], loading: false }))

      // For now, use mock
      const lines = useLinesStore.getState().lines
      const line = lines.find((l) => l.id === data.lineId)

      if (!line) {
        throw new Error("Linija nije pronađena")
      }

      const rideName = generateRideName(line.name)

      const newRide: Ride = {
        id: Date.now().toString(),
        name: rideName,
        line,
        busCapacity: data.busCapacity ?? 38,
        type: data.type,
        status: (data.status ?? "scheduled") as Ride["status"],
        startDate: data.startDate,
        endDate: data.endDate,
        daysOfWeek: data.daysOfWeek,
        departureTime: data.departureTime, // Keep for backward compatibility
        arrivalTime: data.arrivalTime, // Keep for backward compatibility
        dayTimes: data.dayTimes,
        exceptions: data.exceptions || [],
        date: data.date,
        oneTimeDepartureTime: data.oneTimeDepartureTime,
        oneTimeArrivalTime: data.oneTimeArrivalTime,
        createdAt: new Date().toISOString(),
      }

      set((state) => ({
        rides: [...state.rides, newRide],
        loading: false,
      }))
      
      // Regenerate ride instances for the current selected date if it exists
      const currentDate = get().selectedDate
      if (currentDate) {
        get().fetchRideInstances(currentDate)
      }
      
      toast.success("Vožnja je uspešno kreirana")
    } catch (error: any) {
      set({
        loading: false,
        error: error?.message || "Greška pri kreiranju vožnje",
      })
      toast.error(error?.message || "Greška pri kreiranju vožnje")
      throw error
    }
  },

  updateRide: async (id: string, data: Partial<RideFormData>) => {
    set({ loading: true, error: null })
    try {
      // TODO: Replace with actual API call
      // const response = await ridesApi.update(id, data)
      // set((state) => ({
      //   rides: state.rides.map((r) => (r.id === id ? response.data : r)),
      //   loading: false,
      // }))

      // For now, use mock
      const ride = get().rides.find((r) => r.id === id)
      if (!ride) {
        throw new Error("Vožnja nije pronađena")
      }

      const lines = useLinesStore.getState().lines
      const lineId = data.lineId || ride.line.id
      const line = lines.find((l) => l.id === lineId)

      if (!line) {
        throw new Error("Linija nije pronađena")
      }

      const rideName = generateRideName(line.name)

      const updatedRide: Ride = {
        ...ride,
        ...data,
        name: rideName,
        line: line,
        updatedAt: new Date().toISOString(),
      }

      set((state) => ({
        rides: state.rides.map((r) => (r.id === id ? updatedRide : r)),
        loading: false,
      }))
      
      // Regenerate ride instances for the current selected date if it exists
      const currentDate = get().selectedDate
      if (currentDate) {
        get().fetchRideInstances(currentDate)
      }
      
      toast.success("Vožnja je uspešno ažurirana")
    } catch (error: any) {
      set({
        loading: false,
        error: error?.message || "Greška pri ažuriranju vožnje",
      })
      toast.error("Greška pri ažuriranju vožnje")
      throw error
    }
  },

  cancelRide: async (id: string) => {
    set({ loading: true, error: null })
    try {
      // TODO: Replace with actual API call
      // await ridesApi.delete(id)
      // set((state) => ({
      //   rides: state.rides.map((r) =>
      //     r.id === id ? { ...r, status: "cancelled" } : r
      //   ),
      //   loading: false,
      // }))

      // For now, use mock
      set((state) => ({
        rides: state.rides.map((r) =>
          r.id === id ? { ...r, status: "cancelled", updatedAt: new Date().toISOString() } : r
        ),
        loading: false,
      }))
      
      // Regenerate ride instances for the current selected date if it exists
      const currentDate = get().selectedDate
      if (currentDate) {
        get().fetchRideInstances(currentDate)
      }
      
      toast.success("Vožnja je uspešno otkazana")
    } catch (error: any) {
      set({
        loading: false,
        error: error?.message || "Greška pri otkazivanju vožnje",
      })
      toast.error("Greška pri otkazivanju vožnje")
      throw error
    }
  },

  generateRideInstances: (ride: Ride): RideInstance[] => {
    const instances: RideInstance[] = []

    // Get reservations from reservations store to calculate seat counts
    const allReservations = useReservationsStore.getState().allReservations

    if (ride.type === "recurring") {
      if (!ride.startDate || !ride.daysOfWeek || ride.daysOfWeek.length === 0) {
        return instances
      }

      const startDate = new Date(ride.startDate + "T00:00:00")
      const endDate = ride.endDate ? new Date(ride.endDate + "T00:00:00") : null
      const threeMonthsFromNow = new Date()
      threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3)

      const effectiveEndDate = endDate && endDate < threeMonthsFromNow ? endDate : threeMonthsFromNow

      const dates = generateRideInstanceDates(startDate, effectiveEndDate, ride.daysOfWeek)

      dates.forEach((date) => {
        const dateString = formatDateToISO(date)
        const exception = ride.exceptions?.find((ex) => ex.date === dateString)

        if (exception?.type === "skip") return

        const dayOfWeek = date.getDay()
        
        // Get times for this day - prefer dayTimes, fallback to old format
        let departureTime: string | undefined
        let arrivalTime: string | undefined

        if (exception) {
          // Exception overrides everything
          departureTime = exception.departureTime
          arrivalTime = exception.arrivalTime
        } else if (ride.dayTimes && ride.dayTimes[dayOfWeek]) {
          // Use per-day times
          departureTime = ride.dayTimes[dayOfWeek].departureTime
          arrivalTime = ride.dayTimes[dayOfWeek].arrivalTime
        } else if (ride.departureTime && ride.arrivalTime) {
          // Fallback to old format
          departureTime = ride.departureTime
          arrivalTime = ride.arrivalTime
        }

        if (!departureTime || !arrivalTime) return

        const instanceId = `${ride.id}-${dateString}`
        // Get reservations for this instance
        const reservations = allReservations[instanceId] || []
        // Count only active reservations
        const reservationCount = reservations.filter((r) => r.status === "active").length
        const capacity = ride.busCapacity
        const availableSeats = capacity - reservationCount

        instances.push({
          id: instanceId,
          rideId: ride.id,
          ride,
          date: dateString,
          departureTime,
          arrivalTime,
          status: ride.status,
          reservationCount,
          availableSeats,
        })
      })
    } else if (ride.type === "one-time") {
      if (ride.date && ride.oneTimeDepartureTime && ride.oneTimeArrivalTime) {
        const instanceId = `${ride.id}-${ride.date}`
        // Get reservations for this instance
        const reservations = allReservations[instanceId] || []
        // Count only active reservations
        const reservationCount = reservations.filter((r) => r.status === "active").length
        const capacity = ride.busCapacity
        const availableSeats = capacity - reservationCount

        instances.push({
          id: instanceId,
          rideId: ride.id,
          ride,
          date: ride.date,
          departureTime: ride.oneTimeDepartureTime,
          arrivalTime: ride.oneTimeArrivalTime,
          status: ride.status,
          reservationCount,
          availableSeats,
        })
      }
    }

    return instances
  },

  setSelectedRide: (ride: Ride | null) => {
    set({ selectedRide: ride })
  },

  setSelectedDate: (date: Date) => {
    // Ensure date is a Date object
    const dateObj = date instanceof Date ? date : new Date(date)
    set({ selectedDate: dateObj })
  },

  clearError: () => {
    set({ error: null })
  },
      }
    },
    {
      name: "rides-storage",
      partialize: (state) => ({
        rides: state.rides,
        selectedDate: state.selectedDate instanceof Date 
          ? state.selectedDate.toISOString() 
          : state.selectedDate,
      }),
      // Convert stored ISO string back to Date on rehydration
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Convert selectedDate from string to Date
          if (state.selectedDate) {
            if (typeof state.selectedDate === 'string') {
              state.selectedDate = new Date(state.selectedDate)
            } else if (!(state.selectedDate instanceof Date)) {
              state.selectedDate = new Date()
            }
          }
          // Ensure rides array exists (should be loaded from localStorage)
          if (!state.rides) {
            state.rides = []
          }
        }
      },
    }
  )
)

