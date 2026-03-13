import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { Line, LineFormData, Station } from "@/types"
import { linesApi } from "@/lib/api"
import { toast } from "sonner"
import { useStationsStore } from "./stationsStore"

interface LinesState {
  lines: Line[]
  selectedLine: Line | null
  loading: boolean
  error: string | null
  fetchLines: () => Promise<void>
  createLine: (data: LineFormData) => Promise<void>
  updateLine: (id: string, data: Partial<LineFormData>) => Promise<void>
  deleteLine: (id: string) => Promise<void>
  setSelectedLine: (line: Line | null) => void
  clearError: () => void
}

// Helper function to get station by ID
const getStationById = (id: string): Station | null => {
  const stations = useStationsStore.getState().stations
  return stations.find((s) => s.id === id) || null
}

// Mock data for development
const createMockLine = (
  id: string,
  depStationId: string,
  arrStationId: string,
  intermediateIds: string[] = [],
  directionMode: "single" | "both" = "single",
  direction: "outbound" | "return" = "outbound",
  pairKey?: string
): Line => {
  const depStation = getStationById(depStationId)
  const arrStation = getStationById(arrStationId)

  if (!depStation || !arrStation) {
    throw new Error("Station not found")
  }

  const allStations = [
    { stationId: depStationId, stationName: depStation.name, order: 0 },
    ...intermediateIds.map((sid, idx) => {
      const station = getStationById(sid)
      return {
        stationId: sid,
        stationName: station?.name || "",
        order: idx + 1,
      }
    }),
    {
      stationId: arrStationId,
      stationName: arrStation.name,
      order: intermediateIds.length + 1,
    },
  ]

  return {
    id,
    name: `${depStation.name} - ${arrStation.name}`,
    departureStation: depStation,
    arrivalStation: arrStation,
    intermediateStations: allStations.slice(1, -1).map((s, idx) => ({
      stationId: s.stationId,
      stationName: s.stationName,
      order: idx + 1,
    })),
    directionMode,
    direction,
    pairKey,
    isActive: true,
  }
}

export const useLinesStore = create<LinesState>()(
  persist(
    (set, get) => ({
      lines: [],
      selectedLine: null,
      loading: false,
      error: null,

  fetchLines: async () => {
    set({ loading: true, error: null })
    try {
      // TODO: Replace with actual API call
      // const response = await linesApi.getAll()
      // set({ lines: response.data, loading: false })

      // For now, use mock data only if no lines exist
      const currentLines = get().lines
      if (currentLines.length === 0) {
        const stations = useStationsStore.getState().stations
        if (stations.length >= 2) {
          const mockLines: Line[] = [
            createMockLine(
              "1",
              stations[0].id,
              stations[1].id,
              []
            ),
          ]
          set({ lines: mockLines, loading: false })
        } else {
          set({ lines: [], loading: false })
        }
      } else {
        set({ loading: false })
      }
    } catch (error: any) {
      set({
        loading: false,
        error: error?.message || "Greška pri učitavanju linija",
      })
      toast.error("Greška pri učitavanju linija")
    }
  },

  createLine: async (data: LineFormData) => {
    set({ loading: true, error: null })
    try {
      // TODO: Replace with actual API call
      // const response = await linesApi.create(data as Line)
      // set((state) => ({ lines: [...state.lines, response.data], loading: false }))

      // For now, use mock
      const depStation = getStationById(data.departureStationId)
      const arrStation = getStationById(data.arrivalStationId)

      if (!depStation || !arrStation) {
        throw new Error("Stanica nije pronađena")
      }

      const intermediateStations = (data.intermediateStationIds || []).map(
        (sid, idx) => {
          const station = getStationById(sid)
          return {
            stationId: sid,
            stationName: station?.name || "",
            order: idx + 1,
          }
        }
      )

      const directionMode = data.directionMode || "both"
      const autoName = `${depStation.name} - ${arrStation.name}`

      if (directionMode === "both") {
        const now = Date.now().toString()
        const pairKey = `${depStation.id}-${arrStation.id}-${now}`

        const outboundLine: Line = {
          id: `${now}-outbound`,
          name: autoName,
          departureStation: depStation,
          arrivalStation: arrStation,
          intermediateStations,
          directionMode: "both",
          direction: "outbound",
          pairKey,
          distance: data.distance,
          duration: data.duration,
          basePrice: data.basePrice,
          isActive: data.isActive ?? true,
          createdAt: new Date().toISOString(),
        }

        const reverseIntermediateStations = [...intermediateStations].reverse().map((station, idx) => ({
          ...station,
          order: idx + 1,
        }))

        const returnLine: Line = {
          id: `${now}-return`,
          name: `${arrStation.name} - ${depStation.name}`,
          departureStation: arrStation,
          arrivalStation: depStation,
          intermediateStations: reverseIntermediateStations,
          directionMode: "both",
          direction: "return",
          pairKey,
          distance: data.distance,
          duration: data.duration,
          basePrice: data.basePrice,
          isActive: data.isActive ?? true,
          createdAt: new Date().toISOString(),
        }

        set((state) => ({
          lines: [...state.lines, outboundLine, returnLine],
          loading: false,
        }))
        toast.success("Dvosmerna linija je uspešno kreirana")
      } else {
        const newLine: Line = {
          id: Date.now().toString(),
          name: autoName,
          departureStation: depStation,
          arrivalStation: arrStation,
          intermediateStations,
          directionMode: "single",
          direction: "outbound",
          distance: data.distance,
          duration: data.duration,
          basePrice: data.basePrice,
          isActive: data.isActive ?? true,
          createdAt: new Date().toISOString(),
        }

        set((state) => ({
          lines: [...state.lines, newLine],
          loading: false,
        }))
        toast.success("Linija je uspešno kreirana")
      }
    } catch (error: any) {
      set({
        loading: false,
        error: error?.message || "Greška pri kreiranju linije",
      })
      toast.error(error?.message || "Greška pri kreiranju linije")
      throw error
    }
  },

  updateLine: async (id: string, data: Partial<LineFormData>) => {
    set({ loading: true, error: null })
    try {
      // TODO: Replace with actual API call
      // const response = await linesApi.update(id, data)
      // set((state) => ({
      //   lines: state.lines.map((l) => (l.id === id ? response.data : l)),
      //   loading: false,
      // }))

      // For now, use mock
      const line = get().lines.find((l) => l.id === id)
      if (!line) {
        throw new Error("Linija nije pronađena")
      }

      const updatedLine: Line = {
        ...line,
        ...data,
        updatedAt: new Date().toISOString(),
      }

      // Update stations if changed
      if (data.departureStationId || data.arrivalStationId) {
        const depStation = getStationById(
          data.departureStationId || line.departureStation.id
        )
        const arrStation = getStationById(
          data.arrivalStationId || line.arrivalStation.id
        )

        if (depStation && arrStation) {
          updatedLine.departureStation = depStation
          updatedLine.arrivalStation = arrStation
        }
      }

      if (data.intermediateStationIds) {
        updatedLine.intermediateStations = data.intermediateStationIds.map(
          (sid, idx) => {
            const station = getStationById(sid)
            return {
              stationId: sid,
              stationName: station?.name || "",
              order: idx + 1,
            }
          }
        )
      }

      if (line.directionMode === "both" && line.pairKey) {
        const depStation = updatedLine.departureStation
        const arrStation = updatedLine.arrivalStation
        const outboundName = `${depStation.name} - ${arrStation.name}`
        const returnName = `${arrStation.name} - ${depStation.name}`

        const outboundIntermediateStations = updatedLine.intermediateStations.map((station, idx) => ({
          ...station,
          order: idx + 1,
        }))
        const returnIntermediateStations = [...updatedLine.intermediateStations].reverse().map((station, idx) => ({
          ...station,
          order: idx + 1,
        }))

        set((state) => ({
          lines: state.lines.map((existingLine) => {
            if (existingLine.pairKey !== line.pairKey) {
              return existingLine
            }

            if (existingLine.direction === "return") {
              return {
                ...existingLine,
                name: returnName,
                departureStation: arrStation,
                arrivalStation: depStation,
                intermediateStations: returnIntermediateStations,
                distance: updatedLine.distance,
                duration: updatedLine.duration,
                basePrice: updatedLine.basePrice,
                isActive: updatedLine.isActive,
                updatedAt: new Date().toISOString(),
              }
            }

            return {
              ...existingLine,
              name: outboundName,
              departureStation: depStation,
              arrivalStation: arrStation,
              intermediateStations: outboundIntermediateStations,
              distance: updatedLine.distance,
              duration: updatedLine.duration,
              basePrice: updatedLine.basePrice,
              isActive: updatedLine.isActive,
              updatedAt: new Date().toISOString(),
            }
          }),
          loading: false,
        }))
      } else {
        set((state) => ({
          lines: state.lines.map((l) => (l.id === id ? {
            ...updatedLine,
            name: `${updatedLine.departureStation.name} - ${updatedLine.arrivalStation.name}`,
          } : l)),
          loading: false,
        }))
      }
      toast.success("Linija je uspešno ažurirana")
    } catch (error: any) {
      set({
        loading: false,
        error: error?.message || "Greška pri ažuriranju linije",
      })
      toast.error("Greška pri ažuriranju linije")
      throw error
    }
  },

  deleteLine: async (id: string) => {
    set({ loading: true, error: null })
    try {
      // TODO: Replace with actual API call
      // await linesApi.delete(id)
      // set((state) => ({
      //   lines: state.lines.filter((l) => l.id !== id),
      //   loading: false,
      // }))

      // For now, use mock
      const lineToDelete = get().lines.find((line) => line.id === id)

      set((state) => ({
        lines: lineToDelete?.directionMode === "both" && lineToDelete.pairKey
          ? state.lines.filter((line) => line.pairKey !== lineToDelete.pairKey)
          : state.lines.filter((line) => line.id !== id),
        selectedLine: state.selectedLine?.id === id ? null : state.selectedLine,
        loading: false,
      }))
      toast.success("Linija je uspešno obrisana")
    } catch (error: any) {
      set({
        loading: false,
        error: error?.message || "Greška pri brisanju linije",
      })
      toast.error("Greška pri brisanju linije")
      throw error
    }
  },

  setSelectedLine: (line: Line | null) => {
    set({ selectedLine: line })
  },

  clearError: () => {
    set({ error: null })
  },
    }),
    {
      name: "lines-storage",
      partialize: (state) => ({
        lines: state.lines,
      }),
    }
  )
)

