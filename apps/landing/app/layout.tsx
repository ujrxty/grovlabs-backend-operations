import type { Metadata, Viewport } from "next";
import { Instrument_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

// Instrument Sans carries more presence than a default UI grotesque at
// display sizes, while staying sober enough for a B2B page.
const plexSans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-plex-sans",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-plex-mono",
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://thebrokenwood.com"),
  title: "The Broken Wood | Performance Marketing & Lead Generation",
  description:
    "The Broken Wood runs paid acquisition and sells qualified leads on CPA and CPL terms across insurance, legal and financial verticals. Real-time delivery for advertisers, open campaigns for publishers.",
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    type: "website",
    url: "https://thebrokenwood.com",
    siteName: "The Broken Wood",
    title: "The Broken Wood | Performance Marketing & Lead Generation",
    description:
      "Paid acquisition and qualified lead generation on CPA and CPL terms across insurance, legal and financial verticals.",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#f6f3ee",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${plexSans.variable} ${plexMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
