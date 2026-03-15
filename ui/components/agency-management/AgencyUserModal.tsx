"use client"

import { FormModalShell } from "@/components/forms/FormModalShell"
import { AgencyUserForm } from "@/components/agency-management/AgencyUserForm"
import type {
  AgencyUser,
  AgencyUserFormData,
  CreateAgencyUserPayload,
  UpdateAgencyUserPayload,
} from "@/components/agency-management/types"

interface AgencyUserModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user?: AgencyUser | null
  loading?: boolean
  onCreate: (payload: CreateAgencyUserPayload) => Promise<void>
  onUpdate: (id: string, payload: UpdateAgencyUserPayload) => Promise<void>
}

export function AgencyUserModal({
  open,
  onOpenChange,
  user,
  loading = false,
  onCreate,
  onUpdate,
}: AgencyUserModalProps) {
  const isEdit = Boolean(user)

  const handleSubmit = async (data: AgencyUserFormData) => {
    if (isEdit && user) {
      await onUpdate(user.id, {
        username: data.username,
        email: data.email,
        role: data.role,
        isActive: data.isActive,
      })
    } else {
      await onCreate({
        username: data.username,
        email: data.email,
        password: data.password ?? "",
        role: data.role,
      })
    }

    onOpenChange(false)
  }

  return (
    <FormModalShell
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Izmeni Korisnika" : "Dodaj Novog Korisnika"}
      description={
        isEdit
          ? "Ažurirajte informacije i status korisnika."
          : "Unesite podatke za novog korisnika agencije."
      }
      contentClassName="sm:max-w-[640px]"
    >
      <AgencyUserForm
        key={user?.id ?? "new-agency-user"}
        isEdit={isEdit}
        initialData={
          user
            ? {
                username: user.username,
                email: user.email,
                role: user.role === "MANAGER" ? "MANAGER" : "STAFF",
                isActive: user.isActive,
              }
            : undefined
        }
        loading={loading}
        onSubmit={handleSubmit}
        onCancel={() => onOpenChange(false)}
      />
    </FormModalShell>
  )
}
