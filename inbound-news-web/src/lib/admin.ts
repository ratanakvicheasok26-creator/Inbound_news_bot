import type { NextRequest } from "next/server"
import type { User } from "@supabase/supabase-js"
import { authenticateRequest } from "./api-auth"

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean)

/** The authenticated admin, or null when the caller isn't listed in ADMIN_EMAILS. */
export async function adminUser(
  req: NextRequest,
): Promise<{ user: User; token: string } | null> {
  const auth = await authenticateRequest(req)
  if (!auth?.user?.email) return null
  return ADMIN_EMAILS.includes(auth.user.email.toLowerCase()) ? auth : null
}

/** True when the caller is authenticated and listed in ADMIN_EMAILS. */
export async function isAdminRequest(req: NextRequest): Promise<boolean> {
  return (await adminUser(req)) !== null
}
