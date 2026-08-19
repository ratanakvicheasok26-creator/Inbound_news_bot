import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  return NextResponse.redirect(new URL("/auth/callback" + new URL(req.url).search, req.url))
}

export async function POST() {
  return NextResponse.json({ ok: true, message: "Email verification handled by Supabase Auth" })
}
