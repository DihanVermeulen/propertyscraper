import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import QueryProvider from "../components/QueryProvider";
import { AuthProvider } from "../contexts/AuthContext";
import ProtectedLayout from "../components/layout/ProtectedLayout";
const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "KSP Property Scraper",
  description: "Real estate data dashboard with Property24 and Private Property scraping",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background min-h-screen`}>
        <QueryProvider>
          <AuthProvider>
            <ProtectedLayout>
              {children}
            </ProtectedLayout>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
