import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""

export const isSupabaseConfigured = Boolean(supabaseUrl && serviceRoleKey)

function getServiceClient() {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase service role is not configured")
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export interface AuthUserRecord {
  id: string
  email: string
  email_verified: boolean
  display_name: string | null
  created_at: string
}

export async function createUser(email: string, passwordHash: string, displayName?: string): Promise<AuthUserRecord> {
  const supabase = getServiceClient()

  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email,
    password: crypto.randomUUID(),
    email_confirm: false,
    user_metadata: { display_name: displayName },
  })

  if (authError || !authUser.user) {
    throw new Error(authError?.message || "Failed to create user")
  }

  const { error: credError } = await supabase
    .from("auth_credentials")
    .insert({
      user_id: authUser.user.id,
      password_hash: passwordHash,
      hash_algorithm: "argon2id",
      hash_version: 19,
    })

  if (credError) {
    await supabase.auth.admin.deleteUser(authUser.user.id)
    throw new Error("Failed to store credentials")
  }

  return {
    id: authUser.user.id,
    email: authUser.user.email!,
    email_verified: authUser.user.email_confirmed_at !== null,
    display_name: displayName || null,
    created_at: authUser.user.created_at,
  }
}

export async function getUserByEmail(email: string): Promise<{ id: string; email: string; email_verified: boolean; created_at?: string } | null> {
  const supabase = getServiceClient()
  const { data, error } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  })

  if (error) return null

  const user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
  if (!user) return null

  return {
    id: user.id,
    email: user.email!,
    email_verified: user.email_confirmed_at !== null,
    created_at: user.created_at,
  }
}

export async function getUserById(id: string): Promise<{ id: string; email: string; email_verified: boolean; created_at?: string } | null> {
  const supabase = getServiceClient()
  const { data, error } = await supabase.auth.admin.getUserById(id)

  if (error || !data.user) return null

  return {
    id: data.user.id,
    email: data.user.email!,
    email_verified: data.user.email_confirmed_at !== null,
    created_at: data.user.created_at,
  }
}

export async function getPasswordHash(userId: string): Promise<string | null> {
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from("auth_credentials")
    .select("password_hash")
    .eq("user_id", userId)
    .maybeSingle()

  if (error || !data) return null
  return data.password_hash
}

export async function updatePasswordHash(userId: string, newHash: string): Promise<void> {
  const supabase = getServiceClient()
  const { error } = await supabase
    .from("auth_credentials")
    .upsert({
      user_id: userId,
      password_hash: newHash,
      hash_algorithm: "argon2id",
      hash_version: 19,
    }, { onConflict: "user_id" })

  if (error) throw new Error("Failed to update password hash")
}

export async function storeRefreshToken(userId: string, tokenHash: string, expiresAt: string, deviceInfo?: string): Promise<void> {
  const supabase = getServiceClient()
  const { error } = await supabase
    .from("refresh_tokens")
    .insert({
      user_id: userId,
      token_hash: tokenHash,
      device_info: deviceInfo || null,
      expires_at: expiresAt,
    })

  if (error) throw new Error("Failed to store refresh token")
}

export async function verifyRefreshToken(tokenHash: string): Promise<{ userId: string; id: string } | null> {
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from("refresh_tokens")
    .select("id, user_id")
    .eq("token_hash", tokenHash)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle()

  if (error || !data) return null
  return { userId: data.user_id, id: data.id }
}

export async function revokeRefreshToken(tokenId: string): Promise<void> {
  const supabase = getServiceClient()
  await supabase
    .from("refresh_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", tokenId)
}

export async function revokeAllUserRefreshTokens(userId: string): Promise<void> {
  const supabase = getServiceClient()
  await supabase
    .from("refresh_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("revoked_at", null)
}

export async function storeEmailVerificationToken(userId: string, tokenHash: string, expiresAt: string): Promise<void> {
  const supabase = getServiceClient()
  const { error } = await supabase
    .from("email_verification_tokens")
    .insert({ user_id: userId, token_hash: tokenHash, expires_at: expiresAt })

  if (error) throw new Error("Failed to store email verification token")
}

export async function verifyEmailToken(tokenHash: string): Promise<string | null> {
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from("email_verification_tokens")
    .select("user_id")
    .eq("token_hash", tokenHash)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle()

  if (error || !data) return null

  await supabase
    .from("email_verification_tokens")
    .delete()
    .eq("token_hash", tokenHash)

  return data.user_id
}

export async function confirmUserEmail(userId: string): Promise<void> {
  const supabase = getServiceClient()
  await supabase.auth.admin.updateUserById(userId, {
    email_confirm: true,
  })
}

export async function storePasswordResetToken(userId: string, tokenHash: string, expiresAt: string): Promise<void> {
  const supabase = getServiceClient()
  const { error } = await supabase
    .from("password_reset_tokens")
    .insert({ user_id: userId, token_hash: tokenHash, expires_at: expiresAt })

  if (error) throw new Error("Failed to store password reset token")
}

export async function verifyPasswordResetToken(tokenHash: string): Promise<string | null> {
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from("password_reset_tokens")
    .select("user_id")
    .eq("token_hash", tokenHash)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle()

  if (error || !data) return null

  await supabase
    .from("password_reset_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("token_hash", tokenHash)

  return data.user_id
}

export async function storeEmailChangeNonce(
  userId: string,
  nonceType: "old_email_revoke" | "new_email_verify",
  newEmail: string,
  tokenHash: string,
  expiresAt: string,
): Promise<void> {
  const supabase = getServiceClient()
  const { error } = await supabase
    .from("email_change_nonces")
    .insert({
      user_id: userId,
      nonce_type: nonceType,
      new_email: newEmail,
      token_hash: tokenHash,
      expires_at: expiresAt,
    })

  if (error) throw new Error("Failed to store email change nonce")
}

export async function verifyEmailChangeNonce(
  tokenHash: string,
  nonceType: "old_email_revoke" | "new_email_verify",
): Promise<{ userId: string; newEmail: string } | null> {
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from("email_change_nonces")
    .select("user_id, new_email")
    .eq("token_hash", tokenHash)
    .eq("nonce_type", nonceType)
    .eq("used", false)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle()

  if (error || !data) return null

  await supabase
    .from("email_change_nonces")
    .update({ used: true })
    .eq("token_hash", tokenHash)

  return { userId: data.user_id, newEmail: data.new_email }
}

export async function cancelPendingEmailChange(userId: string): Promise<void> {
  const supabase = getServiceClient()
  await supabase
    .from("email_change_nonces")
    .update({ used: true })
    .eq("user_id", userId)
    .eq("used", false)
}

export async function updateUserEmail(userId: string, newEmail: string): Promise<void> {
  const supabase = getServiceClient()
  const { error } = await supabase.auth.admin.updateUserById(userId, {
    email: newEmail,
    email_confirm: true,
  })

  if (error) throw new Error("Failed to update email")
}

export async function deleteUser(userId: string): Promise<void> {
  const supabase = getServiceClient()
  const { error } = await supabase.auth.admin.deleteUser(userId)
  if (error) throw new Error("Failed to delete user")
}

export async function getUserProfile(userId: string): Promise<{ display_name: string | null } | null> {
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .maybeSingle()

  if (error || !data) return null
  return data
}
