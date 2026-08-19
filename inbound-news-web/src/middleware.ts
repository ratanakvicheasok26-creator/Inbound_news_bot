import { NextRequest, NextResponse } from "next/server"
import { jwtVerify } from "jose"

const SESSION_COOKIE = "__Host-session_id"
const PUBLIC_PATHS = ["/login", "/signup", "/forgot-password", "/reset-password", "/auth/confirm", "/api/auth/login", "/api/auth/signup", "/api/auth/logout", "/api/auth/refresh", "/api/auth/verify-email", "/api/auth/forgot-password", "/api/auth/reset-password", "/api/auth/change-email", "/api/auth/cancel-email-change", "/_next", "/favicon.ico", "/public"]

const STATIC_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".ico", ".css", ".js", ".woff", ".woff2", ".ttf", ".eot"]

const CACHE_CONTROL_HEADERS = {
  dynamic: "private, no-store, max-age=0",
  authenticated: "private, no-cache, must-revalidate",
  public: "public, max-age=31536000, immutable",
} as const

function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p))
}

function isStaticAsset(pathname: string): boolean {
  return STATIC_EXTENSIONS.some((ext) => pathname.toLowerCase().endsWith(ext))
}

function isStaticDirectory(pathname: string): boolean {
  return pathname.startsWith("/_next/") || pathname.startsWith("/public/")
}

function hasCacheDeceptionSignature(pathname: string): boolean {
  const segments = pathname.split(".")
  if (segments.length < 2) return false
  const ext = segments[segments.length - 1]?.toLowerCase()
  if (!ext || !STATIC_EXTENSIONS.includes(`.${ext}`)) return false
  const pathWithoutExt = pathname.slice(0, pathname.lastIndexOf("."))
  return pathWithoutExt.includes("/api/") || pathWithoutExt.includes("/auth/")
}

function parseCookies(cookieHeader: string): Map<string, string> {
  const cookies = new Map<string, string>()
  for (const pair of cookieHeader.split(";")) {
    const [name, ...rest] = pair.split("=")
    if (name && rest.length > 0) {
      cookies.set(name.trim(), rest.join("=").trim())
    }
  }
  return cookies
}

async function verifyTokenEdge(token: string): Promise<boolean> {
  try {
    const secret = process.env.JWT_SECRET
    if (!secret) return false

    const encoder = new TextEncoder()
    const key = encoder.encode(secret)

    const { payload } = await jwtVerify(token, key, {
      audience: process.env.JWT_AUDIENCE || "inbound-news-api",
      issuer: process.env.JWT_ISSUER || "inbound-news-auth",
    })

    const sub = payload.sub
    if (!sub || payload.exp === undefined) return false
    if (payload.exp < Math.floor(Date.now() / 1000)) return false

    return true
  } catch {
    return false
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (pathname.startsWith("/api/auth/")) {
    return handleAuthApiMiddleware(req)
  }

  if (pathname.startsWith("/api/")) {
    return handleApiMiddleware(req)
  }

  if (hasCacheDeceptionSignature(pathname)) {
    return new NextResponse("Not Found", { status: 404 })
  }

  const response = NextResponse.next()

  applySecurityHeaders(response)

  if (isStaticAsset(pathname) || isStaticDirectory(pathname)) {
    response.headers.set("Cache-Control", CACHE_CONTROL_HEADERS.public)
    return response
  }

  response.headers.set("Cache-Control", CACHE_CONTROL_HEADERS.dynamic)

  if (!isPublicPath(pathname)) {
    const cookieHeader = req.headers.get("cookie")
    if (!cookieHeader) {
      const loginUrl = new URL("/login", req.url)
      loginUrl.searchParams.set("returnTo", pathname)
      return NextResponse.redirect(loginUrl)
    }
    const cookies = parseCookies(cookieHeader)
    const accessToken = cookies.get(SESSION_COOKIE)

    if (!accessToken) {
      const loginUrl = new URL("/login", req.url)
      loginUrl.searchParams.set("returnTo", pathname)
      return NextResponse.redirect(loginUrl)
    }

    const valid = await verifyTokenEdge(accessToken)
    if (!valid) {
      const refreshCookie = cookies.get("__Host-refresh_token")
      if (refreshCookie) {
        const refreshUrl = new URL("/api/auth/refresh", req.url)
        const refreshResponse = NextResponse.rewrite(refreshUrl)
        return refreshResponse
      }

      const loginUrl = new URL("/login", req.url)
      loginUrl.searchParams.set("returnTo", pathname)
      const redirectResponse = NextResponse.redirect(loginUrl)
      redirectResponse.headers.append(
        "Set-Cookie",
        `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
      )
      return redirectResponse
    }

    response.headers.set("Cache-Control", CACHE_CONTROL_HEADERS.authenticated)
  }

  return response
}

function handleAuthApiMiddleware(req: NextRequest): NextResponse {
  const response = NextResponse.next()
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate")
  response.headers.set("Pragma", "no-cache")
  response.headers.set("X-Content-Type-Options", "nosniff")
  response.headers.set("X-Frame-Options", "DENY")
  return response
}

function handleApiMiddleware(req: NextRequest): NextResponse {
  const response = NextResponse.next()
  response.headers.set("Cache-Control", CACHE_CONTROL_HEADERS.dynamic)
  response.headers.set("X-Content-Type-Options", "nosniff")

  const origin = req.headers.get("origin")
  const host = req.headers.get("host")
  if (origin && host && !origin.includes(host)) {
    return new NextResponse("Forbidden", { status: 403 })
  }

  return response
}

function applySecurityHeaders(response: NextResponse): void {
  response.headers.set("X-Content-Type-Options", "nosniff")
  response.headers.set("X-Frame-Options", "DENY")
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()",
  )
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|public/).*)",
  ],
}
