const driverRoutes = ["/passengers", "/passenger-lists"]

export function isDriverRole(role?: string): role is "DRIVER" {
  return role === "DRIVER"
}

export function canAccessDashboardRoute(role: string | undefined, pathname: string): boolean {
  if (!isDriverRole(role)) {
    return true
  }

  return driverRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`))
}
