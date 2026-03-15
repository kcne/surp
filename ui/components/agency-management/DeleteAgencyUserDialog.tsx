"use client"

import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog"
import type { AgencyUser } from "@/components/agency-management/types"

interface DeleteAgencyUserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: AgencyUser | null
  loading?: boolean
  onDelete: (id: string) => Promise<void>
}

export function DeleteAgencyUserDialog({
  open,
  onOpenChange,
  user,
  loading = false,
  onDelete,
}: DeleteAgencyUserDialogProps) {
  const handleDelete = async () => {
    if (!user) {
      return
    }

    await onDelete(user.id)
    onOpenChange(false)
  }

  return (
    <ConfirmDeleteDialog
      open={open}
      onOpenChange={onOpenChange}
      loading={loading}
      title="Deaktivacija korisnika"
      description={`Da li ste sigurni da želite da deaktivirate korisnika ${user?.username ?? ""}? Korisnik neće moći da se prijavi dok je neaktivan.`}
      confirmLabel="Deaktiviraj"
      loadingLabel="Deaktivacija..."
      onConfirm={handleDelete}
    />
  )
}
