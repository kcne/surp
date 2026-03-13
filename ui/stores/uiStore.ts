import { create } from "zustand"

export interface Notification {
  id: string
  message: string
  type: "success" | "error" | "warning" | "info"
  timestamp: number
}

interface UIState {
  sidebarOpen: boolean
  activeModal: string | null
  notifications: Notification[]
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  openModal: (modalName: string) => void
  closeModal: () => void
  showNotification: (message: string, type: Notification["type"]) => void
  removeNotification: (id: string) => void
  clearNotifications: () => void
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  activeModal: null,
  notifications: [],

  toggleSidebar: () => {
    set((state) => ({ sidebarOpen: !state.sidebarOpen }))
  },

  setSidebarOpen: (open: boolean) => {
    set({ sidebarOpen: open })
  },

  openModal: (modalName: string) => {
    set({ activeModal: modalName })
  },

  closeModal: () => {
    set({ activeModal: null })
  },

  showNotification: (message: string, type: Notification["type"]) => {
    const notification: Notification = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      message,
      type,
      timestamp: Date.now(),
    }
    set((state) => ({
      notifications: [...state.notifications, notification],
    }))

    // Auto remove after 5 seconds
    setTimeout(() => {
      set((state) => ({
        notifications: state.notifications.filter((n) => n.id !== notification.id),
      }))
    }, 5000)
  },

  removeNotification: (id: string) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    }))
  },

  clearNotifications: () => {
    set({ notifications: [] })
  },
}))










