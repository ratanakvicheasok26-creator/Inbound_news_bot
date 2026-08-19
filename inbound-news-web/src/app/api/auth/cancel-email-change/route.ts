import { NextResponse } from "next/server"

export async function GET() {
  // With Supabase Auth, email changes are handled directly through
  // supabase.auth.updateUser({ email }). Cancellation is not needed.
  return NextResponse.json({
    ok: true,
    message: "Email change cancellation handled by Supabase Auth",
  })
}
