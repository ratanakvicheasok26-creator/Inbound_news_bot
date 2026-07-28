import type { Metadata } from "next";
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
  title: "Inbound Reporter — Decode the Tech.",
  description:
    "Independent technology journalism from Phnom Penh — startups, AI, cybersecurity, and more.",
};

const themeInitScript = `
(function() {
  try {
    var saved = localStorage.getItem('theme');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var theme = saved || (prefersDark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="light" className={cn(inter.variable, mono.variable, notoKhmer.variable, "font-sans")}>
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
