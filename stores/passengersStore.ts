import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { Passenger, PassengerFormData, Reservation } from "@/types"
import { passengersApi } from "@/lib/api"
import { toast } from "sonner"

interface PassengersState {
  passengers: Passenger[]
  searchResults: Passenger[]
  selectedPassenger: Passenger | null
  loading: boolean
  error: string | null
  searchPassengers: (query: string) => Promise<void>
  createPassenger: (data: PassengerFormData) => Promise<Passenger>
  updatePassenger: (id: string, data: Partial<PassengerFormData>) => Promise<void>
  deletePassenger: (id: string) => Promise<void>
  fetchPassengerHistory: (id: string) => Promise<Reservation[]>
  setSelectedPassenger: (passenger: Passenger | null) => void
  clearError: () => void
  clearSearch: () => void
}

// Mock data for development
const mockPassengers: Passenger[] = [
  {
    id: "1",
    firstName: "Marko",
    lastName: "Marković",
    phone: "+381 64 123 4567",
    email: "marko@example.com",
    passengerType: "odrasli",
  },
  {
    id: "2",
    firstName: "Jovan",
    lastName: "Jovanović",
    phone: "+381 65 234 5678",
    email: "jovan@example.com",
    passengerType: "odrasli",
  },
  {
    id: "3",
    firstName: "Ana",
    lastName: "Anić",
    phone: "+381 63 345 6789",
    passengerType: "odrasli",
  },
]

export const usePassengersStore = create<PassengersState>()(
  persist(
    (set, get) => ({
      passengers: mockPassengers,
      searchResults: [],
      selectedPassenger: null,
      loading: false,
      error: null,

  searchPassengers: async (query: string) => {
    set({ loading: true, error: null })
    try {
      // TODO: Replace with actual API call
      // const response = await passengersApi.search(query)
      // set({ searchResults: response.data, loading: false })

      // Get all passengers from store (including newly created ones)
      const allPassengers = get().passengers
      
      // If query is empty or less than 1 character, show all passengers (limited to last 50)
      if (!query || query.trim().length < 1) {
        // Show all passengers, but limit to last 50 for performance
        const recentPassengers = allPassengers.slice(-50).reverse() // Most recent first
        set({ searchResults: recentPassengers, loading: false })
        return
      }

      // Filter passengers by query
      const queryLower = query.toLowerCase().trim()
      const results = allPassengers.filter(
        (p) =>
          p.firstName.toLowerCase().includes(queryLower) ||
          p.lastName.toLowerCase().includes(queryLower) ||
          p.phone.includes(query) ||
          p.email?.toLowerCase().includes(queryLower)
      )
      set({ searchResults: results, loading: false })
    } catch (error: any) {
      set({
        loading: false,
        error: error?.message || "Greška pri pretrazi putnika",
      })
      toast.error("Greška pri pretrazi putnika")
    }
  },

  createPassenger: async (data: PassengerFormData) => {
    set({ loading: true, error: null })
    try {
      // TODO: Replace with actual API call
      // const response = await passengersApi.create(data)
      // set((state) => ({
      //   passengers: [...state.passengers, response.data],
      //   loading: false,
      // }))

      // For now, use mock
      const newPassenger: Passenger = {
        ...data,
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
      }
      set((state) => ({
        passengers: [...state.passengers, newPassenger],
        loading: false,
      }))
      toast.success("Putnik je uspešno kreiran")
      return newPassenger as Passenger
    } catch (error: any) {
      set({
        loading: false,
        error: error?.message || "Greška pri kreiranju putnika",
      })
      toast.error("Greška pri kreiranju putnika")
      throw error
    }
  },

  updatePassenger: async (id: string, data: Partial<PassengerFormData>) => {
    set({ loading: true, error: null })
    try {
      // TODO: Replace with actual API call
      // const response = await passengersApi.update(id, data)
      // set((state) => ({
      //   passengers: state.passengers.map((p) => (p.id === id ? response.data : p)),
      //   loading: false,
      // }))

      // For now, use mock
      set((state) => ({
        passengers: state.passengers.map((p) =>
          p.id === id
            ? { ...p, ...data, updatedAt: new Date().toISOString() }
            : p
        ),
        loading: false,
      }))
      toast.success("Putnik je uspešno ažuriran")
    } catch (error: any) {
      set({
        loading: false,
        error: error?.message || "Greška pri ažuriranju putnika",
      })
      toast.error("Greška pri ažuriranju putnika")
      throw error
    }
  },

  deletePassenger: async (id: string) => {
    set({ loading: true, error: null })
    try {
      // TODO: Replace with actual API call
      // await passengersApi.delete(id)

      // For now, use mock
      set((state) => ({
        passengers: state.passengers.filter((p) => p.id !== id),
        searchResults: state.searchResults.filter((p) => p.id !== id),
        loading: false,
      }))
      toast.success("Putnik je uspešno obrisan")
    } catch (error: any) {
      set({
        loading: false,
        error: error?.message || "Greška pri brisanju putnika",
      })
      toast.error("Greška pri brisanju putnika")
      throw error
    }
  },

  fetchPassengerHistory: async (id: string): Promise<Reservation[]> => {
    set({ loading: true, error: null })
    try {
      // TODO: Replace with actual API call
      // const response = await passengersApi.getHistory(id)
      // set({ loading: false })
      // return response.data

      // For now, return empty array
      set({ loading: false })
      return []
    } catch (error: any) {
      set({
        loading: false,
        error: error?.message || "Greška pri učitavanju istorije putnika",
      })
      toast.error("Greška pri učitavanju istorije putnika")
      return []
    }
  },

  setSelectedPassenger: (passenger: Passenger | null) => {
    set({ selectedPassenger: passenger })
  },

  clearError: () => {
    set({ error: null })
  },

  clearSearch: () => {
    set({ searchResults: [] })
  },
    }),
    {
      name: "passengers-storage",
      partialize: (state) => ({
        passengers: state.passengers,
      }),
      // Initialize with mock data only if no passengers exist in storage
      onRehydrateStorage: () => (state) => {
        if (state && (!state.passengers || state.passengers.length === 0)) {
          state.passengers = mockPassengers
        }
      },
    }
  )
)

