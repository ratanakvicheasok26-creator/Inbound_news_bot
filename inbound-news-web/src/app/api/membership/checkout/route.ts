import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest, getUserMembership } from "@/lib/api-auth"
import { isStripeConfigured, priceIdFor, PLANS, stripe } from "@/lib/stripe"
import { isActiveMembership } from "@/lib/plans"
import type { MembershipPlan } from "@/lib/stripe"

function originOf(req: NextRequest): string {
  return req.headers.get("origin") || "https://inbound-report.vercel.app"
}

/** Create a Stripe Checkout session for a subscription. JWT via Authorization. */
export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req)
  if (!auth) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  if (!isStripeConfigured || !stripe) {
    return NextResponse.json({ error: "payments_not_configured" }, { status: 503 })
  }

  let body: { plan?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 })
  }

  const plan = body.plan as MembershipPlan | undefined
  if (!plan || !PLANS[plan]) {
    return NextResponse.json({ error: "invalid_plan" }, { status: 400 })
  }
  const priceId = priceIdFor(plan)
  if (!priceId) {
    return NextResponse.json({ error: "price_not_configured" }, { status: 503 })
  }

  const existing = await getUserMembership(req)
  if (existing && isActiveMembership(existing)) {
    if (existing.plan === plan) {
      return NextResponse.json({ error: "already_member" }, { status: 409 })
    }
  }

  try {
    let customerId = existing?.stripe_customer_id || null
    if (!customerId) {
      try {
        const customers = await stripe.customers.list({
          email: auth.user.email,
          limit: 1,
        })
        customerId = customers.data[0]?.id || null
      } catch (e) {
        console.error("checkout customer lookup error:", e)
      }
    }
    if (!customerId) {
      try {
        const customer = await stripe.customers.create({
          email: auth.user.email || undefined,
          name: auth.user.user_metadata?.display_name || undefined,
          metadata: { user_id: auth.user.id },
        })
        customerId = customer.id
      } catch (e) {
        console.error("checkout customer create error:", e)
        return NextResponse.json({ error: "checkout_failed" }, { status: 500 })
      }
    }

    let session
    try {
      session = await stripe.checkout.sessions.create({
        mode: "subscription",
        client_reference_id: auth.user.id,
        customer: customerId,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${originOf(req)}/account?tab=membership&paid=1`,
        cancel_url: `${originOf(req)}/pricing`,
        metadata: { plan, user_id: auth.user.id },
        subscription_data: {
          metadata: { plan, user_id: auth.user.id },
        },
      })
    } catch (e) {
      console.error("checkout session create error:", e)
      return NextResponse.json({ error: "checkout_failed" }, { status: 500 })
    }

    if (!session.url) {
      return NextResponse.json({ error: "checkout_failed" }, { status: 500 })
    }
    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error("checkout error:", err)
    return NextResponse.json({ error: "checkout_failed" }, { status: 500 })
  }
}
