import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase-route"

export async function POST() {
  try {
    const supabase = await createServerClient()
    await supabase.auth.signOut()
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true })
  }
}
