// app/layout.tsx
import "./globals.css";
import TopNavClient from "./components/TopNavClient";
import { baybayinFont } from "./fonts";

export const metadata = {
  title: "Kabayan Hub",
  description: "OFW life & money playbook for Kabayans in Saudi Arabia.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`kh-light ${baybayinFont.variable}`}>
      <head>
        {/* Set theme BEFORE hydration to prevent mismatch */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
          (function () {
            try {
              var saved = localStorage.getItem("kh-theme");
              var theme = (saved === "dark" || saved === "light") ? saved : "light";
              var html = document.documentElement;
              html.classList.remove("kh-light", "kh-dark");
              html.classList.add(theme === "dark" ? "kh-dark" : "kh-light");
            } catch (e) {}
          })();`,
                    }}
        />
      </head>
      <body className="min-h-screen bg-[var(--kh-bg)] text-[var(--kh-text)] antialiased">
        {/* Background orbits / glow */}
        <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <div className="absolute -left-24 top-[-80px] h-64 w-64 rounded-full bg-[rgba(37,99,235,0.16)] blur-3xl" />
          <div className="absolute right-[-40px] top-32 h-72 w-72 rounded-full bg-[rgba(234,179,8,0.14)] blur-3xl" />
          <div className="absolute left-1/2 bottom-[-120px] h-80 w-80 -translate-x-1/2 rounded-full bg-[rgba(239,68,68,0.14)] blur-3xl" />
        </div>

        <div className="flex min-h-screen flex-col">
          <TopNavClient />

          <main className="mx-auto flex-1 w-full max-w-7xl px-4 md:px-6 lg:px-8 pb-14 pt-6 md:pt-10 lg:pt-12">
            <div className="page-fade space-y-6 md:space-y-8">{children}</div>
          </main>

          <footer className="border-t border-[var(--kh-border)] bg-[var(--kh-blue)]/90">
            <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 md:px-6 lg:px-8 py-4 text-[11px] text-[var(--kh-bg)] md:flex-row md:items-center md:justify-between">
              {/* ✅ Avoid hydration issue by NOT using new Date() directly */}
              <p suppressHydrationWarning>© Kabayan Hub. Built for OFWs.</p>

              <p className="flex items-center gap-1">
                <span className="inline-flex h-2 w-2 rounded-full bg-[var(--kh-yellow)]" />
                <span>Created by Kev with 💘.</span>
              </p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}

