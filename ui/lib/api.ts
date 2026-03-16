import apiClient from "./axios"
import type {
  User,
  Ride,
  RideInstance,
  Passenger,
  Reservation,
  ApiResponse,
  PaginatedResponse,
} from "@/types"

// Auth API
export const authApi = {
  login: async (username: string, password: string): Promise<ApiResponse<{ user: User; token: string }>> => {
    // TODO: Replace with actual API call
    return {
      data: {
        user: {
          id: "1",
          username,
          name: "Test User",
        },
        token: "mock-token",
      },
    }
  },
  logout: async (): Promise<void> => {
    // TODO: Replace with actual API call
    if (typeof window !== "undefined") {
      localStorage.removeItem("auth_token")
    }
  },
}

// Rides API
export const ridesApi = {
  getAll: async (): Promise<ApiResponse<Ride[]>> => {
    // TODO: Replace with actual API call
    return { data: [] }
  },
  getById: async (id: string): Promise<ApiResponse<Ride>> => {
    // TODO: Replace with actual API call
    throw new Error("Not implemented")
  },
  create: async (data: Ride): Promise<ApiResponse<Ride>> => {
    // TODO: Replace with actual API call
    return { data }
  },
  update: async (id: string, data: Partial<Ride>): Promise<ApiResponse<Ride>> => {
    // TODO: Replace with actual API call
    return { data: { ...data, id } as Ride }
  },
  delete: async (id: string): Promise<ApiResponse<void>> => {
    // TODO: Replace with actual API call
    return { data: undefined }
  },
  getInstances: async (date: string): Promise<ApiResponse<RideInstance[]>> => {
    // TODO: Replace with actual API call
    return { data: [] }
  },
}

// Passengers API
export const passengersApi = {
  getAll: async (): Promise<ApiResponse<Passenger[]>> => {
    // TODO: Replace with actual API call
    return { data: [] }
  },
  search: async (query: string): Promise<ApiResponse<Passenger[]>> => {
    // TODO: Replace with actual API call
    return { data: [] }
  },
  getById: async (id: string): Promise<ApiResponse<Passenger>> => {
    // TODO: Replace with actual API call
    throw new Error("Not implemented")
  },
  create: async (data: Passenger): Promise<ApiResponse<Passenger>> => {
    // TODO: Replace with actual API call
    return { data }
  },
  update: async (id: string, data: Partial<Passenger>): Promise<ApiResponse<Passenger>> => {
    // TODO: Replace with actual API call
    return { data: { ...data, id } as Passenger }
  },
  delete: async (id: string): Promise<ApiResponse<void>> => {
    // TODO: Replace with actual API call
    return { data: undefined }
  },
  getHistory: async (id: string): Promise<ApiResponse<Reservation[]>> => {
    // TODO: Replace with actual API call
    return { data: [] }
  },
}

// Reservations API
export const reservationsApi = {
  getAll: async (rideInstanceId: string): Promise<ApiResponse<Reservation[]>> => {
    // TODO: Replace with actual API call
    return { data: [] }
  },
  getById: async (id: string): Promise<ApiResponse<Reservation>> => {
    // TODO: Replace with actual API call
    throw new Error("Not implemented")
  },
  create: async (data: Reservation): Promise<ApiResponse<Reservation>> => {
    // TODO: Replace with actual API call
    return { data }
  },
  update: async (id: string, data: Partial<Reservation>): Promise<ApiResponse<Reservation>> => {
    // TODO: Replace with actual API call
    return { data: { ...data, id } as Reservation }
  },
  cancel: async (id: string): Promise<ApiResponse<void>> => {
    // TODO: Replace with actual API call
    return { data: undefined }
  },
}










