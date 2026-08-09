import type { Metadata, Viewport } from "next";
import { Jost } from "next/font/google";
import "./globals.css";

const jost = Jost({
  variable: "--font-jost",
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
    <html lang="id" className={`${jost.variable} h-full`}>
      <body className="min-h-full overflow-x-clip antialiased text-[15px] leading-relaxed">
        {children}
      </body>
    </html>
  );
}
