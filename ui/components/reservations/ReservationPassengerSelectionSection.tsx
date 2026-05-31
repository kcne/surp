import type { Passenger, ReservationFormData } from "@/types"
import type { Control } from "react-hook-form"
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form"
import { PassengerSearch } from "@/components/reservations/PassengerSearch"

interface ReservationPassengerSelectionSectionProps {
  control: Control<ReservationFormData>
  selectedPassenger: Passenger | null
  onSelectPassenger: (passenger: Passenger | null) => void
  onAddNewPassenger: () => void
}

export function ReservationPassengerSelectionSection({
  control,
  selectedPassenger,
  onSelectPassenger,
  onAddNewPassenger,
}: ReservationPassengerSelectionSectionProps) {
  return (
    <FormField
      control={control}
      name="passengerId"
      render={({ field }) => (
        <FormItem>
          <FormControl>
            <PassengerSearch
              value={selectedPassenger}
              onSelect={(passenger) => {
                onSelectPassenger(passenger)
                field.onChange(passenger?.id || "")
              }}
              onAddNew={onAddNewPassenger}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
