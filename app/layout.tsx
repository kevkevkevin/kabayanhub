import "./globals.css";
import TopNavClient from "./components/TopNavClient";

export const metadata = {
  title: "Kabayan Hub",
  description: "OFW life & money playbook for Kabayans in Saudi Arabia.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const year = new Date().getFullYear();

  return (
    <html lang="en" className="kh-light">
      <body className="kh-bg-pattern min-h-screen text-[var(--kh-text)] antialiased">
        {/* flex column so footer sticks to bottom */}
        <div className="flex min-h-screen flex-col">
          <TopNavClient />

          <main className="mx-auto flex-1 w-full max-w-6xl px-4 pb-10 pt-6 md:pt-8">
            {children}
          </main>

          <footer className="border-t border-[var(--kh-border)] bg-[var(--kh-blue)]/90">
            <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 text-[11px] text-[var(--kh-bg)] md:flex-row md:items-center md:justify-between">
              <p>© {year} Kabayan Hub. Built for OFWs.</p>
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
