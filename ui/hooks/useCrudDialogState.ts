import { useState } from "react"

interface UseCrudDialogStateResult<TItem> {
  isModalOpen: boolean
  isDeleteDialogOpen: boolean
  selectedItem: TItem | null
  itemToDelete: TItem | null
  openCreate: () => void
  openEdit: (item: TItem) => void
  closeModal: () => void
  openDelete: (item: TItem) => void
  setIsDeleteDialogOpen: (open: boolean) => void
}

export function useCrudDialogState<TItem>(): UseCrudDialogStateResult<TItem> {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<TItem | null>(null)
  const [itemToDelete, setItemToDelete] = useState<TItem | null>(null)

  const openCreate = () => {
    setSelectedItem(null)
    setIsModalOpen(true)
  }

  const openEdit = (item: TItem) => {
    setSelectedItem(item)
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setSelectedItem(null)
  }

  const openDelete = (item: TItem) => {
    setItemToDelete(item)
    setIsDeleteDialogOpen(true)
  }

  const handleSetDeleteDialogOpen = (open: boolean) => {
    setIsDeleteDialogOpen(open)
    if (!open) {
      setItemToDelete(null)
    }
  }

  return {
    isModalOpen,
    isDeleteDialogOpen,
    selectedItem,
    itemToDelete,
    openCreate,
    openEdit,
    closeModal,
    openDelete,
    setIsDeleteDialogOpen: handleSetDeleteDialogOpen,
  }
}
