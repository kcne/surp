import { useMemo } from "react"
import {
  useReportingControllerGetAudit,
  useReportingControllerGetDashboard,
  useReportingControllerGetOccupancy,
} from "@/infrastructure/generated/surp-api"
import type { TopLineMetricResponseDto } from "@/infrastructure/generated/model"
import { getApiErrorMessage } from "@/infrastructure/utils/errors"
import { getTenantSlug } from "@/infrastructure/utils/storage"

const DAY_MS = 24 * 60 * 60 * 1000
const DEFAULT_TOP_LINES_LIMIT = 6
const DEFAULT_AUDIT_PAGE_SIZE = 6

function toDateInputValue(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

function getDefaultDateRange(isSandboxDemo: boolean) {
  const today = new Date()
  const from = isSandboxDemo ? today : new Date(today.getTime() - 13 * DAY_MS)
  const to = isSandboxDemo ? new Date(today.getTime() + 13 * DAY_MS) : today

  return {
    fromDate: toDateInputValue(from),
    toDate: toDateInputValue(to),
  }
}

export function useDashboardAnalyticsPage() {
  const isSandboxDemo = getTenantSlug() === "sandbox-demo"
  const defaults = useMemo(() => getDefaultDateRange(isSandboxDemo), [isSandboxDemo])
  const fromDate = defaults.fromDate
  const toDate = defaults.toDate

  const dashboardQuery = useReportingControllerGetDashboard(
    {
      fromDate,
      toDate,
      topLinesLimit: DEFAULT_TOP_LINES_LIMIT,
    },
    {
      query: {
        staleTime: 60_000,
      },
    }
  )

  const occupancyQuery = useReportingControllerGetOccupancy(
    {
      fromDate,
      toDate,
    },
    {
      query: {
        staleTime: 60_000,
      },
    }
  )

  const auditQuery = useReportingControllerGetAudit(
    {
      fromDate,
      toDate,
      page: 1,
      pageSize: DEFAULT_AUDIT_PAGE_SIZE,
    },
    {
      query: {
        staleTime: 30_000,
      },
    }
  )

  const dashboard = dashboardQuery.data?.status === 200 ? dashboardQuery.data.data : null
  const occupancy = occupancyQuery.data?.status === 200 ? occupancyQuery.data.data : null
  const audit = auditQuery.data?.status === 200 ? auditQuery.data.data : null

  const reservationsTrend = useMemo(() => {
    return (dashboard?.dailyReservations ?? []).map((point) => ({
      date: point.date,
      totalReservations: point.totalReservations,
      activeReservations: point.activeReservations,
      cancelledReservations: point.cancelledReservations,
    }))
  }, [dashboard?.dailyReservations])

  const occupancyTrend = useMemo(() => {
    return (occupancy?.points ?? []).map((point) => ({
      date: point.date,
      utilizationPercent: point.utilizationPercent,
      activeReservations: point.activeReservations,
      totalCapacity: point.totalCapacity,
      lineName: point.lineName,
    }))
  }, [occupancy?.points])

  const isLoading = dashboardQuery.isLoading || occupancyQuery.isLoading || auditQuery.isLoading

  const errorMessage = useMemo(() => {
    if (dashboardQuery.error) {
      return getApiErrorMessage(dashboardQuery.error, "Greška pri učitavanju dashboard metrika")
    }

    if (occupancyQuery.error) {
      return getApiErrorMessage(occupancyQuery.error, "Greška pri učitavanju popunjenosti")
    }

    if (auditQuery.error) {
      return getApiErrorMessage(auditQuery.error, "Greška pri učitavanju audit podataka")
    }

    return null
  }, [auditQuery.error, dashboardQuery.error, occupancyQuery.error])

  return {
    isLoading,
    errorMessage,
    dashboard,
    occupancy,
    audit,
    reservationsTrend,
    occupancyTrend,
    topLines: dashboard?.topLines ?? [],
    auditItems: audit?.items ?? [],
  }
}
