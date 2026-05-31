"use client"

import { useState } from "react"
import { passengersControllerCheckDuplicates } from "@/infrastructure/generated/surp-api"
import type { PassengerFormData } from "@/types"
import type { PassengerResponseDto } from "@/infrastructure/generated/model/passengerResponseDto"

interface UseDuplicatePassengerCheckParams {
  onConfirmedCreate: (data: PassengerFormData) => Promise<void>
}

export function useDuplicatePassengerCheck({
  onConfirmedCreate,
}: UseDuplicatePassengerCheckParams) {
  const [pendingData, setPendingData] = useState<PassengerFormData | null>(null)
  const [matches, setMatches] = useState<PassengerResponseDto[]>([])
  const [checking, setChecking] = useState(false)

  const start = async (data: PassengerFormData) => {
    setChecking(true)
    try {
      const response = await passengersControllerCheckDuplicates({
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
      })
      const candidates =
        response.status === 200 && response.data
          ? response.data.matches
          : []
      if (candidates.length > 0) {
        setPendingData(data)
        setMatches(candidates)
        return
      }
      await onConfirmedCreate(data)
    } finally {
      setChecking(false)
    }
  }

  const confirm = async () => {
    if (!pendingData) return
    const data = pendingData
    setPendingData(null)
    setMatches([])
    await onConfirmedCreate(data)
  }

  const cancel = () => {
    setPendingData(null)
    setMatches([])
  }

  return {
    start,
    confirm,
    cancel,
    isOpen: pendingData !== null,
    matches,
    checking,
  }
}
