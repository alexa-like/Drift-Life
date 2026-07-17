import Business from "../models/Business";
import mongoose from "mongoose";

export interface EmployerPerk {
  type: string;
  starLevel: number;
}

/**
 * Returns the employer's business type & star level if userId is an *active*
 * employee of that business and the business is open. Returns null otherwise.
 *
 * Pass `businessId` straight from user.businessId to avoid an extra User query.
 */
export async function getEmployerPerk(
  userId: string,
  businessId: mongoose.Types.ObjectId | string | null | undefined
): Promise<EmployerPerk | null> {
  if (!businessId) return null;
  const biz = await Business.findOne({
    _id: businessId,
    isOpen: true,
    employees: {
      $elemMatch: {
        userId: new mongoose.Types.ObjectId(userId),
        status: "active",
      },
    },
  })
    .select("type starLevel")
    .lean();
  return biz ? { type: biz.type as string, starLevel: biz.starLevel } : null;
}
