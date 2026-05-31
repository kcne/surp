import { AlertTriangle, Users2 } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"

interface ReservationAssignmentModeSectionProps {
  assignmentMode: "single" | "perSeat"
  onAssignmentModeChange: (mode: "single" | "perSeat") => void
  showTravelTogether?: boolean
  travelTogether?: boolean
  onTravelTogetherChange?: (value: boolean) => void
}

export function ReservationAssignmentModeSection({
  assignmentMode,
  onAssignmentModeChange,
  showTravelTogether = false,
  travelTogether = true,
  onTravelTogetherChange,
}: ReservationAssignmentModeSectionProps) {
  return (
    <div className="space-y-3 rounded-lg border bg-white p-4 text-sm">
      <div className="flex items-center justify-between">
        <p className="font-semibold">Način raspodele sedišta</p>
        <Select
          onValueChange={(value) =>
            onAssignmentModeChange(value === "perSeat" ? "perSeat" : "single")
          }
          value={assignmentMode}
        >
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Izaberite režim" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="single">Jedan Putnik</SelectItem>
            <SelectItem value="perSeat">Više putnika</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-start gap-2 rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-orange-700">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          {assignmentMode === "single"
            ? "Sva izabrana sedišta biće dodeljena jednom putniku."
            : "Izaberite putnika za svako sedište posebno."}
        </p>
      </div>
      {showTravelTogether && onTravelTogetherChange && (
        <label
          className="flex cursor-pointer items-start gap-3 rounded-md border bg-gray-50 px-3 py-2.5 transition hover:bg-gray-100"
          htmlFor="travel-together-checkbox"
        >
          <Checkbox
            id="travel-together-checkbox"
            checked={travelTogether}
            onCheckedChange={(checked) => onTravelTogetherChange(checked === true)}
            className="mt-0.5"
          />
          <div className="flex-1 space-y-0.5">
            <div className="flex items-center gap-1.5 font-medium text-gray-900">
              <Users2 className="h-4 w-4 text-primary" />
              Označeni putnici putuju zajedno
            </div>
            <p className="text-xs text-gray-600">
              {travelTogether
                ? "Putnici će biti označeni kao grupa u izvozu za vozača."
                : "Svaki putnik se računa pojedinačno."}
            </p>
          </div>
        </label>
      )}
    </div>
  )
}
