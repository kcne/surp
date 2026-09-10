import type { ReservationFormData } from "@/types"
import type { Control } from "react-hook-form"
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface StationOption {
  id: string
  name: string
  /** Passengers may board here. */
  isBoarding: boolean
  /** Passengers may get off here. */
  isDropoff: boolean
}

interface ReservationStationsSectionProps {
  control: Control<ReservationFormData>
  allStations: StationOption[]
  departureStationId?: string
  arrivalStationId?: string
}

export function ReservationStationsSection({
  control,
  allStations,
  departureStationId,
  arrivalStationId,
}: ReservationStationsSectionProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <FormField
        control={control}
        name="departureStationId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Polazna Stanica *</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Izaberite polaznu stanicu" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {allStations
                  .filter(
                    (station) => station.isBoarding && station.id !== arrivalStationId
                  )
                  .map((station) => (
                    <SelectItem key={station.id} value={station.id}>
                      {station.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="arrivalStationId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Dolazna Stanica *</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Izaberite dolaznu stanicu" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {allStations
                  .filter(
                    (station) => station.isDropoff && station.id !== departureStationId
                  )
                  .map((station) => {
                    const depStation = allStations.find((entry) => entry.id === departureStationId)
                    const depIndex = depStation
                      ? allStations.findIndex((entry) => entry.id === depStation.id)
                      : -1
                    const currentIndex = allStations.findIndex((entry) => entry.id === station.id)

                    return (
                      <SelectItem
                        key={station.id}
                        value={station.id}
                        disabled={depIndex >= 0 && currentIndex <= depIndex}
                      >
                        {station.name}
                      </SelectItem>
                    )
                  })}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )
}
