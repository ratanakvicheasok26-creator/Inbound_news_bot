import type { NextRequest } from "next/server"
import { authenticateRequest, type AuthContext } from "./api-auth"

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean)

export async function adminUser(
  req: NextRequest,
): Promise<AuthContext | null> {
  const auth = await authenticateRequest(req)
  if (!auth?.user?.email) return null
  return ADMIN_EMAILS.includes(auth.user.email.toLowerCase()) ? auth : null
}

export async function isAdminRequest(req: NextRequest): Promise<boolean> {
  return (await adminUser(req)) !== null
}
