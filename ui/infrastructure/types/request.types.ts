export type TenantScoped<T> = T & {
  tenantSlug: string
}
