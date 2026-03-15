import axios from "axios"
import { clearAuthSession } from "@/infrastructure/utils/storage"
import { buildAuthAndTenantHeaders } from "@/infrastructure/utils/request-context"

const DEFAULT_API_URL = "http://localhost:3001"

export const httpClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
})

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
  (error) => {
    if (error.response?.status === 401) {
      clearAuthSession()

      if (typeof window !== "undefined" && window.location.pathname !== "/login") {
        window.location.href = "/login"
      }
    }

    return Promise.reject(error)
  }
)
