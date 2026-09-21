import { useQuery } from "@tanstack/react-query"
import {
  maintenanceControllerGetDomainAudit,
  type maintenanceControllerGetDomainAuditResponse,
} from "@/infrastructure/generated/surp-api"
import type { DomainAuditEventResponseDto } from "@/infrastructure/generated/model/domainAuditEventResponseDto"

function isSuccess(
  response: maintenanceControllerGetDomainAuditResponse
): response is Extract<maintenanceControllerGetDomainAuditResponse, { status: 200 }> {
  return response.status === 200
}

/** Field-level history shown beside an integrity problem. */
export function useDomainAuditQuery(entityType: string, entityId: string) {
  return useQuery({
    queryKey: ["maintenance", "audit", entityType, entityId] as const,
    enabled: Boolean(entityType && entityId),
    queryFn: async (): Promise<DomainAuditEventResponseDto[]> => {
      const response = await maintenanceControllerGetDomainAudit(entityType, entityId)
      if (!isSuccess(response)) throw new Error("Neuspesno ucitavanje istorije izmena")
      return response.data
    },
    staleTime: 0,
  })
}
