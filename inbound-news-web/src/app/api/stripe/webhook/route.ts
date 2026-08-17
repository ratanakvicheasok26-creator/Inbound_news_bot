import { NextRequest, NextResponse } from "next/server"
import type Stripe from "stripe"
import { isStripeConfigured, planFromPriceId, stripe } from "@/lib/stripe"
import { supabaseAdmin } from "@/lib/supabase-server"
import type { Membership, MembershipPlan, MembershipStatus } from "@/lib/stripe"

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || ""

type MembershipRow = Omit<Membership, "stripe_customer_id" | "stripe_subscription_id">

function toRow(
  sub: Stripe.Subscription,
  userId: string,
  customerId: string | null,
): MembershipRow & { stripe_customer_id: string | null; stripe_subscription_id: string | null } {
  const priceId = sub.items.data[0]?.price?.id ?? ""
  const plan = planFromPriceId(priceId) || ("pro_monthly" as MembershipPlan)
  const item = sub.items.data[0]
  return {
    user_id: userId,
    plan,
    status: sub.status as MembershipStatus,
    stripe_customer_id: customerId,
    stripe_subscription_id: sub.id,
    current_period_start: item?.current_period_start
      ? new Date(item.current_period_start * 1000).toISOString()
      : null,
    current_period_end: item?.current_period_end
      ? new Date(item.current_period_end * 1000).toISOString()
      : null,
    cancel_at_period_end: sub.cancel_at_period_end,
  }
}

async function upsertFromSubscription(sub: Stripe.Subscription, userId?: string | null) {
  if (!supabaseAdmin) return
  let uid = userId || null

  if (!uid) {
    const { data: bySub } = await supabaseAdmin
      .from("memberships")
      .select("user_id")
      .eq("stripe_subscription_id", sub.id)
      .maybeSingle()
    uid = (bySub as { user_id: string } | null)?.user_id ?? null
  }
  if (!uid && sub.customer) {
    const { data: byCustomer } = await supabaseAdmin
      .from("memberships")
      .select("user_id")
      .eq("stripe_customer_id", String(sub.customer))
      .maybeSingle()
    uid = (byCustomer as { user_id: string } | null)?.user_id ?? null
  }
  if (!uid) return

  const row = toRow(sub, uid, String(sub.customer || ""))
  await supabaseAdmin
    .from("memberships")
    .upsert(row, { onConflict: "user_id" })
}

/** Stripe webhook — sync subscription state into `memberships`. */
export async function POST(req: NextRequest) {
  if (!isStripeConfigured || !stripe) {
    return NextResponse.json({ error: "payments_not_configured" }, { status: 503 })
  }
  if (!webhookSecret) {
    return NextResponse.json({ error: "webhook_not_configured" }, { status: 503 })
  }

  const rawBody = await req.text()
  const signature = req.headers.get("stripe-signature")
  if (!signature) {
    return NextResponse.json({ error: "missing_signature" }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
  } catch (err) {
    console.error("webhook signature error:", err)
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 })
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode !== "subscription" || !session.subscription) break
        const sub = await stripe.subscriptions.retrieve(String(session.subscription))
        await upsertFromSubscription(sub, session.client_reference_id)
        break
      }
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription
        await upsertFromSubscription(sub)
        break
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription
        if (supabaseAdmin) {
          await supabaseAdmin
            .from("memberships")
            .update({ status: "canceled", updated_at: new Date().toISOString() })
            .eq("stripe_subscription_id", sub.id)
        }
        break
      }
      default:
        break
    }
  } catch (err) {
    console.error("webhook handler error:", err)
    return NextResponse.json({ error: "handler_failed" }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
