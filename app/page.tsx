"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import Icon, { type IconName } from "./components/Icon";

const shortcuts: { title: string; caption: string; href: string; icon: IconName; color: string }[] = [
  { title: "News & updates", caption: "Stay in the know", href: "/news", icon: "news", color: "blue" },
  { title: "Learn something", caption: "Build your skills", href: "/videos", icon: "book", color: "red" },
  { title: "Budget tracker", caption: "Make every riyal count", href: "/budget", icon: "wallet", color: "yellow" },
  { title: "Find a job", caption: "Your next opportunity", href: "/market/jobs", icon: "briefcase", color: "blue" },
  { title: "Marketplace", caption: "Discover your rewards", href: "/marketplace", icon: "bag", color: "red" },
  { title: "Community", caption: "Your people are here", href: "/community", icon: "users", color: "yellow" },
];

const portals = {
  ph: [
    { title: "DMW / POEA", desc: "Overseas employment services", url: "https://dmw.gov.ph", icon: "briefcase" },
    { title: "SSS", desc: "Contributions & member benefits", url: "https://www.sss.gov.ph", icon: "shield" },
    { title: "Pag-IBIG", desc: "Savings & housing services", url: "https://www.pagibigfund.gov.ph", icon: "home" },
    { title: "PhilHealth", desc: "Health coverage & membership", url: "https://www.philhealth.gov.ph", icon: "heart" },
    { title: "DFA Passport", desc: "Passport & consular services", url: "https://www.dfa.gov.ph", icon: "globe" },
    { title: "BIR", desc: "Tax records & online services", url: "https://www.bir.gov.ph", icon: "news" },
  ],
  sa: [
    { title: "Absher", desc: "Residency & government services", url: "https://www.absher.sa", icon: "shield" },
    { title: "MOFA Visa", desc: "Visa services & applications", url: "https://visa.mofa.gov.sa", icon: "globe" },
    { title: "Musaned", desc: "Domestic worker services", url: "https://www.musaned.com.sa", icon: "home" },
    { title: "MHRSD", desc: "Labor & employment services", url: "https://www.mhrsd.gov.sa", icon: "briefcase" },
    { title: "Saudi Post", desc: "National address & delivery", url: "https://splonline.com.sa", icon: "bag" },
    { title: "Electricity", desc: "Bills & account services", url: "https://www.se.com.sa", icon: "sun" },
  ],
} satisfies Record<string, { title: string; desc: string; url: string; icon: IconName }[]>;

function DailyBrief() {
  const [now, setNow] = useState<Date | null>(null);
  const [rate, setRate] = useState<number | null>(null);
  const [rateDate, setRateDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timeout = setTimeout(() => controller.abort(), 10000);
    async function loadRate() {
      try {
        const response = await fetch("https://api.exchangerate-api.com/v4/latest/SAR", { signal: controller.signal });
        if (!response.ok) throw new Error("Rate unavailable");
        const data = await response.json();
        if (typeof data.rates?.PHP !== "number" || !Number.isFinite(data.rates.PHP) || data.rates.PHP <= 0) throw new Error("Invalid rate");
        if (active) { setRate(data.rates.PHP); setRateDate(typeof data.date === "string" ? data.date : ""); }
      } catch { if (active) setRate(null); }
      finally { clearTimeout(timeout); if (active) setLoading(false); }
    }
    void loadRate();
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [attempt]);

  return <div className="kh-daily-brief">
    <div><Icon name="clock" width={16} /><span>Saudi Arabia <strong>{now ? now.toLocaleTimeString("en-US", { timeZone: "Asia/Riyadh", hour: "numeric", minute: "2-digit" }) : "—"}</strong></span></div>
    <span className="kh-brief-divider" />
    <div className="kh-rate" title={rateDate ? `Indicative rate • ${rateDate} • ExchangeRate-API. Transfer rates may differ.` : "Indicative SAR to PHP exchange rate"}>
      <span>1 SAR <span aria-hidden="true">→</span> <strong>{loading ? "Loading…" : rate !== null ? `₱${rate.toFixed(2)}` : "Rate unavailable"}</strong></span>
      {!loading && rate === null && <button className="kh-text-button" onClick={() => { setLoading(true); setAttempt((value) => value + 1); }}>Retry</button>}
      {rate !== null && <span className="kh-rate-note">indicative</span>}
    </div>
  </div>;
}

export default function HomePage() {
  const [country, setCountry] = useState<"ph" | "sa">("ph");
  return (
    <div className="kh-home">
      <section className="kh-welcome">
        <div><p className="kh-eyebrow"><span className="kh-status-dot" />MADE FOR KABAYANS IN SAUDI</p><h1>A little closer to home.</h1><p>Your everyday essentials. Your next opportunity. Your community.</p></div>
        <DailyBrief />
      </section>

      <section className="kh-hero-grid" aria-label="Welcome to Kabayan Hub">
        <div className="kh-hero-art">
          <Image src="/mainheroIMG.png" alt="Tayo ang lakas! A Filipino superhero in Saudi Arabia. Kabayan Hub is your all-in-one community platform for Filipino workers in Saudi Arabia. Everything you need. One Hub. One Kabayan Family." width={1717} height={916} priority unoptimized />
          <div className="kh-hero-caption"><span><span className="kh-flag-mark" aria-hidden="true" />One hub. One Kabayan family.</span><a href="#explore" className="kh-inline-link">Explore the hub<Icon name="arrow" width={16} /></a></div>
        </div>
        <aside className="kh-welcome-card">
          <span className="kh-welcome-card-label"><Icon name="sun" width={17} />MAS MASAYA KAPAG SAMA-SAMA</span>
          <div className="kh-welcome-card-copy"><h2>Big dreams.{" "}<br />Small steps.{" "}<br /><em>Better together.</em></h2><p>Make life abroad a little easier—with useful tools, new skills, and a community that gets you.</p></div>
          <div className="kh-welcome-card-bottom"><Link href="/signup" className="kh-button kh-button-yellow">Find your place here<Icon name="arrow" width={18} /></Link><span>Free to join. Always a Kabayan.</span><Link href="/dashboard" className="kh-welcome-return">Already a member? Go to your dashboard <span aria-hidden="true">↗</span></Link></div>
          <span className="kh-card-sun" aria-hidden="true">✳</span>
        </aside>
      </section>

      <section id="explore" className="kh-explore" aria-labelledby="explore-title">
        <div className="kh-section-heading"><div><p className="kh-eyebrow">YOUR EVERYDAY, SIMPLIFIED</p><h2 id="explore-title">What brings you here today?</h2></div><span className="kh-heading-note">A little help goes a long way.</span></div>
        <div className="kh-shortcuts">{shortcuts.map((item) => <Link key={item.href} href={item.href} className="kh-shortcut"><span className={`kh-feature-icon kh-tone-${item.color}`}><Icon name={item.icon} width={23} height={23} /></span><strong>{item.title}</strong><span>{item.caption}</span><Icon name="arrow" className="kh-shortcut-arrow" width={16} /></Link>)}</div>
      </section>

      <section aria-labelledby="discover-title">
        <div className="kh-section-heading"><div><p className="kh-eyebrow">THERE’S MORE TO YOUR HUB</p><h2 id="discover-title">A space to grow. A place to belong.</h2></div></div>
        <div className="kh-discover-grid">
          <Link href="/community" className="kh-story-card"><div className="kh-story-image"><Image src="/news/tagumpay 1.jpg" alt="Kabayans gathering at a community event" width={640} height={360} unoptimized /><span className="kh-image-tag"><Icon name="users" width={14} />THE COMMUNITY</span></div><div className="kh-story-copy"><h3>Malayo man, magkakasama.</h3><p>Share a story, meet fellow Kabayans, and make yourself at home in the community.</p><span className="kh-inline-link">Join the conversation<Icon name="arrow" width={16} /></span></div></Link>
          <Link href="/arabic-quiz" className="kh-learning-card"><span className="kh-eyebrow">A LITTLE LEARNING, EVERY DAY</span><div className="kh-arabic-art" aria-hidden="true"><span lang="ar" dir="rtl">أهلاً</span><span>AHLAN · HELLO</span></div><div><h3>New country. New confidence.</h3><p>Build your Arabic, one useful phrase at a time. Start with a quick quiz.</p><span className="kh-inline-link">Let’s learn together<Icon name="arrow" width={16} /></span></div></Link>
          <div className="kh-local-card"><span className="kh-feature-icon kh-tone-yellow"><Icon name="home" width={26} height={26} /></span><p className="kh-eyebrow">A TASTE OF HOME</p><h3>Your favorites,<br />a little nearer.</h3><p>Find Filipino restaurants and Pinoy-friendly supermarkets around Saudi.</p><div><Link href="/market/restaurants" className="kh-local-link">Explore restaurants<Icon name="arrow" width={16} /></Link><Link href="/market/supermarkets" className="kh-local-link">Find supermarkets<Icon name="arrow" width={16} /></Link></div></div>
        </div>
      </section>

      <section className="kh-rewards-strip" aria-labelledby="rewards-title">
        <div className="kh-rewards-intro"><span className="kh-feature-icon kh-tone-yellow"><Icon name="gift" width={25} height={25} /></span><div><p className="kh-eyebrow">MAKE EVERY VISIT COUNT</p><h2 id="rewards-title">Good habits. Little rewards.</h2><Link href="/dashboard" className="kh-inline-link">View your Kabayan Points<Icon name="arrow" width={16} /></Link></div></div>
        <ol className="kh-reward-steps"><li><span>01</span><div><h3>Check in</h3><p>Make the hub part of your day.</p></div></li><li><span>02</span><div><h3>Learn & participate</h3><p>Build skills and collect points.</p></div></li><li><span>03</span><div><h3>Find your reward</h3><p>Explore available marketplace perks.</p></div></li></ol>
      </section>

      <section id="help-desk" className="kh-help" aria-labelledby="help-title">
        <div className="kh-section-heading"><div><p className="kh-eyebrow">SAVE YOURSELF THE SEARCH</p><h2 id="help-title">The important links, all together.</h2><p>Quick access to the government portals you need.</p></div><div className="kh-segmented" role="group" aria-label="Government portal country"><button aria-pressed={country === "ph"} onClick={() => setCountry("ph")}>Philippines</button><button aria-pressed={country === "sa"} onClick={() => setCountry("sa")}>Saudi Arabia</button></div></div>
        <div className="kh-portal-grid">{portals[country].map((portal) => <a key={portal.title} href={portal.url} target="_blank" rel="noopener noreferrer" className="kh-portal" aria-label={`${portal.title} — opens in a new tab`}><span className="kh-portal-icon"><Icon name={portal.icon} /></span><span><strong>{portal.title}</strong><small>{portal.desc}</small></span><Icon name="external" width={16} height={16} /></a>)}</div>
        <p className="kh-help-note"><Icon name="external" width={12} height={12} />Links open the respective government websites in a new tab.</p>
      </section>

      <section className="kh-community-note"><span className="kh-flag-mark" aria-hidden="true" /><div><h2>Built for the journey. Rooted in community.</h2><p>Our mission is simple: help every Kabayan in Saudi feel supported, informed, and ready for what’s next.</p></div><Link href="/signup" className="kh-button kh-button-secondary">Be part of the family<Icon name="arrow" width={16} /></Link></section>
    </div>
  );
}
