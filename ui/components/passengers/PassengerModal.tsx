"use client"

import { useState } from "react"

import { FormModalShell } from "@/components/forms/FormModalShell"
import { PassengerForm } from "@/components/passengers/PassengerForm"
import {
  useCreatePassengerMutation,
  useUpdatePassengerMutation,
} from "@/infrastructure/hooks/mutations/usePassengerMutations"
import type { Passenger, PassengerFormData } from "@/types"
import type { WouldBreakReservationsDto } from "@/infrastructure/generated/model"
import { ChangeNeedsConfirmationError } from "@/infrastructure/utils/breaking-change"
import { ConfirmBreakingChangeDialog } from "@/components/data-integrity/ConfirmBreakingChangeDialog"

interface PassengerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  passenger?: Passenger | null
}

export function PassengerModal({ open, onOpenChange, passenger }: PassengerModalProps) {
  const createPassengerMutation = useCreatePassengerMutation()
  const updatePassengerMutation = useUpdatePassengerMutation()
  const isEdit = !!passenger
  const loading = createPassengerMutation.isPending || updatePassengerMutation.isPending
  const [pendingChange, setPendingChange] = useState<{
    payload: PassengerFormData
    confirmation: WouldBreakReservationsDto
  } | null>(null)

  const handleSubmit = async (data: PassengerFormData) => {
    if (isEdit && passenger) {
      try {
        await updatePassengerMutation.mutateAsync({ id: passenger.id, payload: data })
      } catch (error) {
        if (error instanceof ChangeNeedsConfirmationError) {
          setPendingChange({ payload: data, confirmation: error.confirmation })
        }

        throw error
      }
    } else {
      await createPassengerMutation.mutateAsync(data)
    }

    onOpenChange(false)
  }

  const handleConfirmPendingChange = async () => {
    if (!pendingChange || !passenger) {
      return
    }

    try {
      await updatePassengerMutation.mutateAsync({
        id: passenger.id,
        payload: pendingChange.payload,
        confirmBreakingChange: true,
      })
      setPendingChange(null)
      onOpenChange(false)
    } catch {
      // The mutation reports ordinary failures; keep the dialog open for retry.
    }
  }

  return (
    <>
      <FormModalShell
        open={open}
        onOpenChange={onOpenChange}
        title={isEdit ? "Izmeni Putnika" : "Dodaj Novog Putnika"}
        description={
          isEdit ? "Ažurirajte informacije o putniku." : "Unesite informacije o novom putniku."
        }
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

      <ConfirmBreakingChangeDialog
        open={pendingChange !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setPendingChange(null)
          }
        }}
        confirmation={pendingChange?.confirmation ?? null}
        loading={loading}
        onConfirm={handleConfirmPendingChange}
      />
    </>
  )
}
