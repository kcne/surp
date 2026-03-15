"use client"

import {
  FormModalShell,
} from "@/components/forms/FormModalShell"
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
    <FormModalShell
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Izmeni Putnika" : "Dodaj Novog Putnika"}
      description={isEdit
        ? "Ažurirajte informacije o putniku."
        : "Unesite informacije o novom putniku."}
      contentClassName="sm:max-w-[720px]"
    >

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
    </FormModalShell>
  )
}
