import { getAccessToken, getTenantSlug } from "@/infrastructure/utils/storage"

export interface RequestContext {
  accessToken: string | null
  tenantSlug: string | null
}

export function getRequestContext(): RequestContext {
  return {
    accessToken: getAccessToken(),
    tenantSlug: getTenantSlug(),
  }
}

export function buildAuthAndTenantHeaders(context: RequestContext = getRequestContext()): Record<string, string> {
  const headers: Record<string, string> = {}

  if (context.accessToken) {
    headers.Authorization = `Bearer ${context.accessToken}`
  }

  if (context.tenantSlug) {
    headers["X-Tenant-Slug"] = context.tenantSlug
  }

  return headers
}

export function buildTenantHeader(tenantSlug: string): Record<string, string> {
  return {
    "X-Tenant-Slug": tenantSlug,
  }
}
