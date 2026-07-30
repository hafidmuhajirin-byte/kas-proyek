import type { Metadata, Viewport } from "next";
import { Figtree, Fraunces } from "next/font/google";
import "./globals.css";

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Kas Proyek",
  description:
    "Pembukuan kas multi proyek dan multi sumber — sederhana untuk lapangan dan kantor",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1f4a43",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${figtree.variable} ${fraunces.variable} h-full`}
    >
      <body className="min-h-full overflow-x-clip antialiased text-[15px] leading-relaxed">
        {children}
      </body>
    </html>
  );
}
