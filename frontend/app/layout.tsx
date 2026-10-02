import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Sidebar } from "@/components/sidebar";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "pip Voice AI — Analytics Dashboard",
  description: "AI analytics & model observability dashboard for pip Voice AI",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-slate-950 font-sans text-slate-100 antialiased">
        <Sidebar />
        <div className="min-w-0 pl-64">{children}</div>
      </body>
    </html>
  );
}
