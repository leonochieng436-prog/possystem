import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DukaOS — Business Operating System",
  description:
    "Point of sale, inventory, suppliers, customers and financials for Kenyan businesses.",
  icons: {
    icon: "/images/DukaOS-logo.png",
    shortcut: "/images/DukaOS-logo.png",
    apple: "/images/DukaOS-logo.png",
  },
  openGraph: {
    title: "DukaOS — Business Operating System",
    description:
      "Point of sale, inventory, suppliers, customers and financials for Kenyan businesses.",
    images: ["/images/DukaOS-logo.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "DukaOS — Business Operating System",
    description:
      "Point of sale, inventory, suppliers, customers and financials for Kenyan businesses.",
    images: ["/images/DukaOS-logo.png"],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
