import type { Passenger, ReservationFormData } from "@/types"
import type { Control } from "react-hook-form"
import { Button } from "@/components/ui/button"
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { PassengerSearch } from "@/components/reservations/PassengerSearch"
import { UserPlus } from "lucide-react"

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
          <div className="flex items-center justify-between">
            <FormLabel>Putnik *</FormLabel>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onAddNewPassenger}
              className="text-primary"
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Dodaj Novog Putnika
            </Button>
          </div>
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
