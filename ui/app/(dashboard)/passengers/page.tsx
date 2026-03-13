"use client"

import { useState } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { Layout } from "@/components/layout/Layout"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Mail, Pencil, Phone, Plus, Settings2, Trash2, UserRound, Users } from "lucide-react"
import { usePassengersStore } from "@/stores/passengersStore"
import { PassengerModal } from "@/components/passengers/PassengerModal"
import { DeletePassengerDialog } from "@/components/passengers/DeletePassengerDialog"
import { DataTable } from "@/components/ui/data-table"
import type { Passenger } from "@/types"

const passengerTypeLabels: Record<Passenger["passengerType"], string> = {
  dete: "Dete",
  odrasli: "Odrasli",
  student: "Student",
  penzioner: "Penzioner",
}

export default function PassengersPage() {
  const { passengers, loading } = usePassengersStore()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedPassenger, setSelectedPassenger] = useState<Passenger | null>(null)
  const [passengerToDelete, setPassengerToDelete] = useState<Passenger | null>(null)

  const handleEdit = (passenger: Passenger) => {
    setSelectedPassenger(passenger)
    setIsModalOpen(true)
  }

  const handleDelete = (passenger: Passenger) => {
    setPassengerToDelete(passenger)
    setIsDeleteDialogOpen(true)
  }

  const handleAddNew = () => {
    setSelectedPassenger(null)
    setIsModalOpen(true)
  }

  const handleModalClose = () => {
    setIsModalOpen(false)
    setSelectedPassenger(null)
  }

  const columns: ColumnDef<Passenger>[] = [
    {
      accessorFn: (row) => `${row.firstName} ${row.lastName}`,
      id: "fullName",
      header: () => (
        <div className="inline-flex items-center gap-1">
          <UserRound className="h-4 w-4 text-muted-foreground" />
          Ime i prezime
        </div>
      ),
      cell: ({ row }) => (
        <div className="font-semibold text-primary">
          {row.original.firstName} {row.original.lastName}
        </div>
      ),
    },
    {
      accessorKey: "phone",
      header: () => (
        <div className="inline-flex items-center gap-1">
          <Phone className="h-4 w-4 text-muted-foreground" />
          Telefon
        </div>
      ),
    },
    {
      accessorKey: "email",
      header: () => (
        <div className="inline-flex items-center gap-1">
          <Mail className="h-4 w-4 text-muted-foreground" />
          Email
        </div>
      ),
      cell: ({ row }) =>
        row.original.email || <span className="text-muted-foreground">-</span>,
    },
    {
      accessorKey: "passengerType",
      header: () => (
        <div className="inline-flex items-center gap-1">
          <Users className="h-4 w-4 text-muted-foreground" />
          Tip putnika
        </div>
      ),
      cell: ({ row }) => (
        <Badge variant="secondary">
          {passengerTypeLabels[row.original.passengerType]}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: () => (
        <div className="inline-flex items-center justify-end gap-1 text-right">
          <Settings2 className="h-4 w-4 text-muted-foreground" />
          Akcije
        </div>
      ),
      cell: ({ row }) => {
        const passenger = row.original

        return (
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleEdit(passenger)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleDelete(passenger)}
              className="text-danger hover:text-danger hover:bg-danger/10"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )
      },
    },
  ]

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <Users className="h-6 w-6 text-primary" />
              Putnici
            </h1>
            <p className="text-muted-foreground">
              Upravljajte putnicima u sistemu
            </p>
          </div>
          <Button onClick={handleAddNew}>
            <Plus className="mr-2 h-4 w-4" />
            Dodaj Putnika
          </Button>
        </div>

        {loading && passengers.length === 0 ? (
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : passengers.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12">
            <Users className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-lg font-medium text-muted-foreground">
              Nema putnika
            </p>
            <p className="mb-4 text-sm text-muted-foreground">
              Dodajte prvog putnika da biste počeli
            </p>
            <Button onClick={handleAddNew}>
              <Plus className="mr-2 h-4 w-4" />
              Dodaj Putnika
            </Button>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={passengers}
            noResultsText="Nema putnika"
            searchColumn="fullName"
            searchPlaceholder="Pretraži putnike..."
          />
        )}

        <PassengerModal
          open={isModalOpen}
          onOpenChange={handleModalClose}
          passenger={selectedPassenger}
        />

        <DeletePassengerDialog
          open={isDeleteDialogOpen}
          onOpenChange={setIsDeleteDialogOpen}
          passenger={passengerToDelete}
        />
      </div>
    </Layout>
  )
}
