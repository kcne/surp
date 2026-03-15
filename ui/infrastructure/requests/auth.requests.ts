import {
  authControllerLogin,
} from "@/infrastructure/generated/surp-api"
import { buildTenantHeader } from "@/infrastructure/utils/request-context"
import type {
  AuthLoginResponseDto,
  LoginRequestPayload,
} from "@/infrastructure/types/auth.types"

export async function loginRequest(payload: LoginRequestPayload): Promise<AuthLoginResponseDto> {
  const response = await authControllerLogin(
    {
      username: payload.username,
      password: payload.password,
    },
    {
      headers: buildTenantHeader(payload.tenantSlug),
    }
  )

  return response.data as AuthLoginResponseDto
}
