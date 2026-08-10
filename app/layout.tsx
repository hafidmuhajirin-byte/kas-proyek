import type { Metadata, Viewport } from "next";
import { Jost } from "next/font/google";
import { PwaRegister } from "@/components/PwaRegister";
import "./globals.css";

const jost = Jost({
  variable: "--font-jost",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Kas Proyek",
  description:
    "Pembukuan kas multi proyek dan multi sumber — sederhana untuk lapangan dan kantor",
  applicationName: "Kas Proyek",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Kas Proyek",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
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
        <PwaRegister />
      </body>
    </html>
  );
}
