import { httpClient } from "@/infrastructure/requests/http-client"

export type PlatformTenantKpis = {
  totalUsers: number
  activeUsers: number
  reservationsInPeriod: number
  activeRides: number
  activeLines: number
  totalPassengers: number
  activePassengers: number
  openTickets: number
  inProgressTickets: number
  storefront: {
    status: string | null
    publishedAt: string | null
  }
  lastActivityAt: string | null
}

export type PlatformTenant = {
  id: string
  slug: string
  name: string
  timezone: string | null
  isActive: boolean
  deactivatedAt: string | null
  deactivatedById: string | null
  createdAt: string
  updatedAt: string
  kpis?: PlatformTenantKpis
}

export type PaginatedPlatformTenants = {
  items: PlatformTenant[]
  page: number
  pageSize: number
  total: number
}

export type PlatformLeadStatus =
  | "NEW"
  | "CONTACTED"
  | "QUALIFIED"
  | "FOLLOW_UP"
  | "CONVERTED"
  | "NOT_INTERESTED"
  | "SPAM"

export type PlatformLead = {
  id: string
  status: PlatformLeadStatus
  name: string
  email: string
  agencyName: string
  phone: string | null
  departuresPerDay: string
  message: string | null
  ipAddress: string | null
  notes: string | null
  assigneeUserId: string | null
  convertedTenantId: string | null
  convertedAt: string | null
  internalEmailSentAt: string | null
  confirmationEmailSentAt: string | null
  lastEmailError: string | null
  createdAt: string
  updatedAt: string
}

export type PaginatedPlatformLeads = {
  items: PlatformLead[]
  page: number
  pageSize: number
  total: number
}

export type PlatformAuditEvent = {
  id: string
  actorUserId: string
  actorDisplayName: string | null
  action: string
  targetType: string
  targetId: string
  targetDisplayName: string | null
  targetTenantId: string | null
  targetTenantDisplayName: string | null
  targetLeadId: string | null
  targetLeadDisplayName: string | null
  targetUserId: string | null
  targetUserDisplayName: string | null
  metadata: unknown | null
  createdAt: string
}

export type PaginatedPlatformAudit = {
  items: PlatformAuditEvent[]
  page: number
  pageSize: number
  total: number
}

export type PlatformAnalyticsOverview = {
  range: {
    fromDate: string
    toDate: string
  }
  summary: {
    totalAgencies: number
    activeAgencies: number
    totalUsers: number
    activeUsers: number
    reservationsInPeriod: number
    activeRides: number
    activeLines: number
    totalPassengers: number
    openTickets: number
    newLeadsInPeriod: number
    convertedLeadsInPeriod: number
    leadConversionRatePercent: number
    publishedStorefronts: number
    agenciesWithRecentActivity: number
  }
  dailyTrend: Array<{
    date: string
    reservations: number
    leads: number
  }>
  topAgencies: Array<{
    tenantId: string
    tenantName: string
    tenantSlug: string
    reservationsInPeriod: number
    activeUsers: number
    activeRides: number
    activeLines: number
  }>
}

export type CreatePlatformTenantPayload = {
  slug: string
  name: string
  timezone?: string
}

export type CreatePlatformTenantAdminPayload = {
  username: string
  email: string
  password: string
  requirePasswordChange?: boolean
}

export type UpdatePlatformLeadPayload = {
  status?: PlatformLeadStatus
  notes?: string | null
  assigneeUserId?: string | null
}

export type ConvertPlatformLeadPayload = {
  tenantSlug: string
  tenantName: string
  timezone?: string
  adminUsername: string
  adminEmail: string
  adminPassword: string
  requirePasswordChange?: boolean
}

function unwrap<T>(response: { data: T | { data: T } }): T {
  const body = response.data
  if (body && typeof body === "object" && "data" in body) {
    return body.data as T
  }
  return body as T
}

export async function getPlatformAnalyticsOverview(): Promise<PlatformAnalyticsOverview> {
  return unwrap(await httpClient.get<PlatformAnalyticsOverview>("/platform/analytics/overview"))
}

export async function listPlatformTenants(params?: {
  search?: string
  isActive?: boolean
  page?: number
  pageSize?: number
}): Promise<PaginatedPlatformTenants> {
  return unwrap(await httpClient.get<PaginatedPlatformTenants>("/platform/tenants", { params }))
}

export async function getPlatformTenant(id: string): Promise<PlatformTenant> {
  return unwrap(await httpClient.get<PlatformTenant>(`/platform/tenants/${id}`))
}

export async function createPlatformTenant(payload: CreatePlatformTenantPayload): Promise<PlatformTenant> {
  return unwrap(await httpClient.post<PlatformTenant>("/platform/tenants", payload))
}

export async function activatePlatformTenant(id: string): Promise<PlatformTenant> {
  return unwrap(await httpClient.patch<PlatformTenant>(`/platform/tenants/${id}/activate`))
}

export async function deactivatePlatformTenant(id: string): Promise<PlatformTenant> {
  return unwrap(await httpClient.patch<PlatformTenant>(`/platform/tenants/${id}/deactivate`))
}

export async function createPlatformTenantAdmin(
  tenantId: string,
  payload: CreatePlatformTenantAdminPayload
): Promise<unknown> {
  return unwrap(await httpClient.post(`/platform/tenants/${tenantId}/create-admin`, payload))
}

export async function listPlatformLeads(params?: {
  search?: string
  status?: PlatformLeadStatus
  converted?: boolean
  page?: number
  pageSize?: number
}): Promise<PaginatedPlatformLeads> {
  return unwrap(await httpClient.get<PaginatedPlatformLeads>("/platform/leads", { params }))
}

export async function getPlatformLead(id: string): Promise<PlatformLead> {
  return unwrap(await httpClient.get<PlatformLead>(`/platform/leads/${id}`))
}

export async function updatePlatformLead(id: string, payload: UpdatePlatformLeadPayload): Promise<PlatformLead> {
  return unwrap(await httpClient.patch<PlatformLead>(`/platform/leads/${id}`, payload))
}

export async function convertPlatformLead(
  id: string,
  payload: ConvertPlatformLeadPayload
): Promise<{ lead: PlatformLead; tenant: PlatformTenant; adminUser: unknown }> {
  return unwrap(await httpClient.post(`/platform/leads/${id}/convert-to-agency`, payload))
}

export async function listPlatformAudit(params?: {
  action?: string
  targetType?: string
  page?: number
  pageSize?: number
}): Promise<PaginatedPlatformAudit> {
  return unwrap(await httpClient.get<PaginatedPlatformAudit>("/platform/audit", { params }))
}
