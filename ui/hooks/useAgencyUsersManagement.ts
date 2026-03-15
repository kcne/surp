import { useMemo } from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
  getUsersControllerListQueryKey,
  useUsersControllerCreate,
  useUsersControllerList,
  useUsersControllerRemove,
  useUsersControllerUpdate,
} from "@/infrastructure/generated/surp-api"
import { getApiErrorMessage } from "@/infrastructure/utils/errors"
import type { UserResponseDto } from "@/infrastructure/generated/model"
import type {
  AgencyUser,
  CreateAgencyUserPayload,
  UpdateAgencyUserPayload,
} from "@/components/agency-management/types"
import { toast } from "sonner"

const USERS_LIST_PARAMS = {
  page: 1,
  pageSize: 100,
} as const

function mapUserToAgencyUser(user: UserResponseDto): AgencyUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
  }
}

interface UseAgencyUsersManagementOptions {
  enabled?: boolean
}

export function useAgencyUsersManagement({ enabled = true }: UseAgencyUsersManagementOptions = {}) {
  const queryClient = useQueryClient()

  const usersQuery = useUsersControllerList(USERS_LIST_PARAMS, {
    query: {
      enabled,
    },
  })
  const createUserMutation = useUsersControllerCreate()
  const updateUserMutation = useUsersControllerUpdate()
  const deleteUserMutation = useUsersControllerRemove()

  const users = useMemo(() => {
    const rawUsers = usersQuery.data?.status === 200 ? usersQuery.data.data.items : []

    return rawUsers
      .filter((user) => user.role !== "SUPERADMIN")
      .map(mapUserToAgencyUser)
  }, [usersQuery.data])

  const loading =
    usersQuery.isLoading ||
    createUserMutation.isPending ||
    updateUserMutation.isPending ||
    deleteUserMutation.isPending

  const refreshUsers = async () => {
    await queryClient.invalidateQueries({ queryKey: getUsersControllerListQueryKey() })
  }

  const createUser = async (payload: CreateAgencyUserPayload) => {
    try {
      await createUserMutation.mutateAsync({ data: payload })
      await refreshUsers()
      toast.success("Korisnik je uspešno kreiran")
    } catch (error: unknown) {
      const message = getApiErrorMessage(error, "Greška pri kreiranju korisnika")
      toast.error(message)
      throw error
    }
  }

  const updateUser = async (id: string, payload: UpdateAgencyUserPayload) => {
    try {
      await updateUserMutation.mutateAsync({ id, data: payload })
      await refreshUsers()
      toast.success("Korisnik je uspešno ažuriran")
    } catch (error: unknown) {
      const message = getApiErrorMessage(error, "Greška pri ažuriranju korisnika")
      toast.error(message)
      throw error
    }
  }

  const deleteUser = async (id: string) => {
    try {
      await deleteUserMutation.mutateAsync({ id })
      await refreshUsers()
      toast.success("Korisnik je uspešno deaktiviran")
    } catch (error: unknown) {
      const message = getApiErrorMessage(error, "Greška pri deaktivaciji korisnika")
      toast.error(message)
      throw error
    }
  }

  return {
    users,
    loading,
    isLoadingUsers: usersQuery.isLoading,
    hasError: usersQuery.isError,
    errorMessage: usersQuery.error
      ? getApiErrorMessage(usersQuery.error, "Greška pri učitavanju korisnika")
      : null,
    createUser,
    updateUser,
    deleteUser,
  }
}
