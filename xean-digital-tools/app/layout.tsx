import type { Metadata, Viewport } from "next";
import "./globals.css";
import BottomNav from "@/components/navigation/BottomNav";

export const metadata: Metadata = {
  title: "Xean Digital Tools — All your media tools, in one place",
  description: "Paste a link and download media from TikTok, Instagram, YouTube, Facebook, X, Pinterest, Spotify and more.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <BottomNav />
      </body>
    </html>
  );
}
