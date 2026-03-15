"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Mail, KeyRound, Pencil, Settings2, ShieldCheck, Trash2, UserRound } from "lucide-react"
import { isEditableAgencyRole, type AgencyUser } from "@/components/agency-management/types"

const roleLabels: Record<AgencyUser["role"], string> = {
  SUPERADMIN: "Superadmin",
  ADMIN: "Admin",
  MANAGER: "Menadžer",
  STAFF: "Osoblje",
}

export function getAgencyUsersTableColumns({
  onEdit,
  onDelete,
  onResetPassword,
}: {
  onEdit: (user: AgencyUser) => void
  onDelete: (user: AgencyUser) => void
  onResetPassword: (user: AgencyUser) => void
}): ColumnDef<AgencyUser>[] {
  return [
    {
      accessorKey: "username",
      header: () => (
        <div className="inline-flex items-center gap-1">
          <UserRound className="h-4 w-4 text-muted-foreground" />
          Korisničko ime
        </div>
      ),
      cell: ({ row }) => <div className="font-semibold text-primary">{row.original.username}</div>,
    },
    {
      accessorKey: "email",
      header: () => (
        <div className="inline-flex items-center gap-1">
          <Mail className="h-4 w-4 text-muted-foreground" />
          Email
        </div>
      ),
    },
    {
      accessorKey: "role",
      header: "Rola",
      cell: ({ row }) => <Badge variant="secondary">{roleLabels[row.original.role]}</Badge>,
    },
    {
      accessorKey: "isActive",
      header: () => (
        <div className="inline-flex items-center gap-1">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          Status
        </div>
      ),
      cell: ({ row }) => (
        <Badge variant={row.original.isActive ? "default" : "outline"}>
          {row.original.isActive ? "Aktivan" : "Neaktivan"}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: () => (
        <div className="inline-flex items-center justify-end gap-1 text-right">
          <Settings2 className="h-4 w-4 text-muted-foreground" />
          Akcije
        </div>
      ),
      cell: ({ row }) => {
        const user = row.original
        const canEdit = isEditableAgencyRole(user.role)

        return (
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onResetPassword(user)}
              title="Reset lozinke"
            >
              <KeyRound className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEdit(user)}
              disabled={!canEdit}
              title={canEdit ? "Izmeni korisnika" : "Admin korisnici nisu dostupni za izmenu"}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(user)}
              className="text-danger hover:text-danger hover:bg-danger/10"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )
      },
    },
  ]
}
