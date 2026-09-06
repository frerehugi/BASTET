import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "BASTET — Vorbegutachtung Post-COVID / ME-CFS",
  description:
    "Orientierende, KI-gestützte Ersteinschätzung für GdB und MdE bei Post-COVID/ME-CFS. Kein Ersatz für ärztliche oder rechtliche Beratung.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/assets/icon-192.png",
    apple: "/assets/icon-192.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de" className={inter.variable}>
      <body>
        <div className="topbar">
          <img src="/assets/bastet-badge.png" alt="BASTET" className="topbar-badge" />
          <span className="topbar-word">BASTET</span>
        </div>
        {children}
      </body>
    </html>
  );
}
