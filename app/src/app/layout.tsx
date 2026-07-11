import type { Metadata, Viewport } from "next";
import {
  Playfair_Display,
  Quicksand,
  Nunito,
  Dancing_Script,
  IBM_Plex_Mono,
} from "next/font/google";
import { Navbar } from "@/components/Navbar";
import "./globals.css";

const playfairDisplay = Playfair_Display({
  variable: "--font-heading",
  subsets: ["latin"],
  display: "swap",
});

const quicksand = Quicksand({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

const nunito = Nunito({
  variable: "--font-ui",
  subsets: ["latin"],
  display: "swap",
});

const dancingScript = Dancing_Script({
  variable: "--font-handwritten",
  subsets: ["latin"],
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  weight: ["400", "500"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Decipher — Your Story, Beautifully Told",
  description:
    "A gentle space to log your memories, fill in the blanks, and watch your story unfold — with Savid, your owl mentor, by your side.",
  manifest: "/manifest.json",
  icons: { icon: "/favicon.ico" },
};

export const viewport: Viewport = {
  themeColor: "#D4B8E0",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`
        ${playfairDisplay.variable}
        ${quicksand.variable}
        ${nunito.variable}
        ${dancingScript.variable}
        ${ibmPlexMono.variable}
        h-full
      `}
    >
      <body className="min-h-full flex flex-col">
        <Navbar />
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}