import type {
  LoginDto,
  LoginResponseDto,
  LoginUserDto,
  PlatformTenantLoginOptionResponseDto,
} from "@/infrastructure/generated/model"
import type { TenantScoped } from "@/infrastructure/types/request.types"

export type PlatformTenantLoginOption = PlatformTenantLoginOptionResponseDto

export type LoginRequestPayload = TenantScoped<LoginDto>

export type AuthUserDto = LoginUserDto
export type AuthLoginResponseDto = LoginResponseDto
