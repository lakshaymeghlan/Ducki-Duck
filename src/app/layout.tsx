import type { Metadata } from "next";
import { Fredoka, Inter } from "next/font/google";
import "./globals.css";

// Friendly rounded display face for headings + the duck's voice.
const fredoka = Fredoka({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// Clean sans for body and UI copy.
const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "doggy-dog 🐶",
  description:
    "The desktop dog that listens and never gives advice — it just woofs.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fredoka.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
