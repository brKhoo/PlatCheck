import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PlatCheck",
  description: "Machine-Learning powered sell price estimator for Warframe items",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
