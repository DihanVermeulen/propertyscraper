import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import QueryProvider from "../components/QueryProvider";
import { AppSidebar } from "../components/layout/Sidebar";
import { SidebarProvider, SidebarTrigger } from "../components/ui/sidebar";
import TopBar from "../components/layout/TopBar";
const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "Property Scraper Dashboard",
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
          <SidebarProvider>
            <AppSidebar />
            <main className="flex flex-1 flex-col transition-all duration-300 ease-in-out">
              <div className="flex items-center gap-2 p-4 border-b">
                <SidebarTrigger />
                <TopBar />
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                {children}
              </div>
            </main>
          </SidebarProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
