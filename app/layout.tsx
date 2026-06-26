import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { Header } from "@/components/Header";

export const metadata: Metadata = {
  title: "Prediction Markets — Polymarket × Kalshi",
  description:
    "Live prediction-market odds across Polymarket and Kalshi — cross-exchange comparison, probability history, spreads, and order books.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen" suppressHydrationWarning>
        <Providers>
          <Header />
          <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
