import axios from "axios"
import {
  clearAuthSession,
  getRefreshToken,
  getTenantSlug,
  setAccessToken,
  setRefreshToken,
} from "@/infrastructure/utils/storage"
import { buildAuthAndTenantHeaders } from "@/infrastructure/utils/request-context"

const DEFAULT_API_URL = "http://127.0.0.1:3001"

export const httpClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
})

let refreshPromise: Promise<string | null> | null = null

function clearSessionAndRedirectToLogin(): void {
  clearAuthSession()

  if (typeof window !== "undefined" && window.location.pathname !== "/login") {
    // replace() so a repeated 401 cannot stack up history entries.
    window.location.replace("/login")
  }
}

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) {
    return refreshPromise
  }

  refreshPromise = (async () => {
    const refreshToken = getRefreshToken()

    if (!refreshToken) {
      return null
    }

    const tenantSlug = getTenantSlug()
    const refreshHeaders: Record<string, string> = {
      "Content-Type": "application/json",
    }

    if (tenantSlug) {
      refreshHeaders["X-Tenant-Slug"] = tenantSlug
    }

    const response = await axios.post(
      `${process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_URL}/auth/refresh`,
      { refreshToken },
      { headers: refreshHeaders }
    )

    const loginPayload = response.data?.data ?? response.data

    if (!loginPayload?.accessToken || !loginPayload?.refreshToken) {
      return null
    }

    setAccessToken(loginPayload.accessToken)
    setRefreshToken(loginPayload.refreshToken)

    return loginPayload.accessToken
  })().finally(() => {
    refreshPromise = null
  })

  return refreshPromise
}

httpClient.interceptors.request.use(
  (config) => {
    const contextHeaders = buildAuthAndTenantHeaders()
    const headers = config.headers ?? {}

    if (contextHeaders.Authorization && !headers.Authorization) {
      headers.Authorization = contextHeaders.Authorization
    }

    if (contextHeaders["X-Tenant-Slug"] && !headers["X-Tenant-Slug"]) {
      headers["X-Tenant-Slug"] = contextHeaders["X-Tenant-Slug"]
    }

    config.headers = headers

    return config
  },
  (error) => Promise.reject(error)
)

httpClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status
    const originalRequest = error.config as (typeof error.config & {
      _retry?: boolean
    })

    if (status === 401) {
      const requestUrl = String(originalRequest?.url ?? "")
      const isAuthEndpoint =
        requestUrl.includes("/auth/login") ||
        requestUrl.includes("/auth/refresh") ||
        requestUrl.includes("/auth/logout")

      if (originalRequest && !originalRequest._retry && !isAuthEndpoint) {
        originalRequest._retry = true

        try {
          const refreshedAccessToken = await refreshAccessToken()

          if (refreshedAccessToken) {
            originalRequest.headers = {
              ...(originalRequest.headers ?? {}),
              Authorization: `Bearer ${refreshedAccessToken}`,
            }

            return httpClient(originalRequest)
          }
        } catch {
          // If refresh fails we intentionally fallback to logout + redirect.
        }
      }

      // A failed login attempt is not a stale session — don't wipe storage or
      // redirect, the login form shows the error itself.
      if (!requestUrl.includes("/auth/login")) {
        clearSessionAndRedirectToLogin()
      }
    }

    return Promise.reject(error)
  }
)
