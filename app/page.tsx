// app/page.tsx
"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import TambayanMoments from "./components/TambayanMoments";

export default function HomePage() {
  const heroImages = [
    { src: "/news/banner.jpg", alt: "Cheering OFWs", href: "/" },
    { src: "/news/tagumpay 1.jpg", alt: "Kabayans gathering", href: "/community/events" },
    { src: "/news/tagumpay 2.jpg", alt: "Community event", href: "/signup" },
  ];

  const [currentIndex, setCurrentIndex] = useState(0);

  // Dynamic greeting based on time
  const [greeting, setGreeting] = useState("Kamusta!");

  // ---------------------------------------------------------
  // 🌟 NEW FEATURES: Clock, Calendar, Forex State
  // ---------------------------------------------------------
  const [time, setTime] = useState<string>("");
  const [date, setDate] = useState<string>("");
  const [forex, setForex] = useState<string>("15.50");
  const [isWidgetOpen, setIsWidgetOpen] = useState(false); // For mobile toggle

  useEffect(() => {
    // 1. Greeting Logic
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Magandang Umaga, Kabayan! ☀️");
    else if (hour < 18) setGreeting("Magandang Hapon, Kabayan! 🌤️");
    else setGreeting("Magandang Gabi, Kabayan! 🌙");

    // 2. Clock & Date Logic
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }));
      setDate(now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }));
    };

    updateTime(); 
    const timer = setInterval(updateTime, 1000);

    // 3. Mock Forex (Replace with real API later)
    const mockForex = () => {
        const rate = (15.40 + Math.random() * 0.20).toFixed(2);
        setForex(rate);
    };
    mockForex();

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % heroImages.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [heroImages.length]);

  return (
    <>
      {/* ──────────────────────────────────────────────────
        🌟 WIDGET: OUTSIDE THE MAIN FLOW
        Positioned 'Fixed' so it floats above everything relative to the window.
        Adjust 'top-20' if you need it lower/higher below your Navbar.
        ──────────────────────────────────────────────────
      */}
      <div className="fixed z-[100] top-20 right-4 md:top-24 md:right-8 flex flex-col items-end pointer-events-none">
         
         {/* Mobile Toggle Button (Visible only on mobile) */}
         {/* pointer-events-auto needed because parent is pointer-events-none to let clicks pass through */}
         <button 
           onClick={() => setIsWidgetOpen(!isWidgetOpen)}
           className="pointer-events-auto md:hidden mb-2 glass-bubbly h-10 w-10 flex items-center justify-center rounded-full shadow-lg active:scale-95 transition-transform bg-white/90 text-lg border border-white/50"
         >
           {isWidgetOpen ? "✖️" : "📅"}
         </button>

         {/* The Widget Content */}
         <div className={`
             pointer-events-auto
             glass-bubbly p-3 rounded-2xl shadow-2xl border border-white/60 transition-all duration-300 origin-top-right
             ${isWidgetOpen ? "scale-100 opacity-100 translate-y-0" : "scale-0 opacity-0 translate-y-[-10px] md:scale-100 md:opacity-100 md:translate-y-0"}
             flex flex-col gap-2 min-w-[150px] bg-white/70 backdrop-blur-xl
         `}>
            {/* Date & Time */}
            <div className="text-center border-b border-slate-300/50 pb-2">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{date}</div>
                <div className="text-xl font-black text-slate-800 tracking-tight leading-none mt-0.5 font-mono">{time}</div>
            </div>

            {/* Forex */}
            <div className="text-center pt-1">
                <div className="text-[10px] font-bold text-slate-400 mb-1 flex items-center justify-center gap-1">
                    <span>🇸🇦 SAR</span> 
                    <span className="text-slate-300">→</span> 
                    <span>🇵🇭 PHP</span>
                </div>
                <div className="bg-gradient-to-r from-emerald-100 to-teal-100 rounded-xl py-1.5 px-2 border border-emerald-200/50 shadow-inner">
                    <span className="text-lg font-black text-emerald-800 tracking-tight">₱{forex}</span>
                </div>
            </div>
         </div>
      </div>

      {/* ──────────────────────────────────────────────────
          MAIN PAGE CONTENT
      ────────────────────────────────────────────────── */}
      <div className="space-y-12 pb-20">
        
        {/* ───────── HERO SECTION (BUBBLY STYLE) ───────── */}
        <section className="relative mt-4">
          {/* The colorful blob background behind hero */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-5xl bg-gradient-to-r from-blue-400/20 via-purple-400/20 to-pink-400/20 blur-3xl opacity-60 rounded-full -z-10" />

          <div className="mx-auto max-w-6xl px-4 md:px-6">
            <div className="grid lg:grid-cols-12 gap-6 items-center">
              
              {/* Left: Text Content */}
              <div className="lg:col-span-7 space-y-6 text-center lg:text-left z-10">
                {/* Welcome Pill */}
                <div className="inline-flex items-center gap-2 rounded-full glass-bubbly px-4 py-1.5 text-xs font-bold text-slate-800 shadow-sm animate-fade-in-up">
                  <span className="animate-pulse">👋</span> {greeting}
                </div>

                <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-[var(--kh-text)] leading-[1.1]">
                  Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--kh-blue)] to-cyan-500">Home Base</span> <br />
                  away from <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--kh-red)] to-pink-500">Home.</span>
                </h1>

                <p className="text-base md:text-lg text-[var(--kh-text-secondary)] leading-relaxed max-w-xl mx-auto lg:mx-0">
                  Kabayan Hub is the <b>super-app</b> for OFWs in Saudi. Stay updated, earn extra income, and collect <span className="font-bold text-[var(--kh-yellow)]">Kabayan Points</span> simply by hanging out.
                </p>

                <div className="flex flex-col sm:flex-row items-center gap-3 justify-center lg:justify-start pt-2">
                    <a
                      href="/dashboard"
                      className="hover-bounce relative inline-flex items-center justify-center rounded-full bg-[var(--kh-yellow)] px-8 py-4 text-sm font-extrabold text-slate-900 shadow-lg shadow-yellow-400/30 hover:bg-yellow-300 transition-all"
                    >
                      🚀 Start Earning Points
                    </a>
                    <a href="/about" className="text-sm font-semibold text-[var(--kh-text-muted)] hover:text-[var(--kh-blue)] transition px-4">
                      How does it work?
                    </a>
                </div>
              </div>

              {/* Right: Floating Bubbly Image */}
              <div className="lg:col-span-5 relative mt-8 lg:mt-0">
                {/* Decorative floating elements */}
                <div className="absolute -top-6 -right-6 z-20 floaty">
                  <div className="glass-bubbly rounded-2xl p-3 shadow-xl transform rotate-6">
                    <div className="text-2xl">💰</div>
                    <div className="text-[10px] font-bold text-slate-500 text-center">Earn</div>
                  </div>
                </div>
                <div className="absolute -bottom-6 -left-4 z-20 floaty kp-coin-delay-2">
                  <div className="glass-bubbly rounded-2xl p-3 shadow-xl transform -rotate-6">
                    <div className="text-2xl">🇵🇭</div>
                    <div className="text-[10px] font-bold text-slate-500 text-center">Connect</div>
                  </div>
                </div>

                {/* Main Image Container */}
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[2.5rem] shadow-2xl border-4 border-white/30">
                  <div
                    className="absolute inset-0 bg-cover bg-center transition-all duration-700 ease-in-out hover:scale-105"
                    style={{ backgroundImage: `url('${heroImages[currentIndex].src}')` }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-6 left-6 right-6">
                    <p className="text-white font-bold text-lg drop-shadow-md">
                      {heroImages[currentIndex].alt}
                    </p>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ───────── HOW IT WORKS (GAMIFIED) ───────── */}
        <section className="mx-auto max-w-6xl px-4">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-[var(--kh-text)]">Simple Routine, <span className="text-[var(--kh-yellow)]">Big Rewards</span></h2>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {/* Step 1 */}
            <div className="group hover-bounce kh-card border-none bg-gradient-to-br from-blue-50 to-white dark:from-slate-800 dark:to-slate-900 text-center relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-8xl transform translate-x-4 -translate-y-4">📝</div>
              <div className="w-12 h-12 mx-auto bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xl font-bold mb-4 shadow-sm">1</div>
              <h3 className="font-bold text-[var(--kh-text)]">Daily Check-in</h3>
              <p className="text-xs text-[var(--kh-text-secondary)] mt-2">Log in everyday. Think of it as your digital attendance. Instant points!</p>
            </div>

            {/* Step 2 */}
            <div className="group hover-bounce kh-card border-none bg-gradient-to-br from-yellow-50 to-white dark:from-slate-800 dark:to-slate-900 text-center relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-8xl transform translate-x-4 -translate-y-4">🧠</div>
              <div className="w-12 h-12 mx-auto bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center text-xl font-bold mb-4 shadow-sm">2</div>
              <h3 className="font-bold text-[var(--kh-text)]">Learn & Share</h3>
              <p className="text-xs text-[var(--kh-text-secondary)] mt-2">Watch a quick tutorial or share a money tip. Knowledge = Power + Points.</p>
            </div>

            {/* Step 3 */}
            <div className="group hover-bounce kh-card border-none bg-gradient-to-br from-pink-50 to-white dark:from-slate-800 dark:to-slate-900 text-center relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-8xl transform translate-x-4 -translate-y-4">🎁</div>
              <div className="w-12 h-12 mx-auto bg-pink-100 text-pink-600 rounded-full flex items-center justify-center text-xl font-bold mb-4 shadow-sm">3</div>
              <h3 className="font-bold text-[var(--kh-text)]">Redeem Rewards</h3>
              <p className="text-xs text-[var(--kh-text-secondary)] mt-2">Use points for digital tools, load, or community perks in the marketplace.</p>
            </div>
          </div>
        </section>

      {/* ───────── GOV HELP DESK (BENTO GRID) ───────── */}
      <section className="mt-16 mx-auto max-w-6xl px-4">
        {/* Header */}
        <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-[var(--kh-blue)] via-blue-800 to-[var(--kh-red)] p-8 md:p-12 text-white shadow-xl mb-10 text-center md:text-left">
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <div className="inline-block bg-white/20 backdrop-blur-md rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider mb-2">
                🚑 Emergency Kit
              </div>
              <h2 className="text-3xl md:text-4xl font-bold mb-2">Gov Help Desk</h2>
              <p className="text-blue-100 text-sm md:text-base max-w-md">
                No more confusing searches. Direct links to SSS, Absher, OEC, and everything else you need to survive adulting in Saudi.
              </p>
            </div>
            {/* Visual Icons */}
            <div className="flex gap-4">
              <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-3xl shadow-lg animate-bounce">🇵🇭</div>
              <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-3xl shadow-lg animate-bounce [animation-delay:0.2s]">🇸🇦</div>
            </div>
          </div>
          
          {/* Background pattern */}
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, white 2px, transparent 2px)', backgroundSize: '24px 24px' }}></div>
        </div>

        {/* The Grid */}
        <div className="grid md:grid-cols-2 gap-8">
          
          {/* 🇵🇭 PH GOV LINKS (Blue Theme) */}
          <div className="space-y-5">
            <div className="flex items-center gap-3 pl-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-100 text-xl shadow-sm">🇵🇭</span>
              <div>
                <h3 className="font-bold text-xl text-[var(--kh-text)]">Philippine Portals</h3>
                <p className="text-xs text-[var(--kh-text-secondary)]">SSS, Pag-IBIG, Passport & OEC</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { title: "DMW / POEA", desc: "Contracts, OEC, & job orders.", tag: "OFW Services", emoji: "🧳", url: "https://dmw.gov.ph" },
                { title: "SSS", desc: "Contributions, loans, & benefits.", tag: "Money", emoji: "💼", url: "https://www.sss.gov.ph" },
                { title: "Pag-IBIG", desc: "Savings, MP2, & housing loans.", tag: "Savings", emoji: "🏠", url: "https://www.pagibigfund.gov.ph" },
                { title: "PhilHealth", desc: "Health coverage & member info.", tag: "Health", emoji: "🩺", url: "https://www.philhealth.gov.ph" },
                { title: "DFA Passport", desc: "Appointments & travel advisories.", tag: "Documents", emoji: "🛂", url: "https://www.dfa.gov.ph" },
                { title: "BIR", desc: "TIN, tax records & eBIR forms.", tag: "Tax", emoji: "🧾", url: "https://www.bir.gov.ph" },
              ].map((item) => (
                <a
                  key={item.title}
                  href={item.url}
                  target="_blank"
                  className="group relative flex flex-col justify-between rounded-[2rem] border border-blue-50 bg-white  p-5 shadow-sm transition-all hover:-translate-y-1 hover:border-blue-300 hover:shadow-[0_10px_40px_-10px_rgba(59,130,246,0.15)]"
                >
                  <div>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-xl text-blue-600 group-hover:scale-110 transition-transform dark:bg-blue-900/30 dark:text-blue-300">
                        {item.emoji}
                      </div>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wide dark:bg-slate-700 dark:text-slate-300">
                        {item.tag}
                      </span>
                    </div>
                    <h4 className="font-bold text-[var(--kh-text)] group-hover:text-blue-600 transition-colors">
                      {item.title}
                    </h4>
                    <p className="mt-1 text-xs text-[var(--kh-text-secondary)] leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                  <div className="mt-4 flex items-center text-[11px] font-bold text-blue-500 opacity-60 group-hover:opacity-100 transition-opacity">
                    Open site <span className="ml-1 transition-transform group-hover:translate-x-1">→</span>
                  </div>
                </a>
              ))}
            </div>
          </div>

          {/* Saudi Column */}
          <div className="space-y-5">
          <div className="flex items-center gap-3 pl-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-xl shadow-sm">🇸🇦</span>
            <div>
              <h3 className="font-bold text-xl text-[var(--kh-text)]">Saudi Essentials</h3>
              <p className="text-xs text-[var(--kh-text-secondary)]">Iqama, Visa, Labor & Utilities</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { title: "Absher", desc: "Iqama, fines, exit/re-entry.", tag: "Residency", emoji: "📲", url: "https://www.absher.sa" },
              { title: "MOFA Visa", desc: "Family visit visa & status.", tag: "Visas", emoji: "🎫", url: "https://visa.mofa.gov.sa" },
              { title: "Musaned", desc: "Domestic worker contracts.", tag: "Household", emoji: "🧹", url: "https://www.musaned.com.sa" },
              { title: "MHRSD (Labor)", desc: "Labor laws & complaints.", tag: "Labor", emoji: "⚖️", url: "https://www.mhrsd.gov.sa" },
              { title: "Saudi Post", desc: "National address & delivery.", tag: "Deliveries", emoji: "📦", url: "https://splonline.com.sa" },
              { title: "Electricity", desc: "Bills & account services.", tag: "Utilities", emoji: "💡", url: "https://www.se.com.sa" },
            ].map((item) => (
              <a
                key={item.title}
                href={item.url}
                target="_blank"
                className="group relative flex flex-col justify-between rounded-[2rem] border border-emerald-50 bg-white  p-5 shadow-sm transition-all hover:-translate-y-1 hover:border-emerald-300 hover:shadow-[0_10px_40px_-10px_rgba(16,185,129,0.15)]"
              >
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-xl text-emerald-600 group-hover:scale-110 transition-transform dark:bg-emerald-900/30 dark:text-emerald-300">
                      {item.emoji}
                    </div>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wide dark:bg-slate-700 dark:text-slate-300">
                      {item.tag}
                    </span>
                  </div>
                  <h4 className="font-bold text-[var(--kh-text)] group-hover:text-emerald-600 transition-colors">
                    {item.title}
                  </h4>
                  <p className="mt-1 text-xs text-[var(--kh-text-secondary)] leading-relaxed">
                    {item.desc}
                  </p>
                </div>
                <div className="mt-4 flex items-center text-[11px] font-bold text-emerald-500 opacity-60 group-hover:opacity-100 transition-opacity">
                  Open site <span className="ml-1 transition-transform group-hover:translate-x-1">→</span>
                </div>
              </a>
            ))}
          </div>
        </div>

        </div>
      </section>

      {/* ───────── MISSION/VISION (Softer) ───────── */}
      <section className="mx-auto max-w-6xl px-4 grid md:grid-cols-2 gap-4 text-xs">
          <div className="glass-bubbly p-6 rounded-[2rem] text-center">
            <h4 className="font-bold text-[var(--kh-blue)] mb-2 uppercase tracking-wide">Our Mission</h4>
            <p className="text-[var(--kh-text-secondary)]">To provide a cozy online home where Kabayans feel safe, supported, and informed.</p>
          </div>
          <div className="glass-bubbly p-6 rounded-[2rem] text-center">
            <h4 className="font-bold text-[var(--kh-yellow)] mb-2 uppercase tracking-wide">Our Vision</h4>
            <p className="text-[var(--kh-text-secondary)]">A future where every OFW in Saudi is financially confident and digitally savvy.</p>
          </div>
      </section>

    </div>
    </>
  );
}