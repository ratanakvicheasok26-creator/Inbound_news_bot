import { NextRequest, NextResponse } from "next/server"
import { getUserMembership } from "@/lib/api-auth"

/** Current membership for the signed-in user (JWT via Authorization header). */
export async function GET(req: NextRequest) {
  const membership = await getUserMembership(req)
  if (!membership) {
    return NextResponse.json({ membership: null }, { status: 200 })
  }
  return NextResponse.json({ membership })
}
