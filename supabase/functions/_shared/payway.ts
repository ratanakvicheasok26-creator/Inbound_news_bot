/**
 * Official ABA PayWay crypto and HTTP helpers.
 *
 * Purchase, KHQR, check-transaction, and webhook verification all use
 * HMAC-SHA512 keyed by ABA_PAYWAY_PUBLIC_KEY (PayWay's name for the merchant
 * API key — it is not an RSA public key).
 *
 * RSA (ABA_PAYWAY_RSA_PUBLIC_KEY / ABA_PAYWAY_RSA_PRIVATE_KEY) is PayWay's
 * merchant_auth scheme: PKCS#1 v1.5 in 117-byte chunks. Used for payment-link
 * and refund APIs, not the purchase hash.
 */

import { Buffer } from "node:buffer"
import {
  constants,
  createPrivateKey,
  createPublicKey,
  privateDecrypt,
  publicEncrypt,
} from "node:crypto"

export type PaywayCurrency = "USD" | "KHR"
export type PaywayPlan = "pro_monthly" | "premium_yearly"

export const PLAN_CATALOG: Record<
  PaywayPlan,
  { amountUsd: number; months: number; itemName: string }
> = {
  pro_monthly: { amountUsd: 7.99, months: 1, itemName: "Inbound Reports Pro (monthly)" },
  premium_yearly: { amountUsd: 49.99, months: 12, itemName: "Inbound Reports Premium (yearly)" },
}

export type PaywaySecrets = {
  merchantId: string
  apiUrl: string
  hmacKey: string
  rsaPublicPem: string | null
  rsaPrivatePem: string | null
  siteUrl: string
  webhookUrl: string
}

export function isPaywayPlan(value: string): value is PaywayPlan {
  return value === "pro_monthly" || value === "premium_yearly"
}

export function utcReqTime(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}`
  )
}

export function formatAmount(amount: number, currency: PaywayCurrency): string {
  if (currency === "KHR") return String(Math.round(amount))
  return amount.toFixed(2)
}

export function newTranId(): string {
  const t = Date.now().toString(36)
  const r = crypto.randomUUID().replace(/-/g, "").slice(0, 8)
  return `pw${t}${r}`.slice(0, 20)
}

export function toBase64(value: string): string {
  return btoa(unescape(encodeURIComponent(value)))
}

export function loadPaywaySecrets(): PaywaySecrets {
  const merchantId = Deno.env.get("ABA_PAYWAY_MERCHANT_ID")?.trim() ?? ""
  const apiUrl = (Deno.env.get("ABA_PAYWAY_API_URL")?.trim() ?? "https://checkout-sandbox.payway.com.kh").replace(
    /\/+$/,
    "",
  )
  const hmacKey = Deno.env.get("ABA_PAYWAY_PUBLIC_KEY")?.trim() ?? ""
  const rsaPublicPem = normalizePem(Deno.env.get("ABA_PAYWAY_RSA_PUBLIC_KEY") ?? "", "PUBLIC KEY")
  const rsaPrivatePem = normalizePem(Deno.env.get("ABA_PAYWAY_RSA_PRIVATE_KEY") ?? "", "PRIVATE KEY")
  const siteUrl = (Deno.env.get("SITE_URL") ?? Deno.env.get("APP_URL") ?? "").replace(/\/+$/, "")
  const supabaseUrl = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/+$/, "")
  const webhookUrl =
    Deno.env.get("PAYWAY_WEBHOOK_URL")?.trim() ||
    (supabaseUrl ? `${supabaseUrl}/functions/v1/payway-webhook-callback` : "")

  if (!merchantId || !hmacKey || !apiUrl) {
    throw new Error("payway_not_configured")
  }
  return { merchantId, apiUrl, hmacKey, rsaPublicPem, rsaPrivatePem, siteUrl, webhookUrl }
}

export async function hmacSha512Raw(secret: string, message: string): Promise<Uint8Array> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  )
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message))
  return new Uint8Array(sig)
}

export async function hmacSha512Base64(secret: string, message: string): Promise<string> {
  return bytesToBase64(await hmacSha512Raw(secret, message))
}

export async function hmacSha512Hex(secret: string, message: string): Promise<string> {
  return bytesToHex(await hmacSha512Raw(secret, message))
}

export async function purchaseHash(fields: Record<string, string>, hmacKey: string): Promise<string> {
  const order = [
    "req_time",
    "merchant_id",
    "tran_id",
    "amount",
    "items",
    "shipping",
    "firstname",
    "lastname",
    "email",
    "phone",
    "type",
    "payment_option",
    "return_url",
    "cancel_url",
    "continue_success_url",
    "return_deeplink",
    "currency",
    "custom_fields",
    "return_params",
    "payout",
    "lifetime",
    "additional_params",
    "google_pay_token",
    "skip_success_page",
  ]
  return hmacSha512Base64(hmacKey, order.map((k) => fields[k] ?? "").join(""))
}

export async function checkTransactionHash(
  reqTime: string,
  merchantId: string,
  tranId: string,
  hmacKey: string,
): Promise<string> {
  return hmacSha512Base64(hmacKey, `${reqTime}${merchantId}${tranId}`)
}

export function concatKsortValues(payload: Record<string, unknown>): string {
  const keys = Object.keys(payload).sort()
  let out = ""
  for (const key of keys) {
    const value = payload[key]
    if (value === null || value === undefined) continue
    if (typeof value === "object") out += JSON.stringify(value)
    else out += String(value)
  }
  return out
}

export async function verifyPaywayWebhook(
  rawBody: string,
  headerSignature: string | null,
  hmacKey: string,
  parsed: Record<string, unknown>,
): Promise<boolean> {
  if (!headerSignature) return false
  const received = headerSignature.trim()
  const concat = concatKsortValues(parsed)
  const candidates = [
    await hmacSha512Hex(hmacKey, concat),
    await hmacSha512Base64(hmacKey, concat),
    await hmacSha512Hex(hmacKey, rawBody),
    await hmacSha512Base64(hmacKey, rawBody),
  ]
  return candidates.some((expected) => timingSafeEqual(expected, received))
}

/** PayWay merchant_auth: RSA PKCS#1 v1.5, 117-byte chunks for a 1024-bit key. */
export function rsaEncryptMerchantAuth(plaintext: string, publicPem: string): string {
  const key = createPublicKey(publicPem)
  const buf = Buffer.from(plaintext, "utf8")
  const modulus = Math.ceil(((key.asymmetricKeyDetails?.modulusLength as number | undefined) ?? 1024) / 8)
  const chunkSize = Math.max(modulus - 11, 1)
  const chunks: Buffer[] = []
  for (let i = 0; i < buf.length; i += chunkSize) {
    chunks.push(publicEncrypt({ key, padding: constants.RSA_PKCS1_PADDING }, buf.subarray(i, i + chunkSize)))
  }
  return Buffer.concat(chunks).toString("base64")
}

export function rsaDecryptMerchantAuth(ciphertextB64: string, privatePem: string): string {
  const key = createPrivateKey(privatePem)
  const buf = Buffer.from(ciphertextB64, "base64")
  const modulus = Math.ceil(((key.asymmetricKeyDetails?.modulusLength as number | undefined) ?? 1024) / 8)
  const chunks: Buffer[] = []
  for (let i = 0; i < buf.length; i += modulus) {
    chunks.push(privateDecrypt({ key, padding: constants.RSA_PKCS1_PADDING }, buf.subarray(i, i + modulus)))
  }
  return Buffer.concat(chunks).toString("utf8")
}

export type PurchaseRequest = {
  tranId: string
  amount: string
  currency: PaywayCurrency
  firstname?: string
  lastname?: string
  email?: string
  phone?: string
  paymentOption?: string
  itemsJson: unknown[]
  customFields?: Record<string, string>
  returnParams?: string
  lifetimeMinutes?: number
  viewType?: string
}

export type PaywayCheckoutPayload = {
  qr_string: string | null
  qr_image: string | null
  abapay_deeplink: string | null
  checkout_qr_url: string | null
  checkout_html: string | null
  raw: unknown
}

export async function callPurchase(secrets: PaywaySecrets, input: PurchaseRequest): Promise<PaywayCheckoutPayload> {
  const reqTime = utcReqTime()
  const items = toBase64(JSON.stringify(input.itemsJson))
  const customFields = input.customFields ? toBase64(JSON.stringify(input.customFields)) : ""
  const returnUrl = secrets.webhookUrl ? toBase64(secrets.webhookUrl) : ""
  const cancelUrl = secrets.siteUrl ? `${secrets.siteUrl}/pricing` : ""
  const continueUrl = secrets.siteUrl ? `${secrets.siteUrl}/account?tab=membership&payway=success` : ""
  const lifetime = String(input.lifetimeMinutes ?? 30)
  const paymentOption = input.paymentOption ?? "abapay_khqr_deeplink"

  const fields: Record<string, string> = {
    req_time: reqTime,
    merchant_id: secrets.merchantId,
    tran_id: input.tranId,
    amount: input.amount,
    items,
    shipping: "",
    firstname: lettersOnly(input.firstname) || "Inbound",
    lastname: lettersOnly(input.lastname) || "Reader",
    email: input.email ?? "",
    phone: input.phone ?? "",
    type: "purchase",
    payment_option: paymentOption,
    return_url: returnUrl,
    cancel_url: cancelUrl,
    continue_success_url: continueUrl,
    return_deeplink: "",
    currency: input.currency,
    custom_fields: customFields,
    return_params: input.returnParams ?? "",
    payout: "",
    lifetime,
    additional_params: "",
    google_pay_token: "",
    skip_success_page: "0",
  }
  fields.hash = await purchaseHash(fields, secrets.hmacKey)

  const form = new FormData()
  for (const [key, value] of Object.entries(fields)) form.set(key, value)
  form.set("view_type", input.viewType ?? "popup")
  form.set("payment_gate", "0")

  const res = await fetch(`${secrets.apiUrl}/api/payment-gateway/v1/payments/purchase`, {
    method: "POST",
    body: form,
  })
  return parseCheckoutResponse(await res.text())
}

export async function callCheckTransaction(
  secrets: PaywaySecrets,
  tranId: string,
): Promise<Record<string, unknown>> {
  const reqTime = utcReqTime()
  const hash = await checkTransactionHash(reqTime, secrets.merchantId, tranId, secrets.hmacKey)
  const res = await fetch(`${secrets.apiUrl}/api/payment-gateway/v1/payments/check-transaction-2`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      req_time: reqTime,
      merchant_id: secrets.merchantId,
      tran_id: tranId,
      hash,
    }),
  })
  return (await res.json().catch(() => ({}))) as Record<string, unknown>
}

export function mapPaywayPaymentStatus(payload: Record<string, unknown>): {
  status: "pending" | "completed" | "failed" | "expired"
  apv: string | null
} {
  const data = (payload.data ?? payload) as Record<string, unknown>
  const paymentStatus = String(data.payment_status ?? data.paymentStatus ?? "").toUpperCase()
  const code = String(data.payment_status_code ?? data.paymentStatusCode ?? "")
  const apv = data.apv != null ? String(data.apv) : data.apv != null ? String(data.apv) : null

  if (paymentStatus === "APPROVED" || paymentStatus === "PRE-AUTH" || code === "0") {
    return { status: "completed", apv }
  }
  if (paymentStatus === "PENDING" || code === "2") {
    return { status: "pending", apv }
  }
  if (paymentStatus === "CANCELLED" || code === "7") {
    return { status: "expired", apv }
  }
  if (paymentStatus === "DECLINED" || paymentStatus === "REFUNDED" || code === "3" || code === "4") {
    return { status: "failed", apv }
  }
  return { status: "pending", apv }
}

export function webhookIndicatesSuccess(body: Record<string, unknown>): boolean {
  return body.status === 0 || body.status === "0"
}

export function webhookTranId(body: Record<string, unknown>): string {
  return String(body.tran_id ?? body.tranId ?? "")
}

export function webhookApv(body: Record<string, unknown>): string | null {
  const value = body.apv ?? body.apv
  return value == null ? null : String(value)
}

function parseCheckoutResponse(text: string): PaywayCheckoutPayload {
  const trimmed = text.trim()
  if (trimmed.startsWith("{")) {
    try {
      const json = JSON.parse(trimmed) as Record<string, unknown>
      return {
        qr_string: firstString(json, ["qr_string", "qrString"]),
        qr_image: firstString(json, ["qr_image", "qrImage"]),
        abapay_deeplink: firstString(json, ["abapay_deeplink", "abapayDeeplink"]),
        checkout_qr_url: firstString(json, ["checkout_qr_url", "checkoutQrUrl"]),
        checkout_html: null,
        raw: json,
      }
    } catch {
      /* HTML fallback */
    }
  }
  const urlMatch = trimmed.match(/https?:\/\/[^\s"'<>]+checkout[^\s"'<>]*/i)
  return {
    qr_string: null,
    qr_image: null,
    abapay_deeplink: null,
    checkout_qr_url: urlMatch?.[0] ?? null,
    checkout_html: trimmed.startsWith("<") ? trimmed : null,
    raw: { html: trimmed.slice(0, 2000) },
  }
}

function firstString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = obj[key]
    if (typeof value === "string" && value.length > 0) return value
  }
  return null
}

function lettersOnly(value: string | undefined): string {
  if (!value) return ""
  return value.replace(/[^A-Za-z\s]/g, "").trim().slice(0, 80)
}

function normalizePem(raw: string, type: string): string | null {
  const value = raw.replace(/\\n/g, "\n").trim()
  if (!value) return null
  if (value.includes("BEGIN")) return value
  const body = value.replace(/\s+/g, "").match(/.{1,64}/g)?.join("\n") ?? value
  return `-----BEGIN ${type}-----\n${body}\n-----END ${type}-----`
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = ""
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")
}

function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder()
  const aa = enc.encode(a)
  const bb = enc.encode(b)
  if (aa.length !== bb.length) return false
  let out = 0
  for (let i = 0; i < aa.length; i++) out |= aa[i] ^ bb[i]
  return out === 0
}
