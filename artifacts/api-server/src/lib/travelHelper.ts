import User from "../models/User";

/**
 * Auto-completes travel for a user whose travelArrivesAt has passed.
 *
 * Call this after fetching the user document on any route that is
 * gated behind status === "abroad" or currentLocation checks.
 * The user document is mutated in-place and saved if travel is completed.
 *
 * Returns true if travel was completed, false if still in transit or not traveling.
 */
export async function autoCompleteTravel(user: any): Promise<boolean> {
  if (!user.travelingTo || !user.travelArrivesAt) return false;
  if (new Date(user.travelArrivesAt) > new Date()) return false;

  const destination = user.travelingTo as string;
  if (destination === "downtown") {
    user.status          = "normal";
    user.currentLocation = "downtown";
  } else {
    user.status          = "abroad";
    user.currentLocation = destination;
  }
  user.travelingTo    = null;
  user.travelArrivesAt = null;
  await user.save();
  return true;
}
