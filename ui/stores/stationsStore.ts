import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { Station, StationFormData } from "@/types"
import { stationsApi } from "@/lib/api"
import { toast } from "sonner"

interface StationsState {
  stations: Station[]
  selectedStation: Station | null
  loading: boolean
  error: string | null
  fetchStations: () => Promise<void>
  createStation: (data: StationFormData) => Promise<void>
  updateStation: (id: string, data: Partial<StationFormData>) => Promise<void>
  deleteStation: (id: string) => Promise<void>
  setSelectedStation: (station: Station | null) => void
  clearError: () => void
}

// Mock data for development
const mockStations: Station[] = [
  {
    id: "1",
    name: "Autobuska Stanica Beograd",
    address: "Železnička 4, Beograd",
    category: "Glavna",
    notes: "Glavna autobuska stanica u Beogradu",
  },
  {
    id: "2",
    name: "Autobuska Stanica Novi Sad",
    address: "Bulevar Oslobođenja 10, Novi Sad",
    category: "Glavna",
    notes: "Glavna autobuska stanica u Novom Sadu",
  },
  {
    id: "3",
    name: "Autobuska Stanica Niš",
    address: "Bulevar Nemanjića 2, Niš",
    category: "Glavna",
  },
]

export const useStationsStore = create<StationsState>()(
  persist(
    (set, get) => ({
      stations: mockStations,
      selectedStation: null,
      loading: false,
      error: null,

  fetchStations: async () => {
    set({ loading: true, error: null })
    try {
      // TODO: Replace with actual API call
      // const response = await stationsApi.getAll()
      // set({ stations: response.data, loading: false })
      
      // For now, use mock data only if no stations exist
      const currentStations = get().stations
      if (currentStations.length === 0) {
        set({ stations: mockStations, loading: false })
      } else {
        set({ loading: false })
      }
    } catch (error: any) {
      set({
        loading: false,
        error: error?.message || "Greška pri učitavanju stanica",
      })
      toast.error("Greška pri učitavanju stanica")
    }
  },

  createStation: async (data: StationFormData) => {
    set({ loading: true, error: null })
    try {
      // TODO: Replace with actual API call
      // const response = await stationsApi.create(data as Station)
      // set((state) => ({ stations: [...state.stations, response.data], loading: false }))
      
      // For now, use mock
      const newStation: Station = {
        ...data,
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
      }
      set((state) => ({
        stations: [...state.stations, newStation],
        loading: false,
      }))
      toast.success("Stanica je uspešno kreirana")
    } catch (error: any) {
      set({
        loading: false,
        error: error?.message || "Greška pri kreiranju stanice",
      })
      toast.error("Greška pri kreiranju stanice")
      throw error
    }
  },

  updateStation: async (id: string, data: Partial<StationFormData>) => {
    set({ loading: true, error: null })
    try {
      // TODO: Replace with actual API call
      // const response = await stationsApi.update(id, data)
      // set((state) => ({
      //   stations: state.stations.map((s) => (s.id === id ? response.data : s)),
      //   loading: false,
      // }))
      
      // For now, use mock
      set((state) => ({
        stations: state.stations.map((s) =>
          s.id === id
            ? { ...s, ...data, updatedAt: new Date().toISOString() }
            : s
        ),
        loading: false,
      }))
      toast.success("Stanica je uspešno ažurirana")
    } catch (error: any) {
      set({
        loading: false,
        error: error?.message || "Greška pri ažuriranju stanice",
      })
      toast.error("Greška pri ažuriranju stanice")
      throw error
    }
  },

  deleteStation: async (id: string) => {
    set({ loading: true, error: null })
    try {
      // TODO: Replace with actual API call
      // await stationsApi.delete(id)
      // set((state) => ({
      //   stations: state.stations.filter((s) => s.id !== id),
      //   loading: false,
      // }))
      
      // For now, use mock
      set((state) => ({
        stations: state.stations.filter((s) => s.id !== id),
        selectedStation: state.selectedStation?.id === id ? null : state.selectedStation,
        loading: false,
      }))
      toast.success("Stanica je uspešno obrisana")
    } catch (error: any) {
      set({
        loading: false,
        error: error?.message || "Greška pri brisanju stanice",
      })
      toast.error("Greška pri brisanju stanice")
      throw error
    }
  },

  setSelectedStation: (station: Station | null) => {
    set({ selectedStation: station })
  },

  clearError: () => {
    set({ error: null })
  },
    }),
    {
      name: "stations-storage",
      partialize: (state) => ({
        stations: state.stations,
      }),
      // Initialize with mock data only if no stations exist in storage
      onRehydrateStorage: () => (state) => {
        if (state && (!state.stations || state.stations.length === 0)) {
          state.stations = mockStations
        }
      },
    }
  )
)

