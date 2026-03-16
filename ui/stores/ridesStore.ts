import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { Ride, RideInstance, RideFormData } from "@/types"
import { toast } from "sonner"
import {
  linesControllerGetById,
  ridesControllerAddException,
  ridesControllerCreate,
  ridesControllerGetById,
  ridesControllerList,
  ridesControllerListInstancesByDate,
  ridesControllerRemove,
  ridesControllerRemoveException,
  ridesControllerReplace,
  ridesControllerReplaceDayTimes,
  ridesControllerUpdate,
} from "@/infrastructure/generated/surp-api"
import type {
  PaginatedRidesResponseDto,
  RideInstancesByDateResponseDto,
  RideResponseDto,
} from "@/infrastructure/generated/model"
import { toLine } from "@/infrastructure/mappers/lineMappers"
import {
  toCreateRideDto,
  toCreateRideExceptionDto,
  toRide,
  toRideInstance,
  toReplaceRideDayTimesDto,
  toUpdateRideDto,
} from "@/infrastructure/mappers/rideMappers"
import { getApiErrorMessage } from "@/infrastructure/utils/errors"
import { formatDateToISO, generateRideInstanceDates } from "@/utils/dateHelpers"
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

function isSuccessStatus(status: number, expected?: number): boolean {
  if (expected !== undefined) {
    return status === expected
  }

  return status >= 200 && status < 300
}

const fetchLineById = async (lineId: string) => {
  const response = await linesControllerGetById(lineId)

  if (response.status !== 200) {
    throw new Error("Linija nije pronađena")
  }

  return toLine(response.data)
}

function hasPatchableFields(data: Partial<RideFormData>): boolean {
  const payload = toUpdateRideDto(data)
  return Object.values(payload).some((value) => value !== undefined)
}

function shouldUsePutReplace(data: Partial<RideFormData>): boolean {
  return Boolean(data.lineId && data.type)
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
            const response = await ridesControllerList({ page: 1, pageSize: 200 })
            if (!isSuccessStatus(response.status, 200)) {
              throw new Error("Neuspesno ucitavanje voznji")
            }

            const ridesPage = response.data as PaginatedRidesResponseDto

            const lineIds = Array.from(
              new Set(ridesPage.items.map((item: RideResponseDto) => item.lineId))
            )
            const lineFetchResults = await Promise.allSettled(
              lineIds.map(async (lineId) => ({ lineId, line: await fetchLineById(lineId) }))
            )

            const lineLookup = new Map<string, ReturnType<typeof toLine>>()

            lineFetchResults.forEach((result) => {
              if (result.status === "fulfilled") {
                lineLookup.set(result.value.lineId, result.value.line)
              }
            })

            const rides = ridesPage.items.map((item: RideResponseDto) =>
              toRide(item, lineLookup.get(item.lineId))
            )

            const selectedRideId = get().selectedRide?.id
            const selectedRide = selectedRideId
              ? rides.find((ride) => ride.id === selectedRideId) ?? null
              : null

            set({ rides, selectedRide, loading: false })
          } catch (error: unknown) {
            const message = getApiErrorMessage(error, "Greška pri učitavanju vožnji")
            set({ loading: false, error: message })
            toast.error(message)
          }
        },

        fetchRideInstances: async (date: Date) => {
          set({ loading: true, error: null, selectedDate: date })

          try {
            if (get().rides.length === 0) {
              await get().fetchRides()
            }

            const response = await ridesControllerListInstancesByDate({
              date: formatDateToISO(date),
              timezoneOffsetMinutes: -date.getTimezoneOffset(),
            })

            if (!isSuccessStatus(response.status, 200)) {
              throw new Error("Neuspesno ucitavanje instanci voznji")
            }

            const rideLookup = new Map(get().rides.map((ride) => [ride.id, ride]))
            const instancesPayload = response.data as RideInstancesByDateResponseDto
            const instances = instancesPayload.items.map((item) =>
              toRideInstance(item, rideLookup.get(item.rideId))
            )

            set({ rideInstances: instances, loading: false })
          } catch (error: unknown) {
            const message = getApiErrorMessage(
              error,
              "Greška pri učitavanju instanci vožnji"
            )
            set({ loading: false, error: message })
            toast.error(message)
          }
        },

        createRide: async (data: RideFormData) => {
          set({ loading: true, error: null })

          try {
            const createResponse = await ridesControllerCreate(toCreateRideDto(data))
            if (!isSuccessStatus(createResponse.status)) {
              throw new Error("Neuspesno kreiranje voznje")
            }

            const createdRide = createResponse.data as RideResponseDto

            if (data.exceptions?.length) {
              for (const exception of data.exceptions) {
                const addExceptionResponse = await ridesControllerAddException(
                  createdRide.id,
                  toCreateRideExceptionDto(exception)
                )

                if (!isSuccessStatus(addExceptionResponse.status)) {
                  throw new Error("Neuspesno dodavanje izuzetka voznje")
                }
              }
            }

            const detailResponse = await ridesControllerGetById(createdRide.id)
            if (!isSuccessStatus(detailResponse.status, 200)) {
              throw new Error("Neuspesno ucitavanje detalja voznje")
            }

            const detailedRide = detailResponse.data as RideResponseDto
            const line = await fetchLineById(detailedRide.lineId).catch(() => undefined)
            const newRide = toRide(detailedRide, line)

            set((state) => ({
              rides: [...state.rides.filter((ride) => ride.id !== newRide.id), newRide],
              loading: false,
            }))

            await get().fetchRideInstances(get().selectedDate)

            toast.success("Vožnja je uspešno kreirana")
          } catch (error: unknown) {
            const message = getApiErrorMessage(error, "Greška pri kreiranju vožnje")
            set({ loading: false, error: message })
            toast.error(message)
            throw error
          }
        },

        updateRide: async (id: string, data: Partial<RideFormData>) => {
          set({ loading: true, error: null })

          try {
            const existingRide = get().rides.find((ride) => ride.id === id)
            if (!existingRide) {
              throw new Error("Vožnja nije pronađena")
            }

            const hasExceptionsUpdate = Array.isArray(data.exceptions)
            const hasDayTimesUpdate = data.dayTimes !== undefined
            const patchable = hasPatchableFields(data)

            if (hasDayTimesUpdate) {
              const dayTimesResponse = await ridesControllerReplaceDayTimes(
                id,
                toReplaceRideDayTimesDto(data.dayTimes)
              )

              if (!isSuccessStatus(dayTimesResponse.status, 200)) {
                throw new Error("Neuspesno azuriranje rasporeda vremena voznje")
              }
            }

            if (patchable) {
              const payload = toUpdateRideDto(
                hasDayTimesUpdate
                  ? {
                      ...data,
                      dayTimes: undefined,
                    }
                  : data
              )

              const response = shouldUsePutReplace(data) && !hasExceptionsUpdate
                ? await ridesControllerReplace(id, payload)
                : await ridesControllerUpdate(id, payload)

              if (!isSuccessStatus(response.status, 200)) {
                throw new Error("Neuspesno azuriranje voznje")
              }
            }

            if (hasExceptionsUpdate) {
              const nextExceptions = data.exceptions ?? []
              const existingExceptions = existingRide.exceptions ?? []

              const nextIds = new Set(nextExceptions.map((exception) => exception.id))
              const existingIds = new Set(existingExceptions.map((exception) => exception.id))

              const toRemove = existingExceptions.filter(
                (exception) => !nextIds.has(exception.id)
              )
              const toAdd = nextExceptions.filter(
                (exception) => !existingIds.has(exception.id)
              )

              for (const exception of toRemove) {
                const removeResponse = await ridesControllerRemoveException(id, exception.id)

                if (!isSuccessStatus(removeResponse.status)) {
                  throw new Error("Neuspesno uklanjanje izuzetka voznje")
                }
              }

              for (const exception of toAdd) {
                const addResponse = await ridesControllerAddException(
                  id,
                  toCreateRideExceptionDto(exception)
                )

                if (!isSuccessStatus(addResponse.status)) {
                  throw new Error("Neuspesno dodavanje izuzetka voznje")
                }
              }
            }

            const detailResponse = await ridesControllerGetById(id)
            if (!isSuccessStatus(detailResponse.status, 200)) {
              throw new Error("Neuspesno ucitavanje detalja voznje")
            }

            const detailedRide = detailResponse.data as RideResponseDto
            const line = await fetchLineById(detailedRide.lineId).catch(() => undefined)
            const updatedRide = toRide(detailedRide, line)

            set((state) => ({
              rides: state.rides.map((ride) =>
                ride.id === id ? updatedRide : ride
              ),
              selectedRide:
                state.selectedRide?.id === id ? updatedRide : state.selectedRide,
              loading: false,
            }))

            await get().fetchRideInstances(get().selectedDate)

            toast.success("Vožnja je uspešno ažurirana")
          } catch (error: unknown) {
            const message = getApiErrorMessage(error, "Greška pri ažuriranju vožnje")
            set({ loading: false, error: message })
            toast.error(message)
            throw error
          }
        },

        cancelRide: async (id: string) => {
          set({ loading: true, error: null })

          try {
            const response = await ridesControllerRemove(id)
            if (!isSuccessStatus(response.status, 200)) {
              throw new Error("Neuspesno brisanje voznje")
            }

            set((state) => ({
              rides: state.rides.filter((ride) => ride.id !== id),
              rideInstances: state.rideInstances.filter((instance) => instance.rideId !== id),
              selectedRide: state.selectedRide?.id === id ? null : state.selectedRide,
              loading: false,
            }))

            await get().fetchRideInstances(get().selectedDate)

            toast.success("Vožnja je uspešno obrisana")
          } catch (error: unknown) {
            const message = getApiErrorMessage(error, "Greška pri brisanju vožnje")
            set({ loading: false, error: message })
            toast.error(message)
            throw error
          }
        },

        generateRideInstances: (ride: Ride): RideInstance[] => {
          const instances: RideInstance[] = []

          const allReservations = useReservationsStore.getState().allReservations

          if (ride.type === "recurring") {
            if (!ride.startDate || !ride.daysOfWeek || ride.daysOfWeek.length === 0) {
              return instances
            }

            const startDate = new Date(`${ride.startDate}T00:00:00`)
            const endDate = ride.endDate ? new Date(`${ride.endDate}T00:00:00`) : null
            const threeMonthsFromNow = new Date()
            threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3)

            const effectiveEndDate =
              endDate && endDate < threeMonthsFromNow ? endDate : threeMonthsFromNow

            const dates = generateRideInstanceDates(startDate, effectiveEndDate, ride.daysOfWeek)

            dates.forEach((date) => {
              const dateString = formatDateToISO(date)
              const exception = ride.exceptions?.find((ex) => ex.date === dateString)

              if (exception?.type === "skip") {
                return
              }

              const dayOfWeek = date.getDay()

              let departureTime: string | undefined
              let arrivalTime: string | undefined

              if (exception?.type === "additional") {
                departureTime = exception.departureTime
                arrivalTime = exception.arrivalTime
              } else if (ride.dayTimes && ride.dayTimes[dayOfWeek]) {
                departureTime = ride.dayTimes[dayOfWeek].departureTime
                arrivalTime = ride.dayTimes[dayOfWeek].arrivalTime
              } else if (ride.departureTime && ride.arrivalTime) {
                departureTime = ride.departureTime
                arrivalTime = ride.arrivalTime
              }

              if (!departureTime || !arrivalTime) {
                return
              }

              const instanceId = `${ride.id}-${dateString}`
              const reservations = allReservations[instanceId] || []
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
              const reservations = allReservations[instanceId] || []
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
        selectedDate:
          state.selectedDate instanceof Date
            ? state.selectedDate.toISOString()
          : state.selectedDate,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          if (state.selectedDate) {
            if (typeof state.selectedDate === "string") {
              state.selectedDate = new Date(state.selectedDate)
            } else if (!(state.selectedDate instanceof Date)) {
              state.selectedDate = new Date()
            }
          }

          if (!state.rides) {
            state.rides = []
          }
        }
      },
    }
  )
)

