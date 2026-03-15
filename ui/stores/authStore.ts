import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { User } from "@/types"
import { loginRequest } from "@/infrastructure/requests/auth.requests"
import { getApiErrorMessage } from "@/infrastructure/utils/errors"
import {
  clearAuthSession,
  setAccessToken,
  setRefreshToken,
  setTenantSlug,
} from "@/infrastructure/utils/storage"

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  hasHydrated: boolean
  loading: boolean
  error: string | null
  setHasHydrated: (hydrated: boolean) => void
  login: (username: string, password: string, tenantSlug: string) => Promise<void>
  logout: () => void
  clearError: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      hasHydrated: false,
      loading: false,
      error: null,
      setHasHydrated: (hydrated: boolean) => {
        set({ hasHydrated: hydrated })
      },

      login: async (username: string, password: string, tenantSlug: string) => {
        set({ loading: true, error: null })
        try {
          const response = await loginRequest({
            username,
            password,
            tenantSlug,
          })

          setAccessToken(response.accessToken)
          setRefreshToken(response.refreshToken)
          setTenantSlug(tenantSlug)

          set({
            user: {
              id: response.user.id,
              username: response.user.username,
              email: response.user.email,
              role: response.user.role,
            },
            isAuthenticated: true,
            loading: false,
            error: null,
          })
        } catch (error: unknown) {
          set({
            loading: false,
            error: getApiErrorMessage(
              error,
              "Greška pri prijavljivanju. Molimo pokušajte ponovo."
            ),
            isAuthenticated: false,
            user: null,
          })
          throw error
        }
      },

      logout: () => {
        clearAuthSession()
        set({
          user: null,
          isAuthenticated: false,
          error: null,
        })
      },

      clearError: () => {
        set({ error: null })
      },
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    }
  )
)

