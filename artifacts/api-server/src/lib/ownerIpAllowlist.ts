import User from "../models/User";

/**
 * Returns true if the given IP has ever been associated with an owner-role
 * account's login (current or historical). Used to exempt shared-IP accounts
 * from alt-account / multi-accounting detection — the owner legitimately runs
 * multiple test/alt accounts from their own network, and those must never be
 * flagged as suspicious no matter how many accounts share that IP.
 */
export async function isOwnerAssociatedIp(ip: string | null | undefined): Promise<boolean> {
  if (!ip || ip === "unknown") return false;
  try {
    const owner = await User.findOne({
      role: "owner",
      $or: [{ lastLoginIp: ip }, { loginIpHistory: ip }],
    })
      .select("_id")
      .lean();
    return !!owner;
  } catch {
    // Detection is best-effort — never let a lookup failure block login/entry flows.
    return false;
  }
}
