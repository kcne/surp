import { AlertTriangle } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface ReservationAssignmentModeSectionProps {
  assignmentMode: "single" | "perSeat"
  onAssignmentModeChange: (mode: "single" | "perSeat") => void
}

export function ReservationAssignmentModeSection({
  assignmentMode,
  onAssignmentModeChange,
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
    </div>
  )
}
