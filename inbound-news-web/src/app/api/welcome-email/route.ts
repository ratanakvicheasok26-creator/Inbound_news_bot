import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(req: NextRequest) {
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ ok: false }, { status: 500 })
  }

  const { email } = await req.json()
  if (!email) {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  const supabase = createClient(supabaseUrl, serviceKey)

  const { data: userData, error: listErr } = await supabase.auth.admin.listUsers()
  if (listErr) {
    return NextResponse.json({ ok: false, error: listErr.message }, { status: 500 })
  }

  const user = userData.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
  if (!user) {
    return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 })
  }

  if (!user.email_confirmed_at) {
    const { error } = await supabase.auth.admin.updateUserById(user.id, {
      email_confirm: true,
    })
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true })
}
