import { connectDB } from "./db/mongodb";
import { User } from "./db/models/User";

const DEFAULT_QUOTA = 50;

/**
 * Checks and deducts user quota.
 * Returns { allowed: true } if quota is available, otherwise { allowed: false }.
 */
export async function checkAndDeductQuota(userId: string): Promise<{ allowed: boolean; remaining: number }> {
  await connectDB();
  const user = await User.findById(userId);
  if (!user) return { allowed: false, remaining: 0 };

  const now = new Date();
  let needsSave = false;

  // Reset quota if current date is past quotaResetAt
  if (!user.quotaResetAt || now >= user.quotaResetAt) {
    user.aiQuota = DEFAULT_QUOTA;
    
    // Set next reset to the 1st of next month
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    nextMonth.setDate(1);
    nextMonth.setHours(0, 0, 0, 0);
    user.quotaResetAt = nextMonth;
    needsSave = true;
  }

  // Use fallback if field didn't exist previously
  if (user.aiQuota === undefined) {
    user.aiQuota = DEFAULT_QUOTA;
    needsSave = true;
  }

  if (user.aiQuota <= 0) {
    if (needsSave) await user.save();
    return { allowed: false, remaining: 0 };
  }

  // Deduct 1 from quota
  user.aiQuota -= 1;
  await user.save();

  return { allowed: true, remaining: user.aiQuota };
}
