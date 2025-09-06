import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Login - KSP Property Scraper",
  description: "Admin access to property scraper dashboard",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">KSP Property Scraper</h1>
          <p className="text-slate-300">Admin Dashboard Access</p>
        </div>
        {children}
      </div>
    </div>
  );
}
