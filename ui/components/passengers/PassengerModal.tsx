"use client"

import { FormModalShell } from "@/components/forms/FormModalShell"
import { PassengerForm } from "@/components/passengers/PassengerForm"
import {
  useCreatePassengerMutation,
  useUpdatePassengerMutation,
} from "@/infrastructure/hooks/mutations/usePassengerMutations"
import type { Passenger, PassengerFormData } from "@/types"
import { ConfirmBreakingChangeDialog } from "@/components/data-integrity/ConfirmBreakingChangeDialog"
import { answerTokens, useConfirmableUpdate } from "@/infrastructure/hooks/useConfirmableUpdate"

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
  const confirmableUpdate = useConfirmableUpdate<{ id: string; payload: PassengerFormData }>({
    update: (variables, answers) =>
      updatePassengerMutation.mutateAsync({
        ...variables,
        ...answerTokens(answers),
      }),
    onConfirmed: () => onOpenChange(false),
  })

  const handleSubmit = async (data: PassengerFormData) => {
    if (isEdit && passenger) {
      await confirmableUpdate.run({ id: passenger.id, payload: data })
    } else {
      await createPassengerMutation.mutateAsync(data)
    }

    onOpenChange(false)
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

      <ConfirmBreakingChangeDialog {...confirmableUpdate.dialogProps} loading={loading} />
    </>
  )
}
