import { create } from "zustand"
import { persist } from "zustand/middleware"
import type {
  Reservation,
  ReservationFormData,
  RideInstance,
  SeatMapData,
  SeatInfo,
  Station,
  Passenger,
} from "@/types"
import { reservationsApi } from "@/lib/api"
import { stationsControllerList } from "@/infrastructure/generated/surp-api"
import type { StationResponseDto } from "@/infrastructure/generated/model"
import { toast } from "sonner"
import { buildSeatMap, checkSeatConflict } from "@/utils/seatHelpers"
import { usePassengersStore } from "./passengersStore"
import { useRidesStore } from "./ridesStore"

interface ReservationsState {
  allReservations: Record<string, Reservation[]> // Key: rideInstanceId, Value: reservations for that ride
  reservations: Reservation[] // Current ride's reservations (derived from allReservations)
  seatMap: SeatMapData | null
  selectedSeat: number | null
  selectedSeats: number[]
  selectedRideInstance: RideInstance | null
  loading: boolean
  error: string | null
  fetchReservations: (rideInstanceId: string) => Promise<void>
  createReservation: (data: ReservationFormData) => Promise<void>
  createReservationsBatch: (data: ReservationFormData[]) => Promise<void>
  createReservationsForRideInstance: (
    rideInstance: RideInstance,
    data: ReservationFormData[],
    options?: { showSuccessToast?: boolean }
  ) => Promise<void>
  updateReservation: (id: string, data: Partial<ReservationFormData>) => Promise<void>
  cancelReservation: (id: string) => Promise<void>
  setSelectedSeat: (seat: number | null) => void
  setSelectedSeats: (seats: number[]) => void
  toggleSelectedSeat: (seat: number) => void
  clearSelectedSeats: () => void
  setSelectedRideInstance: (rideInstance: RideInstance | null) => void
  clearError: () => void
}

const getLineStationsForRideInstance = (rideInstance: RideInstance) => {
  const lineStations = rideInstance.ride.line.intermediateStations.map((s) => ({
    stationId: s.stationId,
    order: s.order,
  }))

  return [
    {
      stationId: rideInstance.ride.line.departureStation.id,
      order: 0,
    },
    ...lineStations,
    {
      stationId: rideInstance.ride.line.arrivalStation.id,
      order: lineStations.length + 1,
    },
  ]
}

const toStationCategory = (category: StationResponseDto["category"]): Station["category"] => {
  if (category === "BUS_STATION") {
    return "Autobuska stanica"
  }

  if (category === "BUS_STOP") {
    return "Stajalište"
  }

  return undefined
}

const toStation = (station: StationResponseDto): Station => {
  return {
    id: station.id,
    name: station.name,
    address: station.address,
    category: toStationCategory(station.category),
    contactPhone: typeof station.contactPhone === "string" ? station.contactPhone : undefined,
    notes: typeof station.notes === "string" ? station.notes : undefined,
    createdAt: station.createdAt,
    updatedAt: station.updatedAt,
  }
}

const fetchStations = async (): Promise<Station[]> => {
  const response = await stationsControllerList()

  if (response.status !== 200) {
    throw new Error("Greška pri učitavanju stanica")
  }

  return response.data.items.map(toStation)
}

export const useReservationsStore = create<ReservationsState>()(
  persist(
    (set, get) => ({
      allReservations: {}, // Global storage for all reservations by rideInstanceId
      reservations: [], // Current ride's reservations
      seatMap: null,
      selectedSeat: null,
      selectedSeats: [],
      selectedRideInstance: null,
      loading: false,
      error: null,

  fetchReservations: async (rideInstanceId: string) => {
    set({ loading: true, error: null })
    try {
      // TODO: Replace with actual API call
      // const response = await reservationsApi.getAll(rideInstanceId)
      // const reservations = response.data
      // const capacity = 40
      // const seatMap = buildSeatMap(reservations, capacity)
      // set({ reservations, seatMap, loading: false })

      // Load reservations from global storage for this ride instance
      const allReservations = get().allReservations
      const reservations = allReservations[rideInstanceId] || []
  const capacity = 40
      const seatMap = buildSeatMap(reservations, capacity, get().selectedSeats)
      set({ reservations, seatMap, loading: false })
    } catch (error: any) {
      set({
        loading: false,
        error: error?.message || "Greška pri učitavanju rezervacija",
      })
      toast.error("Greška pri učitavanju rezervacija")
    }
  },

  createReservation: async (data: ReservationFormData) => {
    set({ loading: true, error: null })
    try {
      // Check for seat conflict
      const rideInstance = get().selectedRideInstance
      if (!rideInstance) {
        throw new Error("Vožnja nije izabrana")
      }

      const reservations = get().reservations
      const lineStations = rideInstance.ride.line.intermediateStations.map((s) => ({
        stationId: s.stationId,
        order: s.order,
      }))
      const allStations = [
        {
          stationId: rideInstance.ride.line.departureStation.id,
          order: 0,
        },
        ...lineStations,
        {
          stationId: rideInstance.ride.line.arrivalStation.id,
          order: lineStations.length + 1,
        },
      ]

      const hasConflict = checkSeatConflict(
        reservations,
        data.seatNumber,
        data.departureStationId,
        data.arrivalStationId,
        allStations
      )

      if (hasConflict) {
        throw new Error(
          "Sedište je već rezervisano za ovaj segment rute. Molimo izaberite drugo sedište."
        )
      }

      // TODO: Replace with actual API call
      // const response = await reservationsApi.create(data)
      // const newReservation = response.data
      // set((state) => ({
      //   reservations: [...state.reservations, newReservation],
      //   loading: false,
      // }))

      // For now, use mock
      // Get passenger and stations from their respective stores
      const passengers = usePassengersStore.getState().passengers
      const stations = await fetchStations()

      const passenger = passengers.find((p) => p.id === data.passengerId)
      const departureStation = stations.find(
        (station) => station.id === data.departureStationId
      )
      const arrivalStation = stations.find(
        (station) => station.id === data.arrivalStationId
      )

      if (!passenger) {
        throw new Error("Putnik nije pronađen")
      }
      if (!departureStation) {
        throw new Error("Polazna stanica nije pronađena")
      }
      if (!arrivalStation) {
        throw new Error("Dolazna stanica nije pronađena")
      }

      const newReservation: Reservation = {
        id: Date.now().toString(),
        ...data,
        rideInstance,
        passenger,
        departureStation,
        arrivalStation,
        status: "active",
        createdAt: new Date().toISOString(),
      }

      // Update global reservations storage
      const allReservations = get().allReservations
      const rideInstanceId = rideInstance.id
      const currentReservations = allReservations[rideInstanceId] || []
      const updatedReservations = [...currentReservations, newReservation]
      
  const capacity = 40
       const seatMap = buildSeatMap(updatedReservations, capacity, get().selectedSeats)

      set({
        allReservations: {
          ...allReservations,
          [rideInstanceId]: updatedReservations,
        },
        reservations: updatedReservations,
        seatMap,
        selectedSeat: null,
        loading: false,
      })
      
      // Refresh ride instances to update seat counts
      const selectedDate = useRidesStore.getState().selectedDate
      if (selectedDate) {
        useRidesStore.getState().fetchRideInstances(selectedDate)
      }
      
      toast.success("Rezervacija je uspešno kreirana")
    } catch (error: any) {
      set({
        loading: false,
        error: error?.message || "Greška pri kreiranju rezervacije",
      })
      toast.error(error?.message || "Greška pri kreiranju rezervacije")
      throw error
    }
  },

  createReservationsBatch: async (data: ReservationFormData[]) => {
    set({ loading: true, error: null })
    try {
      const rideInstance = get().selectedRideInstance
      if (!rideInstance) {
        throw new Error("Vožnja nije izabrana")
      }

      if (data.length === 0) {
        throw new Error("Nema izabranih sedišta")
      }

      const reservations = get().reservations
      const lineStations = rideInstance.ride.line.intermediateStations.map((s) => ({
        stationId: s.stationId,
        order: s.order,
      }))
      const allStations = [
        {
          stationId: rideInstance.ride.line.departureStation.id,
          order: 0,
        },
        ...lineStations,
        {
          stationId: rideInstance.ride.line.arrivalStation.id,
          order: lineStations.length + 1,
        },
      ]

      const seatNumbers = new Set<number>()
      for (const reservationData of data) {
        if (seatNumbers.has(reservationData.seatNumber)) {
          throw new Error("Sedišta moraju biti jedinstvena")
        }
        seatNumbers.add(reservationData.seatNumber)

        const hasConflict = checkSeatConflict(
          reservations,
          reservationData.seatNumber,
          reservationData.departureStationId,
          reservationData.arrivalStationId,
          allStations
        )

        if (hasConflict) {
          throw new Error(
            `Sedište ${reservationData.seatNumber} je već rezervisano za ovaj segment rute.`
          )
        }
      }

      const passengers = usePassengersStore.getState().passengers

      const newReservations: Reservation[] = data.map((reservationData) => {
        const passenger = passengers.find((p) => p.id === reservationData.passengerId)
        const departureStop = allStations.find(
          (stop) => stop.stationId === reservationData.departureStationId
        )
        const arrivalStop = allStations.find(
          (stop) => stop.stationId === reservationData.arrivalStationId
        )

        if (!passenger) {
          throw new Error("Putnik nije pronađen")
        }
      if (!departureStop) {
        throw new Error("Polazna stanica nije pronađena")
      }
      if (!arrivalStop) {
        throw new Error("Dolazna stanica nije pronađena")
      }

        const departureStation = {
          id: departureStop.stationId,
          name:
            departureStop.stationId === rideInstance.ride.line.departureStation.id
              ? rideInstance.ride.line.departureStation.name
              : rideInstance.ride.line.intermediateStations.find(
                  (s) => s.stationId === departureStop.stationId
                )?.stationName || "",
          address: "",
        }
        const arrivalStation = {
          id: arrivalStop.stationId,
          name:
            arrivalStop.stationId === rideInstance.ride.line.arrivalStation.id
              ? rideInstance.ride.line.arrivalStation.name
              : rideInstance.ride.line.intermediateStations.find(
                  (s) => s.stationId === arrivalStop.stationId
                )?.stationName || "",
          address: "",
        }

        return {
          id: `${Date.now()}-${reservationData.seatNumber}`,
          ...reservationData,
          rideInstance,
          passenger,
          departureStation,
          arrivalStation,
          status: "active",
          createdAt: new Date().toISOString(),
        }
      })

      const allReservations = get().allReservations
      const rideInstanceId = rideInstance.id
      const currentReservations = allReservations[rideInstanceId] || []
      const updatedReservations = [...currentReservations, ...newReservations]
  const capacity = 40
      const seatMap = buildSeatMap(updatedReservations, capacity, [])

      set({
        allReservations: {
          ...allReservations,
          [rideInstanceId]: updatedReservations,
        },
        reservations: updatedReservations,
        seatMap,
        selectedSeats: [],
        selectedSeat: null,
        loading: false,
      })

      const selectedDate = useRidesStore.getState().selectedDate
      if (selectedDate) {
        useRidesStore.getState().fetchRideInstances(selectedDate)
      }

      toast.success("Rezervacije su uspešno kreirane")
    } catch (error: any) {
      set({
        loading: false,
        error: error?.message || "Greška pri kreiranju rezervacija",
      })
      toast.error(error?.message || "Greška pri kreiranju rezervacija")
      throw error
    }
  },

  createReservationsForRideInstance: async (
    rideInstance: RideInstance,
    data: ReservationFormData[],
    options?: { showSuccessToast?: boolean }
  ) => {
    set({ loading: true, error: null })
    try {
      if (data.length === 0) {
        throw new Error("Nema izabranih sedišta")
      }

      const allReservations = get().allReservations
      const existingReservations = allReservations[rideInstance.id] || []
      const allStations = getLineStationsForRideInstance(rideInstance)

      const seatNumbers = new Set<number>()
      const pendingReservations: Reservation[] = []

      for (const reservationData of data) {
        if (seatNumbers.has(reservationData.seatNumber)) {
          throw new Error("Sedišta moraju biti jedinstvena")
        }
        seatNumbers.add(reservationData.seatNumber)

        const hasConflict = checkSeatConflict(
          [...existingReservations, ...pendingReservations],
          reservationData.seatNumber,
          reservationData.departureStationId,
          reservationData.arrivalStationId,
          allStations
        )

        if (hasConflict) {
          throw new Error(
            `Sedište ${reservationData.seatNumber} je već rezervisano za ovaj segment rute.`
          )
        }

        pendingReservations.push({
          id: `pending-${reservationData.seatNumber}`,
          rideInstanceId: rideInstance.id,
          rideInstance,
          passengerId: reservationData.passengerId,
          passenger: {
            id: "",
            firstName: "",
            lastName: "",
            phone: "",
            passengerType: "odrasli",
          },
          seatNumber: reservationData.seatNumber,
          departureStationId: reservationData.departureStationId,
          departureStation: { id: "", name: "", address: "" },
          arrivalStationId: reservationData.arrivalStationId,
          arrivalStation: { id: "", name: "", address: "" },
          status: "active",
        })
      }

      const passengers = usePassengersStore.getState().passengers

      const newReservations: Reservation[] = data.map((reservationData) => {
        const passenger = passengers.find((p) => p.id === reservationData.passengerId)
        if (!passenger) {
          throw new Error("Putnik nije pronađen")
        }

        const departureIsStart =
          reservationData.departureStationId === rideInstance.ride.line.departureStation.id
        const departureIsEnd =
          reservationData.departureStationId === rideInstance.ride.line.arrivalStation.id
        const departureIntermediate = rideInstance.ride.line.intermediateStations.find(
          (s) => s.stationId === reservationData.departureStationId
        )

        const arrivalIsStart =
          reservationData.arrivalStationId === rideInstance.ride.line.departureStation.id
        const arrivalIsEnd =
          reservationData.arrivalStationId === rideInstance.ride.line.arrivalStation.id
        const arrivalIntermediate = rideInstance.ride.line.intermediateStations.find(
          (s) => s.stationId === reservationData.arrivalStationId
        )

        const departureStation = departureIsStart
          ? rideInstance.ride.line.departureStation
          : departureIsEnd
          ? rideInstance.ride.line.arrivalStation
          : departureIntermediate
          ? {
              id: departureIntermediate.stationId,
              name: departureIntermediate.stationName,
              address: "",
            }
          : null

        const arrivalStation = arrivalIsStart
          ? rideInstance.ride.line.departureStation
          : arrivalIsEnd
          ? rideInstance.ride.line.arrivalStation
          : arrivalIntermediate
          ? {
              id: arrivalIntermediate.stationId,
              name: arrivalIntermediate.stationName,
              address: "",
            }
          : null

        if (!departureStation) {
          throw new Error("Polazna stanica nije pronađena")
        }

        if (!arrivalStation) {
          throw new Error("Dolazna stanica nije pronađena")
        }

        return {
          id: `${Date.now()}-${reservationData.seatNumber}-${Math.random().toString(36).slice(2, 7)}`,
          ...reservationData,
          rideInstanceId: rideInstance.id,
          rideInstance,
          passenger,
          departureStation,
          arrivalStation,
          status: "active",
          createdAt: new Date().toISOString(),
        }
      })

      const updatedReservations = [...existingReservations, ...newReservations]
      const selectedRideInstance = get().selectedRideInstance
      const currentCapacity = selectedRideInstance?.ride.busCapacity || rideInstance.ride.busCapacity

      set((state) => ({
        allReservations: {
          ...state.allReservations,
          [rideInstance.id]: updatedReservations,
        },
        reservations:
          selectedRideInstance?.id === rideInstance.id ? updatedReservations : state.reservations,
        seatMap:
          selectedRideInstance?.id === rideInstance.id
            ? buildSeatMap(updatedReservations, currentCapacity, get().selectedSeats)
            : state.seatMap,
        loading: false,
      }))

      const selectedDate = useRidesStore.getState().selectedDate
      if (selectedDate) {
        useRidesStore.getState().fetchRideInstances(selectedDate)
      }

      if (options?.showSuccessToast !== false) {
        toast.success("Rezervacije su uspešno kreirane")
      }
    } catch (error: any) {
      set({
        loading: false,
        error: error?.message || "Greška pri kreiranju rezervacija",
      })
      toast.error(error?.message || "Greška pri kreiranju rezervacija")
      throw error
    }
  },

  updateReservation: async (id: string, data: Partial<ReservationFormData>) => {
    set({ loading: true, error: null })
    try {
      // TODO: Replace with actual API call
      // const response = await reservationsApi.update(id, data)
      // set((state) => ({
      //   reservations: state.reservations.map((r) =>
      //     r.id === id ? response.data : r
      //   ),
      //   loading: false,
      // }))

      // For now, use mock
      const rideInstance = get().selectedRideInstance
      if (!rideInstance) {
        throw new Error("Vožnja nije izabrana")
      }

      // Get passenger data for updates
      const passengers = usePassengersStore.getState().passengers

      const rideInstanceId = rideInstance.id
      set((state) => {
        const updatedReservations = state.reservations.map((r) => {
          if (r.id === id) {
            // Update reservation with new data
            const updated = { ...r, ...data, updatedAt: new Date().toISOString() }
            
            // If passenger is being updated, get the full passenger object
            if (data.passengerId && data.passengerId !== r.passengerId) {
              const passenger = passengers.find((p) => p.id === data.passengerId)
              if (passenger) {
                updated.passenger = passenger
              }
            }
            
             // If departure station is being updated, map from line stations
             if (data.departureStationId && data.departureStationId !== r.departureStationId) {
               const isDeparture =
                 data.departureStationId === rideInstance.ride.line.departureStation.id
               const isArrival =
                 data.departureStationId === rideInstance.ride.line.arrivalStation.id
               const intermediate = rideInstance.ride.line.intermediateStations.find(
                 (s) => s.stationId === data.departureStationId
               )
               if (isDeparture) {
                 updated.departureStation = rideInstance.ride.line.departureStation
               } else if (isArrival) {
                 updated.departureStation = rideInstance.ride.line.arrivalStation
               } else if (intermediate) {
                 updated.departureStation = {
                   id: intermediate.stationId,
                   name: intermediate.stationName,
                   address: "",
                 }
               }
             }
            
             // If arrival station is being updated, map from line stations
             if (data.arrivalStationId && data.arrivalStationId !== r.arrivalStationId) {
               const isDeparture =
                 data.arrivalStationId === rideInstance.ride.line.departureStation.id
               const isArrival =
                 data.arrivalStationId === rideInstance.ride.line.arrivalStation.id
               const intermediate = rideInstance.ride.line.intermediateStations.find(
                 (s) => s.stationId === data.arrivalStationId
               )
               if (isDeparture) {
                 updated.arrivalStation = rideInstance.ride.line.departureStation
               } else if (isArrival) {
                 updated.arrivalStation = rideInstance.ride.line.arrivalStation
               } else if (intermediate) {
                 updated.arrivalStation = {
                   id: intermediate.stationId,
                   name: intermediate.stationName,
                   address: "",
                 }
               }
             }
            
            return updated
          }
          return r
        })
        const capacity = 40
        const seatMap = buildSeatMap(updatedReservations, capacity, get().selectedSeats)

        return {
          allReservations: {
            ...state.allReservations,
            [rideInstanceId]: updatedReservations,
          },
          reservations: updatedReservations,
          seatMap,
          loading: false,
        }
      })
      
      // Refresh ride instances to update seat counts
      const selectedDate = useRidesStore.getState().selectedDate
      if (selectedDate) {
        useRidesStore.getState().fetchRideInstances(selectedDate)
      }
      
      toast.success("Rezervacija je uspešno ažurirana")
    } catch (error: any) {
      set({
        loading: false,
        error: error?.message || "Greška pri ažuriranju rezervacije",
      })
      toast.error("Greška pri ažuriranju rezervacije")
      throw error
    }
  },

  cancelReservation: async (id: string) => {
    set({ loading: true, error: null })
    try {
      // TODO: Replace with actual API call
      // await reservationsApi.cancel(id)
      // set((state) => ({
      //   reservations: state.reservations.map((r) =>
      //     r.id === id ? { ...r, status: "cancelled" } : r
      //   ),
      //   loading: false,
      // }))

      // For now, use mock
      const rideInstance = get().selectedRideInstance
      if (!rideInstance) {
        throw new Error("Vožnja nije izabrana")
      }

      const rideInstanceId = rideInstance.id
      set((state) => {
        const updatedReservations = state.reservations.map((r) =>
          r.id === id
            ? { ...r, status: "cancelled" as const, updatedAt: new Date().toISOString() }
            : r
        )
  const capacity = 40
        const seatMap = buildSeatMap(updatedReservations, capacity, get().selectedSeats)

        return {
          allReservations: {
            ...state.allReservations,
            [rideInstanceId]: updatedReservations,
          },
          reservations: updatedReservations,
          seatMap,
          loading: false,
        }
      })
      
      // Refresh ride instances to update seat counts
      const selectedDate = useRidesStore.getState().selectedDate
      if (selectedDate) {
        useRidesStore.getState().fetchRideInstances(selectedDate)
      }
      
      toast.success("Rezervacija je uspešno otkazana")
    } catch (error: any) {
      set({
        loading: false,
        error: error?.message || "Greška pri otkazivanju rezervacije",
      })
      toast.error("Greška pri otkazivanju rezervacije")
      throw error
    }
  },

  setSelectedSeat: (seat: number | null) => {
    set({ selectedSeat: seat })
  },

  setSelectedSeats: (seats: number[]) => {
  const capacity = 40
    const seatMap = buildSeatMap(get().reservations, capacity, seats)
    set({ selectedSeats: seats, seatMap })
  },

  toggleSelectedSeat: (seat: number) => {
    set((state) => {
      const nextSeats = state.selectedSeats.includes(seat)
        ? state.selectedSeats.filter((s) => s !== seat)
        : [...state.selectedSeats, seat]
  const capacity = 40
      const seatMap = buildSeatMap(state.reservations, capacity, nextSeats)
      return { selectedSeats: nextSeats, seatMap }
    })
  },

  clearSelectedSeats: () => {
  const capacity = 40
    const seatMap = buildSeatMap(get().reservations, capacity, [])
    set({ selectedSeats: [], seatMap })
  },

  setSelectedRideInstance: (rideInstance: RideInstance | null) => {
    set({ selectedRideInstance: rideInstance })
    if (rideInstance) {
      // Fetch reservations for this ride instance (loads from localStorage)
      get().fetchReservations(rideInstance.id)
    } else {
      set({ reservations: [], seatMap: null, selectedSeat: null, selectedSeats: [] })
    }
  },

  clearError: () => {
    set({ error: null })
  },
    }),
    {
      name: "reservations-storage",
      partialize: (state) => ({
        allReservations: state.allReservations, // Persist all reservations globally
      }),
    }
  )
)
