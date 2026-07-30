import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Inter, JetBrains_Mono, Noto_Sans_Khmer } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { Ticker } from "@/components/Ticker";
import { Footer } from "@/components/layout/Footer";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { cn } from "@/lib/utils";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "700", "800", "900"],
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "700"],
  display: "swap",
});

const notoKhmer = Noto_Sans_Khmer({
  subsets: ["latin"],
  variable: "--font-khmer",
  weight: ["400", "500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Inbound Reports — Decode the Tech.",
  description:
    "Independent technology journalism from Phnom Penh — startups, AI, cybersecurity, and more.",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }, { url: "/icon.svg", sizes: "any" }],
    apple: "/icon.svg",
  },
  openGraph: {
    title: "Inbound Reports — Decode the Tech.",
    description:
      "Independent technology journalism from Phnom Penh — startups, AI, cybersecurity, and more.",
    type: "website",
    locale: "en_US",
    siteName: "Inbound Reports",
  },
  twitter: {
    card: "summary_large_image",
    title: "Inbound Reports — Decode the Tech.",
    description:
      "Independent technology journalism from Phnom Penh — startups, AI, cybersecurity, and more.",
  },
};

/** Sync localStorage → cookie on first visit / when cookie missing; apply theme ASAP. */
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
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get("theme")?.value;
  const theme = themeCookie === "dark" || themeCookie === "light" ? themeCookie : "light";

  return (
    <html lang="en" data-theme={theme} className={cn(inter.variable, mono.variable, notoKhmer.variable, "font-sans")}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="pb-14 md:pb-0">
        <Header />
        <Ticker />
        <main>{children}</main>
        <Footer />
        <MobileBottomNav />
      </body>
    </html>
  );
}
