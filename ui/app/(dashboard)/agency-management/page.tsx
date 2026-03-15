"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Layout } from "@/components/layout/Layout"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AgencyUsersDataTable } from "@/components/agency-management/AgencyUsersDataTable"
import { AgencyUserModal } from "@/components/agency-management/AgencyUserModal"
import { DeleteAgencyUserDialog } from "@/components/agency-management/DeleteAgencyUserDialog"
import { useCrudDialogState } from "@/hooks/useCrudDialogState"
import { useAgencyUsersManagement } from "@/hooks/useAgencyUsersManagement"
import { useAuthStore } from "@/stores/authStore"
import { isEditableAgencyRole, type AgencyUser } from "@/components/agency-management/types"
import { Building2, Plus, ShieldAlert, Users } from "lucide-react"
import { toast } from "sonner"

export default function AgencyManagementPage() {
  const router = useRouter()
  const { isAuthenticated, hasHydrated, user } = useAuthStore()
  const isTenantAdmin = user?.role === "ADMIN"
  const { users, loading, isLoadingUsers, hasError, errorMessage, createUser, updateUser, deleteUser } =
    useAgencyUsersManagement({ enabled: hasHydrated && isAuthenticated && isTenantAdmin })

  const {
    isModalOpen,
    isDeleteDialogOpen,
    selectedItem: selectedUser,
    itemToDelete: userToDelete,
    openCreate,
    openEdit,
    closeModal,
    openDelete,
    setIsDeleteDialogOpen,
  } = useCrudDialogState<AgencyUser>()

  const handleEdit = (targetUser: AgencyUser) => {
    if (!isEditableAgencyRole(targetUser.role)) {
      toast.info("Admin i superadmin nalozi nisu dostupni za izmenu na ovoj stranici")
      return
    }

    openEdit(targetUser)
  }

  const handleDelete = (targetUser: AgencyUser) => {
    if (!isEditableAgencyRole(targetUser.role)) {
      toast.info("Admin i superadmin nalozi nisu dostupni za deaktivaciju na ovoj stranici")
      return
    }

    openDelete(targetUser)
  }

  const handleResetPassword = (targetUser: AgencyUser) => {
    toast.info(
      `Reset lozinke za korisnika ${targetUser.username} trenutno nije dostupan jer API contract još nema reset password endpoint.`
    )
  }

  useEffect(() => {
    if (hasHydrated && !isAuthenticated) {
      router.push("/login")
    }
  }, [hasHydrated, isAuthenticated, router])

  if (!hasHydrated) {
    return null
  }

  if (!isAuthenticated) {
    return null
  }

  if (!isTenantAdmin) {
    return (
      <Layout>
        <div className="space-y-6">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <Building2 className="h-6 w-6 text-primary" />
              Upravljanje Agencijom
            </h1>
            <p className="text-muted-foreground">Administracija korisnika agencije</p>
          </div>

          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
            <ShieldAlert className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-lg font-medium">Nemate pristup ovoj stranici</p>
            <p className="text-sm text-muted-foreground">
              Samo tenant admin korisnici mogu da upravljaju korisnicima agencije.
            </p>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <Building2 className="h-6 w-6 text-primary" />
              Upravljanje Agencijom
            </h1>
            <p className="text-muted-foreground">Upravljajte korisnicima i pristupom u okviru agencije</p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Dodaj Korisnika
          </Button>
        </div>

        {hasError && errorMessage ? (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}

        {isLoadingUsers && users.length === 0 ? (
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12">
            <Users className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-lg font-medium text-muted-foreground">Nema korisnika</p>
            <p className="mb-4 text-sm text-muted-foreground">Dodajte prvog korisnika agencije da biste počeli</p>
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Dodaj Korisnika
            </Button>
          </div>
        ) : (
          <AgencyUsersDataTable
            users={users}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onResetPassword={handleResetPassword}
          />
        )}

        <AgencyUserModal
          open={isModalOpen}
          onOpenChange={closeModal}
          user={selectedUser}
          loading={loading}
          onCreate={createUser}
          onUpdate={updateUser}
        />

        <DeleteAgencyUserDialog
          open={isDeleteDialogOpen}
          onOpenChange={setIsDeleteDialogOpen}
          user={userToDelete}
          loading={loading}
          onDelete={deleteUser}
        />
      </div>
    </Layout>
  )
}
