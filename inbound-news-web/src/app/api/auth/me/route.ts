import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase-route"

export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerClient()

    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    // Fetch profile for display_name
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle()

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        email_verified: !!user.email_confirmed_at,
        display_name:
          (user.user_metadata?.display_name as string) ||
          profile?.display_name ||
          user.email?.split("@")[0] ||
          "Reader",
        created_at: user.created_at,
        user_metadata: user.user_metadata,
      },
    })
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}
