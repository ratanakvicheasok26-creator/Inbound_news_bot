import type { SupabaseClient } from "npm:@supabase/supabase-js@2"

export type PaywayRow = {
  id: string
  user_id: string
  aba_tran_id: string
  plan: string | null
  amount: number
  currency: string
  status: string
  payment_metadata: Record<string, unknown>
  expires_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export async function applyPaywayStatus(
  admin: SupabaseClient,
  abaTranId: string,
  status: "pending" | "completed" | "failed" | "expired",
  apv: string | null,
  metadata: Record<string, unknown> = {},
): Promise<PaywayRow> {
  const { data, error } = await admin.rpc("apply_payway_status", {
    p_aba_tran_id: abaTranId,
    p_status: status,
    p_apv: apv,
    p_metadata: metadata,
  })
  if (error) throw error
  return data as PaywayRow
}
