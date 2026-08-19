import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase-route"

export async function POST() {
  try {
    const supabase = await createServerClient()
    const { error } = await supabase.auth.getSession()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}
