import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "3D ULPIN Vertical Property Mapping — SIH26011 Phase 1 Prototype",
  description:
    "Phase 1 prototype for SIH26011: vertical property mapping for Bengaluru. Connects cadastral parcels, OSM buildings and ML-estimated heights. Internal prototype IDs — not official ULPINs.",
  keywords: [
    "ULPIN",
    "3D Property Mapping",
    "Vertical Property Mapping",
    "GIS",
    "Bengaluru",
    "SIH 2026",
    "DoLR",
    "DILRMP",
  ],
  authors: [{ name: "SIH26011 Team" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
