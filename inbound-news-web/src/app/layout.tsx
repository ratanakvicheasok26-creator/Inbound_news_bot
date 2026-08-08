import type { Metadata } from "next";
import {
  Source_Serif_4,
  Source_Sans_3,
  JetBrains_Mono,
  Noto_Sans_Khmer,
  Space_Grotesk,
} from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { Ticker } from "@/components/Ticker";
import { Footer } from "@/components/layout/Footer";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { cn } from "@/lib/utils";

const display = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "600", "700"],
  display: "swap",
});

const sans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "700"],
  display: "swap",
});

const displayModern = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display-modern",
  weight: ["500", "600", "700"],
  display: "swap",
});

const notoKhmer = Noto_Sans_Khmer({
  subsets: ["khmer"],
  variable: "--font-khmer",
  weight: ["400", "500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Inbound Reports — Decode the Tech.",
  description:
    "Technology coverage from Phnom Penh — map who covered a story, compare framing, spot blindspots, and cut jargon.",
  icons: {
    icon: [{ url: "/inb.png", type: "image/png" }],
    apple: "/inb.png",
  },
  openGraph: {
    title: "Inbound Reports — Decode the Tech.",
    description:
      "Technology coverage from Phnom Penh — map who covered a story, compare framing, spot blindspots, and cut jargon.",
    type: "website",
    locale: "en_US",
    siteName: "Inbound Reports",
  },
  twitter: {
    card: "summary_large_image",
    title: "Inbound Reports — Decode the Tech.",
    description:
      "Technology coverage from Phnom Penh — map who covered a story, compare framing, spot blindspots, and cut jargon.",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F6F7F9" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

const themeInitScript = `
(function() {
  try {
    var cookieMatch = document.cookie.match(/(?:^|; )theme=(dark|light)(?:;|$)/);
    var cookieTheme = cookieMatch ? cookieMatch[1] : null;
    var saved = localStorage.getItem('theme');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var theme = cookieTheme || saved || (prefersDark ? 'dark' : 'light');
    if (theme !== 'dark' && theme !== 'light') theme = 'light';
    document.documentElement.setAttribute('data-theme', theme);
    if (!cookieTheme || cookieTheme !== theme) {
      document.cookie = 'theme=' + theme + '; path=/; max-age=31536000; SameSite=Lax';
    }
    if (saved !== theme) {
      try { localStorage.setItem('theme', theme); } catch (e) {}
    }
  } catch (e) {}
})();
`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The theme is applied client-side by the inline themeInitScript before first
  // paint (reads cookie/localStorage/OS preference). Rendering a static default
  // here keeps every route statically cacheable — no cookies()/dynamic reads.
  const theme = "light";

  return (
    <html
      lang="en"
      data-theme={theme}
      suppressHydrationWarning
      className={cn(
        display.variable,
        sans.variable,
        mono.variable,
        notoKhmer.variable,
        displayModern.variable,
        "font-sans"
      )}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="pb-[var(--mobile-nav-offset)] md:pb-0">
        <a href="#main-content" className="skip-to-content">
          Skip to content
        </a>
        <Header />
        <Ticker />
        <main id="main-content">{children}</main>
        <Footer />
        <MobileBottomNav />
      </body>
    </html>
  );
}
