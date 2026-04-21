import type { Metadata } from "next";
import { Playfair_Display, Source_Sans_3 } from "next/font/google";
import "./globals.css";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  display: "swap",
});

const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Recipe Box",
  description:
    "Your personal recipe collection — gathered from the web, Instagram, and your own kitchen.",
};

/**
 * Root layout: just fonts + html/body shell. Navbar / footer / mobile-nav
 * live in the (main) route group's layout so that full-bleed routes like
 * Cook Mode (under (cook)) can opt out of that chrome entirely.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${playfair.variable} ${sourceSans.variable} h-full`}
    >
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
