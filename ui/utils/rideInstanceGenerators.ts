import { generateRideInstances } from "@/utils/rideInstanceHelpers"
import type { Ride, RideInstance } from "@/types"

export function generateRideInstancesForRide(ride: Ride): RideInstance[] {
  return generateRideInstances(ride)
}
