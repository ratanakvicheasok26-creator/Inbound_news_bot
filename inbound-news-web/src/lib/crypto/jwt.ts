import { SignJWT, jwtVerify, type JWTPayload } from "jose"

export interface AuthJWTPayload extends JWTPayload {
  sub: string
  email: string
  email_verified: boolean
  role: string
}

const ACCESS_TOKEN_MAX_AGE = 900
const REFRESH_TOKEN_MAX_AGE = 60 * 60 * 24 * 30

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error("JWT_SECRET environment variable is required")
  return new TextEncoder().encode(secret)
}

function getJwtAudience(): string {
  return process.env.JWT_AUDIENCE || "inbound-news-api"
}

function getJwtIssuer(): string {
  return process.env.JWT_ISSUER || "inbound-news-auth"
}

export async function signAccessToken(payload: {
  sub: string
  email: string
  email_verified: boolean
}): Promise<string> {
  const secret = getJwtSecret()
  const now = Math.floor(Date.now() / 1000)
  const jti = crypto.randomUUID()

  return new SignJWT({
    email: payload.email,
    email_verified: payload.email_verified,
    role: "authenticated",
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(payload.sub)
    .setAudience(getJwtAudience())
    .setIssuer(getJwtIssuer())
    .setIssuedAt(now)
    .setExpirationTime(`${ACCESS_TOKEN_MAX_AGE}s`)
    .setJti(jti)
    .sign(secret)
}

export async function signRefreshToken(userId: string): Promise<string> {
  const secret = getJwtSecret()
  const now = Math.floor(Date.now() / 1000)
  const jti = crypto.randomUUID()

  return new SignJWT({ type: "refresh" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(userId)
    .setAudience(getJwtAudience())
    .setIssuer(getJwtIssuer())
    .setIssuedAt(now)
    .setExpirationTime(`${REFRESH_TOKEN_MAX_AGE}s`)
    .setJti(jti)
    .sign(secret)
}

export async function verifyAccessToken(token: string): Promise<AuthJWTPayload | null> {
  try {
    const secret = getJwtSecret()
    const { payload } = await jwtVerify(token, secret, {
      audience: getJwtAudience(),
      issuer: getJwtIssuer(),
    })
    return payload as AuthJWTPayload
  } catch {
    return null
  }
}

export async function verifyRefreshToken(token: string): Promise<{ sub: string; jti: string } | null> {
  try {
    const secret = getJwtSecret()
    const { payload } = await jwtVerify(token, secret, {
      audience: getJwtAudience(),
      issuer: getJwtIssuer(),
    })
    if ((payload as Record<string, unknown>).type !== "refresh") return null
    return { sub: payload.sub!, jti: payload.jti! }
  } catch {
    return null
  }
}

export async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token)
  const hashBuffer = await crypto.subtle.digest("SHA-256", data)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

export { ACCESS_TOKEN_MAX_AGE, REFRESH_TOKEN_MAX_AGE }
