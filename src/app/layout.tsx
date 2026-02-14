import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { TopNav } from "@/components/top-nav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LoveLog",
  description: "Track moods, chat, and export insights.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <div className="min-h-screen bg-slate-50">
          <header className="border-b border-slate-200 bg-white">
            <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
              <div className="text-lg font-semibold text-slate-900">LoveLog</div>
              <div className="flex items-center gap-3">
                <TopNav />
                <Link
                  href="/settings"
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900"
                >
                  设置
                </Link>
              </div>
            </div>
          </header>
          <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
