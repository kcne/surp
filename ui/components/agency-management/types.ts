import type { CreateUserDto, ResetPasswordDto, UpdateUserDto } from "@/infrastructure/generated/model"

export type AgencyUserRole = "SUPERADMIN" | "ADMIN" | "MANAGER" | "STAFF"

export type AgencyUser = {
  id: string
  username: string
  email: string
  role: AgencyUserRole
  isActive: boolean
}

export type AgencyUserFormData = {
  username: string
  email: string
  role: "MANAGER" | "STAFF"
  password?: string
  isActive: boolean
}

export type CreateAgencyUserPayload = CreateUserDto
export type UpdateAgencyUserPayload = UpdateUserDto
export type ResetAgencyUserPasswordPayload = ResetPasswordDto
export type ResetAgencyUserPasswordFormData = {
  newPassword: string
  requirePasswordChange: boolean
}

export function isEditableAgencyRole(role: AgencyUserRole): boolean {
  return role === "MANAGER" || role === "STAFF"
}
