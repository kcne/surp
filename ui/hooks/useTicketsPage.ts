import { useMemo, useState } from "react"
import {
  CreateTicketDtoCategory,
  TicketResponseDto,
  TicketResponseDtoCategory,
  TicketResponseDtoStatus,
  TicketsControllerListCategory,
  TicketsControllerListStatus,
  UpdateTicketDtoStatus,
} from "@/infrastructure/generated/model"
import {
  getTicketsControllerListQueryKey,
  getTicketsControllerGetByIdQueryKey,
  ticketsControllerPresignDownload,
  useTicketsControllerAddComment,
  useTicketsControllerCompleteAttachment,
  useTicketsControllerCompleteCommentAttachment,
  useTicketsControllerCreate,
  useTicketsControllerGetById,
  useTicketsControllerList,
  useTicketsControllerPresignUpload,
  useTicketsControllerUpdate,
} from "@/infrastructure/generated/surp-api"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { getApiErrorMessage } from "@/infrastructure/utils/errors"

const DEFAULT_QUERY_PARAMS = {
  page: 1,
  pageSize: 50,
} as const

const ticketListQueryKey = getTicketsControllerListQueryKey()

export function useTicketsPage() {
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "ALL">("ALL")
  const [categoryFilter, setCategoryFilter] = useState<TicketCategory | "ALL">("ALL")
  const [search, setSearch] = useState("")
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null)

  const listQuery = useTicketsControllerList(
    {
      ...DEFAULT_QUERY_PARAMS,
      ...(statusFilter !== "ALL"
        ? {
            status: statusFilter as unknown as TicketsControllerListStatus,
          }
        : {}),
      ...(categoryFilter !== "ALL"
        ? {
            category: categoryFilter as unknown as TicketsControllerListCategory,
          }
        : {}),
      ...(search.trim().length > 0 ? { search: search.trim() } : {}),
    },
    {
      query: {
        staleTime: 30_000,
      },
    }
  )

  const ticketItems = useMemo(
    () => (listQuery.data?.status === 200 ? listQuery.data.data.items : []),
    [listQuery.data]
  )

  const selectedTicketQuery = useTicketsControllerGetById(selectedTicketId || "", {
    query: {
      enabled: Boolean(selectedTicketId),
    },
  })

  const createTicketMutation = useTicketsControllerCreate()
  const updateTicketMutation = useTicketsControllerUpdate()
  const addCommentMutation = useTicketsControllerAddComment()
  const presignUploadMutation = useTicketsControllerPresignUpload()
  const completeAttachmentMutation = useTicketsControllerCompleteAttachment()
  const completeCommentAttachmentMutation = useTicketsControllerCompleteCommentAttachment()

  const loading =
    listQuery.isLoading ||
    createTicketMutation.isPending ||
    updateTicketMutation.isPending ||
    addCommentMutation.isPending ||
    presignUploadMutation.isPending ||
    completeAttachmentMutation.isPending ||
    completeCommentAttachmentMutation.isPending

  const selectedTicket =
    selectedTicketQuery.data?.status === 200 ? selectedTicketQuery.data.data : null

  const invalidateTickets = async () => {
    await queryClient.invalidateQueries({ queryKey: ticketListQueryKey })
    if (selectedTicketId) {
      await queryClient.invalidateQueries({
        queryKey: getTicketsControllerGetByIdQueryKey(selectedTicketId),
      })
    }
  }

  const createTicket = async (payload: {
    title: string
    description: string
    category: TicketCategory
    files: File[]
    onUploadProgress?: (file: File, progressPercent: number) => void
  }) => {
    try {
      const createdResponse = await createTicketMutation.mutateAsync({
        data: {
          title: payload.title,
          description: payload.description,
          category: payload.category as unknown as CreateTicketDtoCategory,
        },
      })

      if (createdResponse.status !== 200) {
        throw new Error("Neuspesno kreiranje tiketa")
      }

      const createdTicket = createdResponse.data
      if (payload.files.length > 0) {
        await uploadAttachmentsForTicket(createdTicket.id, payload.files, payload.onUploadProgress)
      }

      setSelectedTicketId(createdTicket.id)
      await invalidateTickets()
      toast.success("Tiket je uspesno kreiran")
      return createdTicket
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Neuspesno kreiranje tiketa"))
      throw error
    }
  }

  const updateTicketStatus = async (ticketId: string, status: TicketStatus) => {
    try {
      await updateTicketMutation.mutateAsync({
        id: ticketId,
        data: {
          status: status as unknown as UpdateTicketDtoStatus,
        },
      })
      await invalidateTickets()
      toast.success("Status tiketa je uspesno azuriran")
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Neuspesno azuriranje statusa"))
      throw error
    }
  }

  const addComment = async (
    ticketId: string,
    content: string,
    files: File[],
    onUploadProgress?: (file: File, progressPercent: number) => void
  ) => {
    try {
      const commentResponse = await addCommentMutation.mutateAsync({
        id: ticketId,
        data: { content },
      })

      if (commentResponse.status !== 200) {
        throw new Error("Neuspesno dodavanje komentara")
      }

      const updatedTicket = commentResponse.data
      const latestComment = updatedTicket.comments[updatedTicket.comments.length - 1]

      if (latestComment && files.length > 0) {
        await uploadAttachmentsForComment(ticketId, latestComment.id, files, onUploadProgress)
      }

      await invalidateTickets()
      toast.success("Komentar je uspesno dodat")
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Neuspesno dodavanje komentara"))
      throw error
    }
  }

  const uploadAttachmentsForTicket = async (
    ticketId: string,
    files: File[],
    onUploadProgress?: (file: File, progressPercent: number) => void
  ) => {
    for (const file of files) {
      onUploadProgress?.(file, 0)

      const presignResponse = await presignUploadMutation.mutateAsync({
        id: ticketId,
        data: {
          fileName: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
        },
      })

      if (presignResponse.status !== 200) {
        throw new Error("Neuspesno kreiranje upload URL-a")
      }

      await uploadFileToSignedUrl(presignResponse.data.uploadUrl, file, (progressPercent) => {
        onUploadProgress?.(file, progressPercent)
      })

      await completeAttachmentMutation.mutateAsync({
        id: ticketId,
        data: {
          storageKey: presignResponse.data.storageKey,
          fileName: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
        },
      })

      onUploadProgress?.(file, 100)
    }
  }

  const uploadAttachmentsForComment = async (
    ticketId: string,
    commentId: string,
    files: File[],
    onUploadProgress?: (file: File, progressPercent: number) => void
  ) => {
    for (const file of files) {
      onUploadProgress?.(file, 0)

      const presignResponse = await presignUploadMutation.mutateAsync({
        id: ticketId,
        data: {
          fileName: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
        },
      })

      if (presignResponse.status !== 200) {
        throw new Error("Neuspesno kreiranje upload URL-a")
      }

      await uploadFileToSignedUrl(presignResponse.data.uploadUrl, file, (progressPercent) => {
        onUploadProgress?.(file, progressPercent)
      })

      await completeCommentAttachmentMutation.mutateAsync({
        id: ticketId,
        commentId,
        data: {
          storageKey: presignResponse.data.storageKey,
          fileName: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
        },
      })

      onUploadProgress?.(file, 100)
    }
  }

  const getAttachmentDownloadUrl = async (ticketId: string, attachmentId: string) => {
    const response = await ticketsControllerPresignDownload(ticketId, attachmentId)

    if (response.status !== 200) {
      throw new Error("Neuspesno preuzimanje priloga")
    }

    return response.data.downloadUrl
  }

  return {
    loading,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    categoryFilter,
    setCategoryFilter,
    ticketItems,
    selectedTicket,
    selectedTicketId,
    setSelectedTicketId,
    listError: listQuery.error,
    refetchTickets: listQuery.refetch,
    createTicket,
    updateTicketStatus,
    addComment,
    getAttachmentDownloadUrl,
  }
}

async function uploadFileToSignedUrl(
  uploadUrl: string,
  file: File,
  onProgress?: (progressPercent: number) => void
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open("PUT", uploadUrl)
    request.setRequestHeader("Content-Type", file.type)

    request.upload.onprogress = (event) => {
      if (!event.lengthComputable) {
        return
      }

      const progressPercent = Math.round((event.loaded / event.total) * 100)
      onProgress?.(Math.min(100, Math.max(0, progressPercent)))
    }

    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        resolve()
        return
      }

      reject(new Error("Upload slike nije uspeo"))
    }

    request.onerror = () => {
      reject(new Error("Upload slike nije uspeo"))
    }

    request.send(file)
  })
}

export function isTicketStatus(value: string): value is TicketStatus {
  return (Object.values(TICKET_STATUSES) as TicketStatus[]).includes(value as TicketStatus)
}

export function isTicketCategory(value: string): value is TicketCategory {
  return (Object.values(TICKET_CATEGORIES) as TicketCategory[]).includes(value as TicketCategory)
}

export function getTicketStatusLabel(status: TicketStatus): string {
  const map: Record<TicketStatus, string> = {
    [TICKET_STATUSES.OPEN]: "Otvoren",
    [TICKET_STATUSES.IN_PROGRESS]: "U obradi",
    [TICKET_STATUSES.RESOLVED]: "Resen",
    [TICKET_STATUSES.CLOSED]: "Zatvoren",
  }

  return map[status]
}

export function getTicketCategoryLabel(category: TicketCategory): string {
  const map: Record<TicketCategory, string> = {
    [TICKET_CATEGORIES.BUG]: "Bug",
    [TICKET_CATEGORIES.IDEA]: "Ideja",
    [TICKET_CATEGORIES.FEATURE]: "Funkcionalnost",
    [TICKET_CATEGORIES.QUESTION]: "Pitanje",
    [TICKET_CATEGORIES.OTHER]: "Ostalo",
  }

  return map[category]
}

export function getTicketStatusBadgeVariant(
  status: TicketStatus
): "default" | "secondary" | "destructive" | "outline" {
  if (status === TICKET_STATUSES.OPEN) {
    return "default"
  }

  if (status === TICKET_STATUSES.IN_PROGRESS) {
    return "secondary"
  }

  if (status === TICKET_STATUSES.CLOSED) {
    return "outline"
  }

  return "default"
}

export function getTicketStatusTextClass(status: TicketStatus): string {
  if (status === TICKET_STATUSES.OPEN) {
    return "text-blue-700"
  }

  if (status === TICKET_STATUSES.IN_PROGRESS) {
    return "text-amber-700"
  }

  if (status === TICKET_STATUSES.RESOLVED) {
    return "text-emerald-700"
  }

  return "text-slate-700"
}

export function getTicketCategoryTextClass(category: TicketCategory): string {
  if (category === TICKET_CATEGORIES.BUG) {
    return "text-rose-700"
  }

  if (category === TICKET_CATEGORIES.FEATURE) {
    return "text-violet-700"
  }

  if (category === TICKET_CATEGORIES.IDEA) {
    return "text-fuchsia-700"
  }

  if (category === TICKET_CATEGORIES.QUESTION) {
    return "text-cyan-700"
  }

  return "text-slate-700"
}

export function formatTicketActor(actor: {
  displayName?: string | null
  email?: string | null
} | null): string {
  if (!actor) {
    return "Nepoznat korisnik"
  }

  if (actor.displayName && actor.email) {
    return `${actor.displayName} (${actor.email})`
  }

  return actor.displayName || actor.email || "Nepoznat korisnik"
}

export function getTicketIssueKey(id: string): string {
  const suffix = id.slice(-6).toUpperCase()
  return `#${suffix}`
}

export function pickLatestTicketComment(
  ticket: TicketResponseDto | null
): TicketResponseDto["comments"][number] | null {
  if (!ticket || ticket.comments.length === 0) {
    return null
  }

  return ticket.comments[ticket.comments.length - 1]
}

export type TicketStatus = TicketResponseDtoStatus
export type TicketCategory = TicketResponseDtoCategory

export const TICKET_STATUSES = {
  OPEN: "OPEN",
  IN_PROGRESS: "IN_PROGRESS",
  RESOLVED: "RESOLVED",
  CLOSED: "CLOSED",
} as const

export const TICKET_CATEGORIES = {
  BUG: "BUG",
  IDEA: "IDEA",
  FEATURE: "FEATURE",
  QUESTION: "QUESTION",
  OTHER: "OTHER",
} as const
