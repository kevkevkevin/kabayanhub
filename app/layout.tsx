// app/layout.tsx
import "./globals.css";
import TopNavClient from "./components/TopNavClient";
import { baybayinFont } from "./fonts";
import Link from "next/link";
import Image from "next/image";
import Icon from "./components/Icon";
import Script from "next/script";

export const metadata = {
  title: "Kabayan Hub",
  description: "Kabayan Hub is the digital home base for OFWs in Saudi Arabia. We turn your daily browsing into benefits—providing a single space to check the latest news, learn new skills, and earn points redeemable for food vouchers and exclusive prizes.",
  icons: {
    icon: "/logomain.png", // Place your image in the 'public' folder
    // You can also specify different sizes if needed:
    // apple: '/apple-icon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={`kh-light ${baybayinFont.variable}`}>
      <head>
        {/* Set theme BEFORE hydration to prevent mismatch */}
        <script
          id="kabayan-theme"
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
        <Script id="kabayan-adsense" strategy="afterInteractive" src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1065176831395240" crossOrigin="anonymous" />
        <a href="#main-content" className="kh-skip-link">Skip to content</a>
        <div className="kh-site">
          <TopNavClient />

          <main id="main-content" tabIndex={-1} className="kh-main">
            <div className="kh-page-content page-fade">{children}</div>
          </main>

          <footer className="kh-footer">
            <div className="kh-footer-inner">
              <div className="kh-footer-about">
                <Link href="/" className="kh-brand" aria-label="Kabayan Hub home"><Image src="/logomain.png" alt="" width={38} height={38} unoptimized /><span>Kabayan<span className="kh-brand-blue">Hub</span><small>YOUR HOME AWAY FROM HOME</small></span></Link>
                <p>Connecting Filipino hearts and everyday lives in Saudi Arabia. One hub. One Kabayan family.</p>
              </div>
              <nav className="kh-footer-links" aria-label="Footer navigation">
                <div><strong>Explore</strong><Link href="/news">News & updates</Link><Link href="/community">Community</Link><Link href="/leaderboard">KP leaderboard</Link><Link href="/tambayan">Live Tambayan</Link><Link href="/market/jobs">Job board</Link></div>
                <div><strong>For your everyday</strong><Link href="/videos">Learn & tutorials</Link><Link href="/budget">Budget tracker</Link><Link href="/marketplace">Marketplace</Link></div>
                <div><strong>Your hub</strong><Link href="/dashboard">My dashboard</Link><Link href="/settings">Profile & settings</Link><Link href="/#help-desk">Government portals</Link></div>
              </nav>
            </div>
            <div className="kh-footer-bottom"><p>© Kabayan Hub. Built for OFWs.</p><span>Made with <Icon name="heart" width={12} height={12} /> by Kev</span></div>
          </footer>
        </div>
      </body>
    </html>
  );
}
