import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { User } from "@/types"
import { authApi } from "@/lib/api"

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  loading: boolean
  error: string | null
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  clearError: () => void
}

// Default mock user
const defaultUser: User = {
  id: "1",
  username: "admin",
  name: "Administrator",
  email: "admin@example.com",
  role: "admin",
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: defaultUser,
      isAuthenticated: true,
      loading: false,
      error: null,

      login: async (username: string, password: string) => {
        set({ loading: true, error: null })
        try {
          const response = await authApi.login(username, password)
          const { user, token } = response.data

          // Store token in localStorage
          if (typeof window !== "undefined") {
            localStorage.setItem("auth_token", token)
          }

          set({
            user,
            isAuthenticated: true,
            loading: false,
            error: null,
          })
        } catch (error: any) {
          set({
            loading: false,
            error: error?.message || "Greška pri prijavljivanju. Molimo pokušajte ponovo.",
            isAuthenticated: false,
            user: null,
          })
          throw error
        }
      },

      logout: () => {
        authApi.logout()
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
    }
  )
)

