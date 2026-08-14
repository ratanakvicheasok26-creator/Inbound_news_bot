import Stripe from "stripe"
import { PLANS } from "./plans"
import type { MembershipPlan } from "./plans"

export type { MembershipPlan }
export { PLANS }

export type MembershipStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "unpaid"

export type Membership = {
  user_id: string
  plan: MembershipPlan
  status: MembershipStatus
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  current_period_start: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean
}

const stripeKey = process.env.STRIPE_SECRET_KEY || ""
export const isStripeConfigured = Boolean(stripeKey)

export const stripe = isStripeConfigured ? new Stripe(stripeKey) : null

export function priceIdFor(plan: MembershipPlan): string {
  return plan === "pro_monthly"
    ? process.env.STRIPE_PRICE_PRO_MONTHLY || ""
    : process.env.STRIPE_PRICE_PREMIUM_YEARLY || ""
}

export function planFromPriceId(priceId: string): MembershipPlan | null {
  if (priceId && priceId === process.env.STRIPE_PRICE_PRO_MONTHLY) return "pro_monthly"
  if (priceId && priceId === process.env.STRIPE_PRICE_PREMIUM_YEARLY) return "premium_yearly"
  return null
}
