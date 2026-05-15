import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Career Navigator",
  description: "Career Navigator",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="border-b-4 border-black bg-white/80 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border-3 border-black bg-yellow-300 text-sm font-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                CN
              </div>
              <div>
                <div className="text-lg font-black leading-none">Career Navigator</div>
                <div className="text-xs font-bold opacity-80">Brutal UI mode</div>
              </div>
            </div>

            <nav className="flex flex-wrap items-center gap-3">
              <Link
                href="/agora"
                className="rounded-lg border-3 border-black bg-white px-3 py-2 text-xs font-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-[1px] active:translate-y-[0px]"
              >
                Video Call
              </Link>
              <Link
                href="/ai/chat"
                className="rounded-lg border-3 border-black bg-white px-3 py-2 text-xs font-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-[1px] active:translate-y-[0px]"
              >
                AI Chat
              </Link>
              <Link
                href="/auth/login"
                className="rounded-lg border-3 border-black bg-white px-3 py-2 text-xs font-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-[1px] active:translate-y-[0px]"
              >
                Login
              </Link>
              <Link
                href="/admin/analytics"
                className="rounded-lg border-3 border-black bg-white px-3 py-2 text-xs font-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-[1px] active:translate-y-[0px]"
              >
                Admin
              </Link>
            </nav>
          </div>
        </div>

        <div className="mx-auto max-w-6xl">{children}</div>

        <footer className="border-t-4 border-black p-4 text-center text-xs font-bold opacity-80">
          Built for Milestones: Auth • AI • Video • Admin
        </footer>
      </body>
    </html>
  );
}
