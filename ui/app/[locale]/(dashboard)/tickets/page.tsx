"use client"

import { useEffect, useMemo, useState } from "react"
import type { DragEvent } from "react"
import Image from "next/image"
import { Layout } from "@/components/layout/Layout"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  TICKET_CATEGORIES,
  TICKET_STATUSES,
  TicketCategory,
  TicketStatus,
  formatTicketActor,
  getTicketIssueKey,
  getTicketCategoryLabel,
  getTicketCategoryTextClass,
  getTicketStatusBadgeVariant,
  getTicketStatusLabel,
  getTicketStatusTextClass,
  isTicketCategory,
  isTicketStatus,
  useTicketsPage,
} from "@/hooks/useTicketsPage"
import { formatDateTime } from "@/utils/formatters"
import {
  AlertCircle,
  Bug,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Eye,
  Filter,
  FileImage,
  Lightbulb,
  Loader2,
  MessageSquare,
  Plus,
  Sparkles,
  Ticket,
  Upload,
  UserRound,
  Wrench,
  XCircle,
} from "lucide-react"

const MAX_FILES_PER_ACTION = 5
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024

type SortMode = "UPDATED_DESC" | "UPDATED_ASC" | "CREATED_DESC" | "OPEN_FIRST"

export default function TicketsPage() {
  const {
    loading,
    ticketItems,
    selectedTicket,
    selectedTicketId,
    setSelectedTicketId,
    statusFilter,
    setStatusFilter,
    categoryFilter,
    setCategoryFilter,
    search,
    setSearch,
    listError,
    refetchTickets,
    createTicket,
    updateTicketStatus,
    addComment,
    getAttachmentDownloadUrl,
  } = useTicketsPage()

  const [createOpen, setCreateOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState<TicketCategory>(TICKET_CATEGORIES.QUESTION)
  const [createFiles, setCreateFiles] = useState<File[]>([])
  const [createErrors, setCreateErrors] = useState<{ title?: string; description?: string; category?: string }>({})

  const [commentText, setCommentText] = useState("")
  const [commentFiles, setCommentFiles] = useState<File[]>([])
  const [commentError, setCommentError] = useState<string | null>(null)
  const [sortMode, setSortMode] = useState<SortMode>("UPDATED_DESC")
  const [createUploadProgress, setCreateUploadProgress] = useState<Record<string, number>>({})
  const [commentUploadProgress, setCommentUploadProgress] = useState<Record<string, number>>({})
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [galleryUrls, setGalleryUrls] = useState<string[]>([])
  const [galleryIndex, setGalleryIndex] = useState(0)
  const [galleryLoading, setGalleryLoading] = useState(false)

  const statusValues = useMemo(() => Object.values(TICKET_STATUSES), [])
  const categoryValues = useMemo(() => Object.values(TICKET_CATEGORIES), [])

  const sortedTicketItems = useMemo(() => {
    const copy = [...ticketItems]

    if (sortMode === "UPDATED_DESC") {
      copy.sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
      return copy
    }

    if (sortMode === "UPDATED_ASC") {
      copy.sort((a, b) => +new Date(a.updatedAt) - +new Date(b.updatedAt))
      return copy
    }

    if (sortMode === "CREATED_DESC") {
      copy.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
      return copy
    }

    copy.sort((a, b) => {
      if (a.status === TICKET_STATUSES.OPEN && b.status !== TICKET_STATUSES.OPEN) {
        return -1
      }
      if (a.status !== TICKET_STATUSES.OPEN && b.status === TICKET_STATUSES.OPEN) {
        return 1
      }
      return +new Date(b.updatedAt) - +new Date(a.updatedAt)
    })
    return copy
  }, [ticketItems, sortMode])

  const onCreateSubmit = async () => {
    const nextErrors: { title?: string; description?: string; category?: string } = {}

    if (!title.trim()) {
      nextErrors.title = "Naslov je obavezan."
    }

    if (!description.trim()) {
      nextErrors.description = "Opis je obavezan."
    }

    if (!isTicketCategory(category)) {
      nextErrors.category = "Kategorija je obavezna."
    }

    setCreateErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      return
    }

    await createTicket({
      title: title.trim(),
      description: description.trim(),
      category,
      files: createFiles,
      onUploadProgress: (file, progressPercent) => {
        setCreateUploadProgress((previous) => ({ ...previous, [file.name]: progressPercent }))
      },
    })

    setTitle("")
    setDescription("")
    setCategory(TICKET_CATEGORIES.QUESTION)
    setCreateFiles([])
    setCreateUploadProgress({})
    setCreateErrors({})
    setCreateOpen(false)
  }

  const onCommentSubmit = async () => {
    if (!selectedTicketId) {
      return
    }

    if (!commentText.trim()) {
      setCommentError("Komentar je obavezan.")
      return
    }

    setCommentError(null)
    await addComment(selectedTicketId, commentText.trim(), commentFiles, (file, progressPercent) => {
      setCommentUploadProgress((previous) => ({ ...previous, [file.name]: progressPercent }))
    })
    setCommentText("")
    setCommentFiles([])
    setCommentUploadProgress({})
  }

  const toValidImageFiles = (files: FileList | File[] | null | undefined) => {
    const list = Array.from(files || [])
      .filter((file) => file.type.startsWith("image/"))
      .filter((file) => file.size <= MAX_IMAGE_SIZE_BYTES)
      .slice(0, MAX_FILES_PER_ACTION)

    return list
  }

  const onDropFiles = (event: DragEvent<HTMLDivElement>, scope: "create" | "comment") => {
    event.preventDefault()
    const files = toValidImageFiles(event.dataTransfer.files)

    if (scope === "create") {
      setCreateFiles(files)
      return
    }

    setCommentFiles(files)
  }

  const openAttachmentGallery = async (
    attachmentItems: Array<{ id: string }>,
    selectedAttachmentId: string
  ) => {
    if (!selectedTicket) {
      return
    }

    try {
      setGalleryLoading(true)
      const urls = await Promise.all(
        attachmentItems.map((attachment) => getAttachmentDownloadUrl(selectedTicket.id, attachment.id))
      )

      const nextIndex = Math.max(
        0,
        attachmentItems.findIndex((attachment) => attachment.id === selectedAttachmentId)
      )

      setGalleryUrls(urls)
      setGalleryIndex(nextIndex)
      setGalleryOpen(true)
    } finally {
      setGalleryLoading(false)
    }
  }

  const previousGalleryItem = () => {
    setGalleryIndex((current) => {
      if (galleryUrls.length === 0) {
        return 0
      }

      return current === 0 ? galleryUrls.length - 1 : current - 1
    })
  }

  const nextGalleryItem = () => {
    setGalleryIndex((current) => {
      if (galleryUrls.length === 0) {
        return 0
      }

      return current === galleryUrls.length - 1 ? 0 : current + 1
    })
  }

  useEffect(() => {
    if (!galleryOpen) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setGalleryOpen(false)
        return
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault()
        setGalleryIndex((current) => {
          if (galleryUrls.length === 0) {
            return 0
          }

          return current === 0 ? galleryUrls.length - 1 : current - 1
        })
        return
      }

      if (event.key === "ArrowRight") {
        event.preventDefault()
        setGalleryIndex((current) => {
          if (galleryUrls.length === 0) {
            return 0
          }

          return current === galleryUrls.length - 1 ? 0 : current + 1
        })
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [galleryOpen, galleryUrls.length])

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <Ticket className="h-6 w-6 text-primary" />
              Podrska i Tiketi
            </h1>
            <p className="text-muted-foreground">
              Otvorite tiket, prilozite povratne informacije, postavite pitanje ili predlozite ideju.
            </p>
          </div>

          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Novi tiket
          </Button>
        </div>

        <Card>
          <CardContent className="grid gap-3 pt-6 md:grid-cols-4">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Pretraga po naslovu ili opisu"
            />

            <Select
              value={statusFilter}
              onValueChange={(value) => {
                if (value === "ALL" || isTicketStatus(value)) {
                  setStatusFilter(value)
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Svi statusi</SelectItem>
                {statusValues.map((status) => (
                  <SelectItem key={status} value={status}>
                    <span className={`inline-flex items-center gap-2 ${getTicketStatusTextClass(status)}`}>
                      <StatusIcon status={status} className="h-4 w-4" />
                      {getTicketStatusLabel(status)}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={categoryFilter}
              onValueChange={(value) => {
                if (value === "ALL" || isTicketCategory(value)) {
                  setCategoryFilter(value)
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Kategorija" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Sve kategorije</SelectItem>
                {categoryValues.map((item) => (
                  <SelectItem key={item} value={item}>
                    <span className={`inline-flex items-center gap-2 ${getTicketCategoryTextClass(item)}`}>
                      <CategoryIcon category={item} className="h-4 w-4" />
                      {getTicketCategoryLabel(item)}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="outline" onClick={() => refetchTickets()}>
              Osvezi
            </Button>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-[1.15fr_1.25fr]">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle>Issues</CardTitle>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Filter className="mr-2 h-4 w-4" />
                      Sort
                      <ChevronDown className="ml-2 h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setSortMode("UPDATED_DESC")}>Najnovije azurirani</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSortMode("UPDATED_ASC")}>Najstarije azurirani</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSortMode("CREATED_DESC")}>Najnovije kreirani</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSortMode("OPEN_FIRST")}>Prvo otvoreni</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {loading && ticketItems.length === 0 ? (
                <>
                  <Skeleton className="h-24" />
                  <Skeleton className="h-24" />
                  <Skeleton className="h-24" />
                </>
              ) : listError ? (
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  Greska pri ucitavanju tiketa.
                </div>
              ) : ticketItems.length === 0 ? (
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  Nema tiketa za izabrane filtere.
                </div>
              ) : (
                sortedTicketItems.map((ticket) => (
                  <button
                    key={ticket.id}
                    type="button"
                    onClick={() => setSelectedTicketId(ticket.id)}
                    className={`w-full rounded-lg border px-4 py-3 text-left transition-all ${
                      selectedTicketId === ticket.id
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "hover:border-primary/40 hover:bg-accent"
                    }`}
                  >
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div>
                        <p className="mb-1 text-xs font-medium text-muted-foreground">{getTicketIssueKey(ticket.id)}</p>
                        <p className="line-clamp-2 font-semibold">{ticket.title}</p>
                      </div>
                      <Badge variant={getTicketStatusBadgeVariant(ticket.status)} className="whitespace-nowrap">
                        <StatusIcon status={ticket.status} className="mr-1 h-3.5 w-3.5" />
                        {getTicketStatusLabel(ticket.status)}
                      </Badge>
                    </div>

                    <div className="mb-2 line-clamp-2 text-xs text-muted-foreground">{ticket.description}</div>

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <CategoryIcon category={ticket.category} className="h-3.5 w-3.5" />
                        {getTicketCategoryLabel(ticket.category)}
                      </span>
                      <span>{formatDateTime(ticket.updatedAt)}</span>
                    </div>
                  </button>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Detalji tiketa</CardTitle>
            </CardHeader>
            <CardContent>
              {!selectedTicket ? (
                <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
                  Izaberite tiket da vidite detalje, status i komentare.
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{getTicketIssueKey(selectedTicket.id)}</Badge>
                      <h2 className="text-lg font-semibold">{selectedTicket.title}</h2>
                      <Badge variant={getTicketStatusBadgeVariant(selectedTicket.status)}>
                        <StatusIcon status={selectedTicket.status} className="mr-1 h-3.5 w-3.5" />
                        {getTicketStatusLabel(selectedTicket.status)}
                      </Badge>
                      <Badge variant="outline" className="gap-1">
                        <CategoryIcon category={selectedTicket.category} className="h-3.5 w-3.5" />
                        {getTicketCategoryLabel(selectedTicket.category)}
                      </Badge>
                    </div>

                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">{selectedTicket.description}</p>

                    <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
                      <p className="mb-1 inline-flex items-center gap-1">
                        <UserRound className="h-3.5 w-3.5" />
                        Otvorio: {formatTicketActor(selectedTicket.createdBy)}
                      </p>
                      <p>Kreirano: {formatDateTime(selectedTicket.createdAt)}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">Status:</span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                          <StatusIcon status={selectedTicket.status} className="mr-2 h-4 w-4" />
                          {getTicketStatusLabel(selectedTicket.status)}
                          <ChevronDown className="ml-2 h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        {statusValues.map((status) => (
                          <DropdownMenuItem
                            key={status}
                            onClick={() => updateTicketStatus(selectedTicket.id, status)}
                            className={status === selectedTicket.status ? "bg-accent" : ""}
                          >
                            <StatusIcon status={status} className="h-4 w-4" />
                            {getTicketStatusLabel(status)}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {selectedTicket.attachments.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Prilozi na tiketu</p>
                      <div className="space-y-2">
                        {selectedTicket.attachments.map((attachment) => (
                            <button
                              key={attachment.id}
                              type="button"
                              className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm hover:bg-accent"
                              onClick={() => openAttachmentGallery(selectedTicket.attachments, attachment.id)}
                            >
                            <span className="inline-flex items-center gap-2">
                              <FileImage className="h-4 w-4 text-muted-foreground" />
                              {attachment.fileName}
                            </span>
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <Separator />

                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <MessageSquare className="h-4 w-4" />
                      Komentari
                    </div>

                    <div className="space-y-3">
                      {selectedTicket.comments.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nema komentara za ovaj tiket.</p>
                      ) : (
                        selectedTicket.comments.map((comment) => (
                          <div key={comment.id} className="rounded-md border p-3">
                            <p className="mb-2 text-xs text-muted-foreground">
                              <span className="inline-flex items-center gap-1">
                                <UserRound className="h-3.5 w-3.5" />
                                {formatTicketActor(comment.author)}
                              </span>
                              <span className="mx-2">•</span>
                              {formatDateTime(comment.createdAt)}
                            </p>
                            <p className="whitespace-pre-wrap text-sm">{comment.content}</p>

                            {comment.attachments.length > 0 ? (
                              <div className="mt-2 space-y-1">
                                {comment.attachments.map((attachment) => (
                                  <button
                                    key={attachment.id}
                                    type="button"
                                    className="flex w-full items-center justify-between rounded border px-2 py-1 text-left text-xs hover:bg-accent"
                                    onClick={() => openAttachmentGallery(comment.attachments, attachment.id)}
                                  >
                                    <span className="inline-flex items-center gap-2">
                                      <FileImage className="h-3.5 w-3.5 text-muted-foreground" />
                                      {attachment.fileName}
                                    </span>
                                    <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                                  </button>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="space-y-3 rounded-md border p-3">
                    <Label htmlFor="ticket-comment">
                      Dodaj komentar <span className="text-destructive">*</span>
                    </Label>
                    <Textarea
                      id="ticket-comment"
                      value={commentText}
                      onChange={(event) => {
                        setCommentText(event.target.value)
                        if (event.target.value.trim()) {
                          setCommentError(null)
                        }
                      }}
                      placeholder="Unesite komentar"
                    />
                    {commentError ? <p className="text-xs text-destructive">{commentError}</p> : null}

                    <div
                      className="space-y-2 rounded-md border border-dashed border-muted-foreground/30 p-3"
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => onDropFiles(event, "comment")}
                    >
                      <Label htmlFor="comment-files">Slike (max {MAX_FILES_PER_ACTION})</Label>
                      <Input
                        id="comment-files"
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        multiple
                        onChange={(event) => {
                          const files = Array.from(event.target.files || []).slice(0, MAX_FILES_PER_ACTION)
                          setCommentFiles(files)
                        }}
                      />
                      {commentFiles.length > 0 ? (
                        <div className="space-y-1">
                          {commentFiles.map((file) => (
                            <div key={file.name} className="flex items-center justify-between text-xs text-muted-foreground">
                              <span className="truncate">{file.name}</span>
                              <span>{commentUploadProgress[file.name] ?? 0}%</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">Prevuci slike ovde ili izaberi fajlove.</p>
                      )}
                    </div>

                    <Button onClick={onCommentSubmit} disabled={loading}>
                      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Dodaj komentar
                    </Button>
                    {galleryLoading ? <p className="text-xs text-muted-foreground">Ucitavanje galerije...</p> : null}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="sm:max-w-[680px]">
            <DialogHeader>
              <DialogTitle>Novi tiket</DialogTitle>
              <DialogDescription>Prijavite bug, predlog ili pitanje ka timu za podrsku.</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ticket-title">
                  Naslov <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="ticket-title"
                  value={title}
                  onChange={(event) => {
                    setTitle(event.target.value)
                    if (event.target.value.trim()) {
                      setCreateErrors((previous) => ({ ...previous, title: undefined }))
                    }
                  }}
                  placeholder="Kratak naslov problema"
                />
                {createErrors.title ? <p className="text-xs text-destructive">{createErrors.title}</p> : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="ticket-description">
                  Opis <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="ticket-description"
                  value={description}
                  onChange={(event) => {
                    setDescription(event.target.value)
                    if (event.target.value.trim()) {
                      setCreateErrors((previous) => ({ ...previous, description: undefined }))
                    }
                  }}
                  placeholder="Detaljno opisi problem ili predlog"
                />
                {createErrors.description ? (
                  <p className="text-xs text-destructive">{createErrors.description}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label>
                  Kategorija <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={category}
                  onValueChange={(value) => {
                    if (isTicketCategory(value)) {
                      setCategory(value)
                      setCreateErrors((previous) => ({ ...previous, category: undefined }))
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Izaberite kategoriju" />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryValues.map((item) => (
                      <SelectItem key={item} value={item}>
                        <span className={`inline-flex items-center gap-2 ${getTicketCategoryTextClass(item)}`}>
                          <CategoryIcon category={item} className="h-4 w-4" />
                          {getTicketCategoryLabel(item)}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {createErrors.category ? <p className="text-xs text-destructive">{createErrors.category}</p> : null}
              </div>

              <div
                className="space-y-2 rounded-md border border-dashed border-muted-foreground/30 p-3"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => onDropFiles(event, "create")}
              >
                <Label htmlFor="ticket-files">Slike (max {MAX_FILES_PER_ACTION})</Label>
                <Input
                  id="ticket-files"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  multiple
                  onChange={(event) => {
                    const files = Array.from(event.target.files || []).slice(0, MAX_FILES_PER_ACTION)
                    setCreateFiles(files)
                  }}
                />
                {createFiles.length > 0 ? (
                  <div className="space-y-1">
                    {createFiles.map((file) => (
                      <div key={file.name} className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="truncate">{file.name}</span>
                        <span>{createUploadProgress[file.name] ?? 0}%</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Prevuci slike ovde ili izaberi fajlove.</p>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setCreateOpen(false)}>
                  Odustani
                </Button>
                <Button onClick={onCreateSubmit} disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  Kreiraj tiket
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={galleryOpen} onOpenChange={setGalleryOpen}>
          <DialogContent className="sm:max-w-[880px]">
            <DialogHeader>
              <DialogTitle>Pregled slika</DialogTitle>
              <DialogDescription>
                {galleryUrls.length > 1
                  ? `Slika ${galleryIndex + 1} od ${galleryUrls.length}`
                  : "Jedna slika u prilogu"}
              </DialogDescription>
            </DialogHeader>

            <div className="relative flex items-center justify-center rounded-md border bg-muted/30 p-3">
              {galleryUrls.length > 0 ? (
                <Image
                  src={galleryUrls[galleryIndex]}
                  alt={`Prilog ${galleryIndex + 1}`}
                  width={1400}
                  height={900}
                  unoptimized
                  className="max-h-[70vh] w-auto max-w-full rounded-md object-contain"
                />
              ) : (
                <p className="text-sm text-muted-foreground">Nema dostupnih slika.</p>
              )}

              {galleryUrls.length > 1 ? (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="absolute left-3 top-1/2 -translate-y-1/2"
                    onClick={previousGalleryItem}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    onClick={nextGalleryItem}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </>
              ) : null}
            </div>

            {galleryUrls.length > 1 ? (
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {galleryUrls.map((url, index) => (
                  <button
                    key={`${url}-${index}`}
                    type="button"
                    onClick={() => setGalleryIndex(index)}
                    className={`relative h-16 w-24 shrink-0 overflow-hidden rounded border transition-colors ${
                      index === galleryIndex ? "border-primary ring-2 ring-primary/30" : "border-border"
                    }`}
                  >
                    <Image
                      src={url}
                      alt={`Thumbnail ${index + 1}`}
                      fill
                      unoptimized
                      sizes="96px"
                      className="object-cover"
                    />
                  </button>
                ))}
              </div>
            ) : null}

            {galleryUrls.length > 1 ? (
              <p className="text-xs text-muted-foreground">Navigacija: strelice levo/desno na tastaturi.</p>
            ) : null}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  )
}

function StatusIcon({ status, className }: { status: TicketStatus; className?: string }) {
  if (status === TICKET_STATUSES.OPEN) {
    return <AlertCircle className={className} />
  }

  if (status === TICKET_STATUSES.IN_PROGRESS) {
    return <Wrench className={className} />
  }

  if (status === TICKET_STATUSES.RESOLVED) {
    return <CheckCircle2 className={className} />
  }

  return <XCircle className={className} />
}

function CategoryIcon({ category, className }: { category: TicketCategory; className?: string }) {
  if (category === TICKET_CATEGORIES.BUG) {
    return <Bug className={className} />
  }

  if (category === TICKET_CATEGORIES.IDEA) {
    return <Lightbulb className={className} />
  }

  if (category === TICKET_CATEGORIES.FEATURE) {
    return <Sparkles className={className} />
  }

  if (category === TICKET_CATEGORIES.QUESTION) {
    return <CircleHelp className={className} />
  }

  return <FileImage className={className} />
}
