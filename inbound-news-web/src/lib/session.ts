import { ACCESS_TOKEN_MAX_AGE } from "./crypto"

const SESSION_COOKIE_NAME = "__Host-session_id"
const REFRESH_COOKIE_NAME = "__Host-refresh_token"

export interface SessionCookies {
  accessToken: string
  refreshToken: string
}

function isProduction(): boolean {
  return process.env.NODE_ENV === "production"
}

export function setSessionCookies(
  accessToken: string,
  refreshToken: string,
): string[] {
  const accessExpiry = new Date(Date.now() + ACCESS_TOKEN_MAX_AGE * 1000)
  const refreshExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

  const accessCookie = [
    `${SESSION_COOKIE_NAME}=${accessToken}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    `Expires=${accessExpiry.toUTCString()}`,
  ].join("; ")

  const refreshCookie = [
    `${REFRESH_COOKIE_NAME}=${refreshToken}`,
    "Path=/auth",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    `Expires=${refreshExpiry.toUTCString()}`,
  ].join("; ")

  return [accessCookie, refreshCookie]
}

export function clearSessionCookies(): string[] {
  const accessCookie = [
    `${SESSION_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    "Max-Age=0",
  ].join("; ")

  const refreshCookie = [
    `${REFRESH_COOKIE_NAME}=`,
    "Path=/auth",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    "Max-Age=0",
  ].join("; ")

  return [accessCookie, refreshCookie]
}

export function parseCookies(cookieHeader: string | null): Map<string, string> {
  const cookies = new Map<string, string>()
  if (!cookieHeader) return cookies

  for (const pair of cookieHeader.split(";")) {
    const [name, ...rest] = pair.split("=")
    if (name && rest.length > 0) {
      cookies.set(name.trim(), rest.join("=").trim())
    }
  }
  return cookies
}

export function getAccessTokenFromCookies(cookieHeader: string | null): string | null {
  const cookies = parseCookies(cookieHeader)
  return cookies.get(SESSION_COOKIE_NAME) || null
}

export function getRefreshTokenFromCookies(cookieHeader: string | null): string | null {
  const cookies = parseCookies(cookieHeader)
  return cookies.get(REFRESH_COOKIE_NAME) || null
}

export { SESSION_COOKIE_NAME, REFRESH_COOKIE_NAME }
