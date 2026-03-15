import { format } from "date-fns"
import { srLatn } from "date-fns/locale"
import type { RideInstance } from "@/types"
import { formatDateDisplay, formatTimeDisplay } from "@/utils/dateHelpers"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CalendarDays } from "lucide-react"

interface ReservationReturnTicketSectionProps {
  isReturnTicket: boolean
  onReturnTicketChange: (checked: boolean) => void
  returnRideInstancesCount: number
  returnDatePickerOpen: boolean
  onReturnDatePickerOpenChange: (open: boolean) => void
  selectedReturnDate?: Date
  onSelectReturnDate: (date?: Date) => void
  availableReturnDateKeys: Set<string>
  selectedReturnRideInstanceId: string
  onSelectReturnRideInstance: (id: string) => void
  returnInstancesForSelectedDate: RideInstance[]
  selectedReturnRideInstance: RideInstance | null
  selectedArrivalStationName: string
  selectedDepartureStationName: string
  returnSeatPreviewNumbers: number[]
  hasExistingReturnReservation: boolean
}

export function ReservationReturnTicketSection({
  isReturnTicket,
  onReturnTicketChange,
  returnRideInstancesCount,
  returnDatePickerOpen,
  onReturnDatePickerOpenChange,
  selectedReturnDate,
  onSelectReturnDate,
  availableReturnDateKeys,
  selectedReturnRideInstanceId,
  onSelectReturnRideInstance,
  returnInstancesForSelectedDate,
  selectedReturnRideInstance,
  selectedArrivalStationName,
  selectedDepartureStationName,
  returnSeatPreviewNumbers,
  hasExistingReturnReservation,
}: ReservationReturnTicketSectionProps) {
  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex items-center space-x-2">
        <Checkbox
          id="return-ticket"
          checked={isReturnTicket}
          onCheckedChange={(checked) => onReturnTicketChange(checked === true)}
          disabled={returnRideInstancesCount === 0}
        />
        <label htmlFor="return-ticket" className="text-sm font-medium leading-none">
          Povratna karta
        </label>
      </div>

      {returnRideInstancesCount === 0 ? (
        <p className="text-xs text-muted-foreground">
          Nema dostupnih vožnji u suprotnom smeru za povratnu kartu.
        </p>
      ) : null}

      {isReturnTicket && returnRideInstancesCount > 0 && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Popover open={returnDatePickerOpen} onOpenChange={onReturnDatePickerOpenChange}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                >
                  <CalendarDays className="mr-2 h-4 w-4" />
                  {selectedReturnDate
                    ? format(selectedReturnDate, "d. MMMM yyyy", { locale: srLatn })
                    : "Datum povratka"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2" align="start">
                <Calendar
                  mode="single"
                  selected={selectedReturnDate}
                  onSelect={onSelectReturnDate}
                  locale={srLatn}
                  disabled={(date) => {
                    const dateKey = format(date, "yyyy-MM-dd")
                    return !availableReturnDateKeys.has(dateKey)
                  }}
                  className="rounded-md border"
                />
              </PopoverContent>
            </Popover>

            <Select
              value={selectedReturnRideInstanceId}
              onValueChange={onSelectReturnRideInstance}
            >
              <SelectTrigger>
                <SelectValue placeholder="Vreme povratka" />
              </SelectTrigger>
              <SelectContent>
                {returnInstancesForSelectedDate.map((instance) => (
                  <SelectItem key={instance.id} value={instance.id}>
                    {formatTimeDisplay(instance.departureTime)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedReturnRideInstance ? (
            <div className="space-y-1 rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
              <p>
                <span className="font-semibold text-foreground">Preselektovano:</span>{" "}
                {formatDateDisplay(new Date(selectedReturnRideInstance.date))} •{" "}
                {formatTimeDisplay(selectedReturnRideInstance.departureTime)} -{" "}
                {formatTimeDisplay(selectedReturnRideInstance.arrivalTime)}
              </p>
              <p>
                <span className="font-semibold text-foreground">Ruta:</span>{" "}
                {selectedArrivalStationName} → {selectedDepartureStationName}
              </p>
              <p>
                <span className="font-semibold text-foreground">Sedišta:</span>{" "}
                {returnSeatPreviewNumbers.length > 0
                  ? returnSeatPreviewNumbers.join(", ")
                  : "Biće dodeljena pri potvrdi"}
                {" "}(isti broj ako je slobodan, inače prvo slobodno)
              </p>
              {hasExistingReturnReservation ? (
                <p>
                  <span className="font-semibold text-foreground">Status:</span>{" "}
                  Učitani postojeći podaci povratne karte
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
