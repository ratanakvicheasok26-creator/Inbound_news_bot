import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"

const PROTECTED_PATHS = [
  "/account",
  "/admin",
]

const STATIC_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".ico", ".css", ".js", ".woff", ".woff2", ".ttf", ".eot"]

const CACHE_CONTROL_HEADERS = {
  dynamic: "private, no-store, max-age=0",
  authenticated: "private, no-cache, must-revalidate",
  public: "public, max-age=31536000, immutable",
} as const

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
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

function applySecurityHeaders(response: NextResponse): void {
  response.headers.set("X-Content-Type-Options", "nosniff")
  response.headers.set("X-Frame-Options", "DENY")
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()",
  )
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (pathname.startsWith("/api/auth/")) {
    const response = NextResponse.next()
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate")
    response.headers.set("Pragma", "no-cache")
    applySecurityHeaders(response)
    return response
  }

  if (pathname.startsWith("/api/")) {
    const response = NextResponse.next()
    response.headers.set("Cache-Control", CACHE_CONTROL_HEADERS.dynamic)
    applySecurityHeaders(response)

    const origin = req.headers.get("origin")
    const host = req.headers.get("host")
    if (origin && host && !origin.includes(host)) {
      return new NextResponse("Forbidden", { status: 403 })
    }

    return response
  }

  if (hasCacheDeceptionSignature(pathname)) {
    return new NextResponse("Not Found", { status: 404 })
  }

  let response = NextResponse.next({
    request: { headers: req.headers },
  })

  applySecurityHeaders(response)

  if (isStaticAsset(pathname) || isStaticDirectory(pathname)) {
    response.headers.set("Cache-Control", CACHE_CONTROL_HEADERS.public)
    return response
  }

  response.headers.set("Cache-Control", CACHE_CONTROL_HEADERS.dynamic)

  // Create a Supabase client that refreshes expired sessions
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Set cookies on the request for downstream server components
          for (const { name, value, options } of cookiesToSet) {
            req.cookies.set({ name, value, ...options })
          }
          // Re-create response with updated request headers
          response = NextResponse.next({
            request: { headers: req.headers },
          })
          // Also set cookies on the response so the browser gets them
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2])
          }
        },
      },
    },
  )

  // Refresh the session if it exists but is expired
  const { data: { user } } = await supabase.auth.getUser()

  if (isProtectedPath(pathname)) {
    if (!user) {
      const loginUrl = new URL("/login", req.url)
      loginUrl.searchParams.set("returnTo", pathname)
      return NextResponse.redirect(loginUrl)
    }

    response.headers.set("Cache-Control", CACHE_CONTROL_HEADERS.authenticated)
  } else if (user) {
    response.headers.set("Cache-Control", CACHE_CONTROL_HEADERS.authenticated)
  }

  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|public/).*)",
  ],
}
