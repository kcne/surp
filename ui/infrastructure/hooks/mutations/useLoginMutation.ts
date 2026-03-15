import { useMutation } from "@tanstack/react-query"
import { loginRequest } from "@/infrastructure/requests/auth.requests"

export function useLoginMutation() {
  return useMutation({
    mutationFn: loginRequest,
  })
}
