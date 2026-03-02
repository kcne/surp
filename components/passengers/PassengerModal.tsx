"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { PassengerForm } from "@/components/passengers/PassengerForm"
import { usePassengersStore } from "@/stores/passengersStore"
import type { Passenger, PassengerFormData } from "@/types"

interface PassengerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  passenger?: Passenger | null
}

export function PassengerModal({
  open,
  onOpenChange,
  passenger,
}: PassengerModalProps) {
  const { createPassenger, updatePassenger, loading } = usePassengersStore()
  const isEdit = !!passenger

  const handleSubmit = async (data: PassengerFormData) => {
    if (isEdit && passenger) {
      await updatePassenger(passenger.id, data)
    } else {
      await createPassenger(data)
    }

    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Izmeni Putnika" : "Dodaj Novog Putnika"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Ažurirajte informacije o putniku."
              : "Unesite informacije o novom putniku."}
          </DialogDescription>
        </DialogHeader>

        <PassengerForm
          key={passenger?.id || "new-passenger"}
          initialData={
            passenger
              ? {
                  firstName: passenger.firstName,
                  lastName: passenger.lastName,
                  phone: passenger.phone,
                  email: passenger.email || "",
                  idCardNumber: passenger.idCardNumber || "",
                  passengerType: passenger.passengerType,
                  address: passenger.address || "",
                  notes: passenger.notes || "",
                }
              : undefined
          }
          onSubmit={handleSubmit}
          onCancel={() => onOpenChange(false)}
          loading={loading}
        />
      </DialogContent>
    </Dialog>
  )
}
