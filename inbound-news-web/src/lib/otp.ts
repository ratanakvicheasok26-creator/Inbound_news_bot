import { createHash, randomInt } from "crypto"
import { supabaseAdmin } from "./supabase-server"

const OTP_EXPIRY_MINUTES = 10
const OTP_LENGTH = 6

export function generateOtp(): string {
  return String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, "0")
}

export function hashOtp(otp: string): string {
  return createHash("sha256").update(otp).digest("hex")
}

export async function storeOtp(
  userId: string,
  email: string,
  otp: string,
): Promise<boolean> {
  if (!supabaseAdmin) return false

  const { error } = await supabaseAdmin.from("email_verifications").insert({
    user_id: userId,
    email,
    token_hash: hashOtp(otp),
    expires_at: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString(),
  })

  if (error) {
    console.error("[OTP] store error:", error.message)
    return false
  }
  return true
}

export async function verifyStoredOtp(
  email: string,
  otp: string,
): Promise<{ valid: boolean; userId?: string; error?: string }> {
  if (!supabaseAdmin) return { valid: false, error: "Auth service unavailable" }

  const tokenHash = hashOtp(otp)
  const now = new Date().toISOString()

  const { data: records, error: fetchError } = await supabaseAdmin
    .from("email_verifications")
    .select("id, user_id, expires_at")
    .eq("email", email)
    .eq("token_hash", tokenHash)
    .gt("expires_at", now)
    .order("created_at", { ascending: false })
    .limit(1)

  if (fetchError) {
    console.error("[OTP] verify fetch error:", fetchError.message)
    return { valid: false, error: "Verification failed" }
  }

  if (!records || records.length === 0) {
    return { valid: false, error: "The verification code is incorrect or has expired." }
  }

  const record = records[0]

  await supabaseAdmin
    .from("email_verifications")
    .delete()
    .eq("id", record.id)

  return { valid: true, userId: record.user_id }
}
