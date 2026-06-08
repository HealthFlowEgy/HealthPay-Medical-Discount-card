import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "MediBook — powered by HealthPay",
  description: "Demo partner platform integrating the HealthPay Quote Engine.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-3">
            <Link href="/" className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-white">M</span>
              <span className="text-lg font-bold text-ink">MediBook</span>
              <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-600">
                demo partner
              </span>
            </Link>
            <span className="text-xs text-ink-400">powered by HealthPay Quote Engine</span>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
