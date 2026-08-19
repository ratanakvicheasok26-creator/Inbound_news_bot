import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/api-auth"
import { createUserClient } from "@/lib/supabase-server"
import { isStripeConfigured, stripe } from "@/lib/stripe"

function originOf(req: NextRequest): string {
  return req.headers.get("origin") || "https://inbound-report.vercel.app"
}

/** Open Stripe Billing portal for the user's existing subscription. */
export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req)
  if (!auth) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  if (!isStripeConfigured || !stripe) {
    return NextResponse.json({ error: "payments_not_configured" }, { status: 503 })
  }

  try {
    const supabase = createUserClient(`Bearer ${auth.token}`)
    const { data: membership } = await supabase
      .from("memberships")
      .select("stripe_customer_id")
      .eq("user_id", auth.user.id)
      .maybeSingle()

    const customerId = (membership as { stripe_customer_id: string | null } | null)
      ?.stripe_customer_id
    if (!customerId) {
      return NextResponse.json({ error: "no_subscription" }, { status: 404 })
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${originOf(req)}/account?tab=membership`,
    })
    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error("portal error:", err)
    return NextResponse.json({ error: "portal_failed" }, { status: 500 })
  }
}
