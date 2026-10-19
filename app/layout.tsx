import type { Metadata } from "next";
import { ChatWidget } from "@/app/chat/chat-widget";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "Abituriyent hazırlığı",
    template: "%s | Abituriyent hazırlığı"
  },
  description: "İmtahan təqvimi və Azərbaycan dilində izahlı abituriyent testləri.",
  alternates: {
    canonical: "/"
  },
  openGraph: {
    type: "website",
    locale: "az_AZ",
    siteName: "Abituriyent hazırlığı",
    title: "Abituriyent hazırlığı",
    description: "İmtahan təqvimi və Azərbaycan dilində izahlı abituriyent testləri."
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="az">
      <body>
        {children}
        <ChatWidget />
      </body>
    </html>
  );
}
