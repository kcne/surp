import axios from "axios"

const INVALID_LOGIN_CREDENTIALS_MESSAGE = "Korisničko ime ili lozinka nisu ispravni. Pokušajte ponovo."
const LOGIN_NETWORK_ERROR_MESSAGE = "Nije moguće povezati se sa serverom. Proverite internet vezu i pokušajte ponovo."
const LOGIN_FALLBACK_ERROR_MESSAGE = "Prijavljivanje nije uspelo. Pokušajte ponovo."
const INACTIVE_USER_MESSAGE = "Vaš nalog je deaktiviran. Obratite se administratoru."
const INACTIVE_TENANT_MESSAGE = "Izabrana agencija je deaktivirana. Obratite se administratoru."
const PASSWORD_CHANGE_REQUIRED_MESSAGE = "Pre prijavljivanja morate promeniti lozinku. Obratite se administratoru."
const LOGIN_FORBIDDEN_MESSAGE = "Prijavljivanje nije dozvoljeno. Obratite se administratoru."

/**
 * Returns a Serbian, actionable message for failures on the login form.
 * API error text is deliberately not exposed here, as it may be technical or
 * arrive in a different language.
 */
export function getLoginErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return LOGIN_NETWORK_ERROR_MESSAGE
    }

    if (error.response.status === 401) {
      return INVALID_LOGIN_CREDENTIALS_MESSAGE
    }

    if (error.response.status === 403) {
      const responseMessage = error.response.data?.message

      if (responseMessage === "User is inactive") {
        return INACTIVE_USER_MESSAGE
      }

      if (responseMessage === "Tenant is inactive") {
        return INACTIVE_TENANT_MESSAGE
      }

      if (responseMessage === "Password change required") {
        return PASSWORD_CHANGE_REQUIRED_MESSAGE
      }

      return LOGIN_FORBIDDEN_MESSAGE
    }
  }

  return LOGIN_FALLBACK_ERROR_MESSAGE
}

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
