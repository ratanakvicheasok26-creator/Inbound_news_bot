/* eslint-disable @next/next/no-page-custom-font */
import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";
import { InteractiveBackground } from "@/components/ui/pricing";
import { PromoBanner } from "@/components/PromoBanner";

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

const localeInitScript = `
(function() {
  try {
    var stored = localStorage.getItem('ib_locale');
    if (!stored) {
      var profile = localStorage.getItem('ib_profile');
      if (profile) {
        try {
          var parsed = JSON.parse(profile);
          stored = parsed && parsed.preferences && parsed.preferences.defaultLang;
        } catch (e) {}
      }
    }
    if (stored !== 'en' && stored !== 'km') {
      stored = (navigator.language || '').toLowerCase().indexOf('km') === 0 ? 'km' : 'en';
    }
    if (stored !== 'km') stored = 'en';
    document.documentElement.lang = stored;
    document.cookie = 'locale=' + stored + '; path=/; max-age=31536000; SameSite=Lax';
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
      className="font-sans"
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
        />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <script dangerouslySetInnerHTML={{ __html: localeInitScript }} />
      </head>
      <body className="pb-[var(--mobile-nav-offset)] md:pb-0 relative min-h-screen">
        <InteractiveBackground />
        <a href="#main-content" className="skip-to-content">
          Skip to content
        </a>
        <LocaleProvider>
          <Header />
          <PromoBanner />
          <main id="main-content" className="relative z-10">{children}</main>
          <Footer />
          <MobileBottomNav />
        </LocaleProvider>
      </body>
    </html>
  );
}
