export const ACCESS_TOKEN_KEY = "auth_access_token"
export const REFRESH_TOKEN_KEY = "auth_refresh_token"
export const TENANT_SLUG_KEY = "auth_tenant_slug"
// Must stay in sync with the `name` of the persisted auth store (stores/authStore.ts).
export const AUTH_STORE_KEY = "auth-storage"

function canUseStorage(): boolean {
  return typeof window !== "undefined"
}

export function getAccessToken(): string | null {
  if (!canUseStorage()) {
    return null
  }

  return localStorage.getItem(ACCESS_TOKEN_KEY)
}

export function setAccessToken(token: string): void {
  if (!canUseStorage()) {
    return
  }

  localStorage.setItem(ACCESS_TOKEN_KEY, token)
}

export function getRefreshToken(): string | null {
  if (!canUseStorage()) {
    return null
  }

  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

export function setRefreshToken(token: string): void {
  if (!canUseStorage()) {
    return
  }

  localStorage.setItem(REFRESH_TOKEN_KEY, token)
}

export function getTenantSlug(): string | null {
  if (!canUseStorage()) {
    return null
  }

  return localStorage.getItem(TENANT_SLUG_KEY)
}

export function setTenantSlug(slug: string): void {
  if (!canUseStorage()) {
    return
  }

  localStorage.setItem(TENANT_SLUG_KEY, slug)
}

export function clearAuthSession(): void {
  if (!canUseStorage()) {
    return
  }

  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
  localStorage.removeItem(TENANT_SLUG_KEY)
  // The persisted auth store keeps its own `isAuthenticated` copy. Leaving it
  // behind makes the app think it is logged in after the tokens are gone, which
  // ping-pongs the user between /login and the dashboard.
  localStorage.removeItem(AUTH_STORE_KEY)
}
