import axios from "axios"

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const responseMessage = error.response?.data?.message

    if (Array.isArray(responseMessage) && responseMessage.length > 0) {
      return String(responseMessage[0])
    }

    if (typeof responseMessage === "string" && responseMessage.length > 0) {
      return responseMessage
    }

    if (typeof error.message === "string" && error.message.length > 0) {
      return error.message
    }

    return fallback
  }

  if (error instanceof Error && error.message.length > 0) {
    return error.message
  }

  return fallback
}
