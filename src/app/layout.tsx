import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gokul Connect — Multi-Business WhatsApp Automation & Customer Management",
  description: "Independent multi-business platform for Gokul's Astrological Insights and Gokul Vivaham",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased selection:bg-indigo-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
