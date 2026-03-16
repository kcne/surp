import { formatDateToISO, generateRideInstanceDates } from "@/utils/dateHelpers"
import type { Ride, RideInstance } from "@/types"

export function generateRideInstancesForRide(ride: Ride): RideInstance[] {
  const instances: RideInstance[] = []

  if (ride.type === "recurring") {
    if (!ride.startDate || !ride.daysOfWeek || ride.daysOfWeek.length === 0) {
      return instances
    }

    const startDate = new Date(`${ride.startDate}T00:00:00`)
    const endDate = ride.endDate ? new Date(`${ride.endDate}T00:00:00`) : null
    const threeMonthsFromNow = new Date()
    threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3)

    const effectiveEndDate =
      endDate && endDate < threeMonthsFromNow ? endDate : threeMonthsFromNow

    const dates = generateRideInstanceDates(startDate, effectiveEndDate, ride.daysOfWeek)

    dates.forEach((date) => {
      const dateString = formatDateToISO(date)
      const exception = ride.exceptions?.find((ex) => ex.date === dateString)

      if (exception?.type === "skip") {
        return
      }

      const dayOfWeek = date.getDay()

      let departureTime: string | undefined
      let arrivalTime: string | undefined

      if (exception?.type === "additional") {
        departureTime = exception.departureTime
        arrivalTime = exception.arrivalTime
      } else if (ride.dayTimes && ride.dayTimes[dayOfWeek]) {
        departureTime = ride.dayTimes[dayOfWeek].departureTime
        arrivalTime = ride.dayTimes[dayOfWeek].arrivalTime
      } else if (ride.departureTime && ride.arrivalTime) {
        departureTime = ride.departureTime
        arrivalTime = ride.arrivalTime
      }

      if (!departureTime || !arrivalTime) {
        return
      }

      instances.push({
        id: `${ride.id}-${dateString}`,
        rideId: ride.id,
        ride,
        date: dateString,
        departureTime,
        arrivalTime,
        status: ride.status,
        reservationCount: 0,
        availableSeats: ride.busCapacity,
      })
    })
  } else if (
    ride.type === "one-time" &&
    ride.date &&
    ride.oneTimeDepartureTime &&
    ride.oneTimeArrivalTime
  ) {
    instances.push({
      id: `${ride.id}-${ride.date}`,
      rideId: ride.id,
      ride,
      date: ride.date,
      departureTime: ride.oneTimeDepartureTime,
      arrivalTime: ride.oneTimeArrivalTime,
      status: ride.status,
      reservationCount: 0,
      availableSeats: ride.busCapacity,
    })
  }

  return instances
}
