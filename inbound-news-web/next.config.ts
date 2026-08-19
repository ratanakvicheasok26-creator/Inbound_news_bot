import os from "node:os";
import type { NextConfig } from "next";

/** All local and non-internal IPv4 addresses on this machine (current LAN IPs). */
function getLanAddresses(): string[] {
  const addresses: string[] = ["localhost", "127.0.0.1", "0.0.0.0"];
  for (const nets of Object.values(os.networkInterfaces())) {
    for (const net of nets ?? []) {
      if (net.family === "IPv4" && !net.internal) addresses.push(net.address);
    }
  }
  return addresses;
}

const supabaseHost = (() => {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    return url ? new URL(url).origin : "https://*.supabase.co";
  } catch {
    return "https://*.supabase.co";
  }
})();

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://pagead2.googlesyndication.com https://www.googletagservices.com https://www.google.com https://partner.googleadservices.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.cdnfonts.com",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data: https://fonts.gstatic.com https://fonts.cdnfonts.com",
      `connect-src 'self' ${supabaseHost} https://*.supabase.co wss://*.supabase.co https://pagead2.googlesyndication.com https://*.google.com https://*.doubleclick.net https://api.pwnedpasswords.com`,
      "frame-src https://googleads.g.doubleclick.net https://tpc.googlesyndication.com https://www.google.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const cacheDeceptionProtection = [
  {
    source: "/api/:path*",
    headers: [
      { key: "Cache-Control", value: "private, no-store, max-age=0" },
      { key: "X-Content-Type-Options", value: "nosniff" },
    ],
  },
  {
    source: "/(.*)\\.(jpg|jpeg|png|gif|webp|svg|ico|css|js|woff|woff2|ttf|eot)$",
    headers: [
      { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
    ],
  },
];

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  allowedDevOrigins: getLanAddresses(),
  images: {
    remotePatterns: [{ protocol: "https", hostname: "images.weserv.nl" }],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      ...cacheDeceptionProtection,
    ];
  },
};

export default nextConfig;
