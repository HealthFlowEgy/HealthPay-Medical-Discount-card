import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HealthPay Quote Engine",
  description: "Medical-discount pricing quotes for partner platforms.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
