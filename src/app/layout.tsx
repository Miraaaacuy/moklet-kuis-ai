import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "Kuis AI — Moklet Mengajar",
  description: "Quiz interaktif tentang Kecerdasan Buatan: tebak gambar AI atau asli, kumpulkan poin!",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#6d28d9",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body className={`${nunito.variable} font-sans antialiased`}>{children}</body>
    </html>
  );
}
