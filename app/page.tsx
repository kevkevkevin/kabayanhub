// app/page.tsx
"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

export default function HomePage() {
  // 1. UPDATE: Add 'href' to each image object
  const heroImages = [
    {
      src: "/news/banner.jpg",
      alt: "Cheering OFWs holding a Philippine flag",
      href: "/", // Where should this slide go?
    },
    {
      src: "/news/tagumpay 1.jpg", 
      alt: "Kabayans gathering together",
      href: "/community/events", // Where should this slide go?
    },
    {
      src: "/news/tagumpay 2.jpg",
      alt: "Community event in Saudi",
      href: "/signup", // Where should this slide go?
    },
  ];

  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % heroImages.length);
    }, 4000);

    return () => clearInterval(interval);
  }, [heroImages.length]);

  return (
    <div className="space-y-12 md:space-y-16">
      {/* Hero */}
      <section className="grid gap-8 md:grid-cols-[1.2fr,1fr] md:items-center">
        <div className="space-y-4">
          <p className="inline-flex items-center gap-2 rounded-full border border-[var(--kh-border)] bg-[var(--kh-bg-card)] px-3 py-1 text-[11px] text-[var(--kh-text-muted)] shadow-[var(--kh-card-shadow)]">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--kh-yellow-soft)] text-[10px]">
              🇵🇭
            </span>
            <span>Made by Kabayans, for Kabayans in Saudi</span>
          </p>

          <h1 className="text-3xl font-semibold leading-tight text-[var(--kh-text)] md:text-4xl">
            Your <span className="text-[var(--kh-blue)]">Kabayan HQ</span> in
            Saudi for{" "}
            <span className="text-[var(--kh-yellow)]">news, income tips</span>,
            and rewards.
          </h1>

          <p className="max-w-xl text-sm text-[var(--kh-text-secondary)] md:text-base">
            Kabayan Hub keeps OFWs updated with life in Saudi, teaches you
            simple ways to earn online, and rewards you with{" "}
            <span className="font-semibold">Kabayan Points</span> you can redeem
            in our marketplace. Isang website lang — for news, learning, and
            rewards habang nag-iinternet ka.
          </p>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/signup"
              className="rounded-full bg-[var(--kh-yellow)] px-5 py-2 text-xs font-semibold text-slate-900 shadow-[var(--kh-card-shadow)] hover:brightness-110 md:text-sm"
            >
              Start earning Kabayan Points
            </Link>
            <Link
              href="/news"
              className="rounded-full border border-[var(--kh-border)] bg-[var(--kh-bg-card)] px-5 py-2 text-xs font-semibold text-[var(--kh-text)] hover:border-[var(--kh-border-strong)] hover:bg-[var(--kh-bg-subtle)] md:text-sm"
            >
              Browse Saudi news
            </Link>
          </div>

          <div className="mt-3 grid gap-3 text-[11px] text-[var(--kh-text-muted)] md:grid-cols-3">
            <div className="rounded-2xl bg-[var(--kh-bg-subtle)] px-3 py-2">
              <p className="font-semibold text-[var(--kh-text)]">
                🇸🇦 For OFWs in Saudi
              </p>
              <p>
                Curated news, reminders, and life updates relevant sa&apos;yo.
              </p>
            </div>
            <div className="rounded-2xl bg-[var(--kh-bg-subtle)] px-3 py-2">
              <p className="font-semibold text-[var(--kh-text)]">
                🎓 Learn &amp; earn online
              </p>
              <p>
                Short tutorials on side hustles, freelancing, and money tips.
              </p>
            </div>
            <div className="rounded-2xl bg-[var(--kh-bg-subtle)] px-3 py-2">
              <p className="font-semibold text-[var(--kh-text)]">
                🪙 Kabayan Points
              </p>
              <p>
                Earn points from daily check-ins, reading, watching, sharing.
              </p>
            </div>
          </div>
        </div>

        {/* Hero SLIDER image */}
        <div className="relative">
          <div className="rounded-3xl border border-[var(--kh-border)] bg-[var(--kh-bg-card)] p-2 shadow-[0_18px_45px_rgba(15,23,42,0.16)]">
            <div className="relative h-56 w-full overflow-hidden rounded-2xl bg-[var(--kh-bg-subtle)] md:h-72">
              {heroImages.map((image, index) => (
                // 2. UPDATE: Wrap img in Link
                <Link
                  key={index}
                  href={image.href}
                  // We move the absolute/opacity classes to the Link container
                  // Added 'pointer-events-none' to hidden slides so you don't click the wrong one
                  className={`absolute left-0 top-0 h-full w-full transition-opacity duration-1000 ease-in-out ${
                    index === currentIndex 
                      ? "opacity-100 pointer-events-auto" 
                      : "opacity-0 pointer-events-none"
                  }`}
                >
                  <img
                    src={image.src}
                    alt={image.alt}
                    className="h-full w-full object-cover"
                  />
                </Link>
              ))}
            </div>

            <div className="mt-3 flex items-center justify-between gap-2 text-[11px]">
              <p className="font-semibold text-[var(--kh-text)]">
                “Sama-sama tayong aangat.”
              </p>
              <span className="rounded-full bg-[var(--kh-blue-soft)] px-3 py-1 text-[10px] font-medium text-[var(--kh-blue)]">
                Built for Kabayans in Saudi 🇵🇭🇸🇦
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="rounded-3xl border border-[var(--kh-border)] bg-[var(--kh-bg-card)] p-4 shadow-[var(--kh-card-shadow)] md:p-6">
        <h2 className="text-sm font-semibold text-[var(--kh-text)] md:text-base">
          How Kabayan Hub works
        </h2>
        <p className="mt-1 text-[11px] text-[var(--kh-text-secondary)] md:text-xs">
          Simple routine para sa OFW na busy: open Kabayan Hub, do your daily
          tasks, slowly build{" "}
          <span className="font-semibold">knowledge + points</span>.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl bg-[var(--kh-bg-subtle)] p-3 text-xs">
            <p className="text-[11px] font-semibold text-[var(--kh-text-secondary)]">
              STEP 1 — CHECK IN
            </p>
            <p className="mt-1 text-[var(--kh-text)]">
              Log in, tap your{" "}
              <span className="font-semibold">daily check-in</span>, and get
              instant Kabayan Points. Think of it as your digital “attendance”.
            </p>
          </div>
          <div className="rounded-2xl bg-[var(--kh-bg-subtle)] p-3 text-xs">
            <p className="text-[11px] font-semibold text-[var(--kh-text-secondary)]">
              STEP 2 — LEARN &amp; SHARE
            </p>
            <p className="mt-1 text-[var(--kh-text)]">
              Read Saudi news, watch tutorials on earning online, then{" "}
              <span className="font-semibold">share</span> helpful content to
              friends for extra points.
            </p>
          </div>
          <div className="rounded-2xl bg-[var(--kh-bg-subtle)] p-3 text-xs">
            <p className="text-[11px] font-semibold text-[var(--kh-text-secondary)]">
              STEP 3 — REDEEM
            </p>
            <p className="mt-1 text-[var(--kh-text)]">
              Use your points in the Kabayan marketplace for future perks,
              digital tools, and community rewards.
            </p>
          </div>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl border border-[var(--kh-border)] bg-[var(--kh-bg-card)] p-4 shadow-[var(--kh-card-shadow)] md:p-6">
          <h2 className="text-sm font-semibold text-[var(--kh-text)] md:text-base">
            Our Mission
          </h2>
          <p className="mt-2 text-sm text-[var(--kh-text-secondary)]">
            To give every Kabayan in Saudi a simple online “home base” where
            they can{" "}
            <span className="font-semibold">
              stay informed, grow their income, and feel supported
            </span>{" "}
            — even if malayo sa pamilya.
          </p>
          <ul className="mt-3 space-y-1.5 text-xs text-[var(--kh-text-secondary)]">
            <li>• Curated news and reminders relevant to OFWs in Saudi</li>
            <li>• Simple, Taglish explanations for government updates</li>
            <li>• Practical lessons on earning and managing money</li>
          </ul>
        </div>

        <div className="rounded-3xl border border-[var(--kh-border)] bg-[var(--kh-bg-card)] p-4 shadow-[var(--kh-card-shadow)] md:p-6">
          <h2 className="text-sm font-semibold text-[var(--kh-text)] md:text-base">
            Our Vision
          </h2>
          <p className="mt-2 text-sm text-[var(--kh-text-secondary)]">
            A future where OFWs are{" "}
            <span className="font-semibold">
              informed, empowered, and financially confident
            </span>
            — using tech, community, and good information to build better lives
            for their families.
          </p>
          <ul className="mt-3 space-y-1.5 text-xs text-[var(--kh-text-secondary)]">
            <li>• OFWs who understand their rights &amp; benefits</li>
            <li>• More Kabayans exploring online income &amp; skills</li>
            <li>• A supportive digital community, hindi lang trabaho–bahay</li>
          </ul>
        </div>
      </section>

      {/* Why Kabayan Hub */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--kh-text)] md:text-base">
          Why Kabayan Hub?
        </h2>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-3xl border border-[var(--kh-border)] bg-[var(--kh-bg-card)] p-4 text-xs shadow-[var(--kh-card-shadow)]">
            <p className="text-[11px] font-semibold text-[var(--kh-text-secondary)]">
              📰 News for Kabayans
            </p>
            <p className="mt-1 text-[var(--kh-text-secondary)]">
              Updates on Saudi rules, work, and daily life — written for
              Filipinos, hindi puro legal jargon.
            </p>
            <Link
              href="/news"
              className="mt-2 inline-flex text-[11px] font-semibold text-[var(--kh-blue)] underline-offset-2 hover:underline"
            >
              Go to News &amp; Updates →
            </Link>
          </div>
          <div className="rounded-3xl border border-[var(--kh-border)] bg-[var(--kh-bg-card)] p-4 text-xs shadow-[var(--kh-card-shadow)]">
            <p className="text-[11px] font-semibold text-[var(--kh-text-secondary)]">
              🎥 Learn &amp; Tutorials
            </p>
            <p className="mt-1 text-[var(--kh-text-secondary)]">
              Short videos on freelancing, online work, and money basics – para
              may dagdag kaalaman habang break time.
            </p>
            <Link
              href="/videos"
              className="mt-2 inline-flex text-[11px] font-semibold text-[var(--kh-blue)] underline-offset-2 hover:underline"
            >
              Go to Learn &amp; Tutorials →
            </Link>
          </div>
          <div className="rounded-3xl border border-[var(--kh-border)] bg-[var(--kh-bg-card)] p-4 text-xs shadow-[var(--kh-card-shadow)]">
            <p className="text-[11px] font-semibold text-[var(--kh-text-secondary)]">
              🎁 Rewards &amp; Marketplace
            </p>
            <p className="mt-1 text-[var(--kh-text-secondary)]">
              Turn your time online into Kabayan Points you can redeem for
              digital tools, perks, and future community rewards.
            </p>
            <Link
              href="/marketplace"
              className="mt-2 inline-flex text-[11px] font-semibold text-[var(--kh-blue)] underline-offset-2 hover:underline"
            >
              Visit the marketplace →
            </Link>
          </div>
        </div>
      </section>

      {/* ──────────────────────────────── */}
{/* 🇵🇭 + 🇸🇦 GOV HELP DESK FOR KABAYANS */}
{/* ──────────────────────────────── */}
<section className="mt-16 space-y-10">
  {/* Header */}
  <div className="relative overflow-hidden rounded-3xl border border-[var(--kh-border)] bg-white/80 px-4 py-5 shadow-[0_10px_40px_rgba(15,23,42,0.08)] md:px-8">
    {/* soft flags in the back */}
    <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br from-[#0038A8]/8 via-[#FCD116]/10 to-[#CE1126]/8 blur-2xl" />
    <div className="pointer-events-none absolute -left-10 -bottom-10 h-32 w-32 rounded-full bg-gradient-to-tr from-[#006C35]/10 via-[#FFFFFF]/5 to-[#006C35]/10 blur-2xl" />

    <div className="inline-flex items-center gap-2 rounded-full bg-slate-900 text-[10px] font-medium text-white px-3 py-1 shadow-sm">
      <span className="text-xs">🛟</span>
      <span>Gov help desk for Kabayans</span>
    </div>

    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-xl md:text-2xl font-semibold text-slate-900">
          Official links for <span className="text-[var(--kh-blue)]">documents</span>,{" "}
          <span className="text-[var(--kh-yellow)]">money</span>, and{" "}
          <span className="text-[var(--kh-red)]">residency</span>.
        </h2>
        <p className="mt-1 text-xs md:text-sm text-slate-600">
          Shortcut na — one place for PH & Saudi portals na madalas kailangan ng OFWs.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 text-[10px] md:text-[11px]">
        <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
          📄 For documents
        </span>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
          💸 For money & benefits
        </span>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
          🪪 For residency / visas
        </span>
      </div>
    </div>
  </div>

  {/* GRID: PH + SAUDI COLUMNS */}
  <div className="grid gap-8 md:grid-cols-2">
    {/* 🇵🇭 PH GOV LINKS */}
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-[#0038A8] via-[#FCD116] to-[#CE1126] text-xs text-white shadow-md">
            🇵🇭
          </span>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Philippine government portals
            </h3>
            <p className="text-[11px] text-slate-500">
              For SSS, Pag-IBIG, PhilHealth, DMW / POEA, and more.
            </p>
          </div>
        </div>
        <span className="rounded-full bg-amber-100 px-3 py-1 text-[10px] font-semibold text-amber-800">
          ⭐ Most used by OFWs
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {[
          {
            title: "DFA",
            desc: "Passport appointments, renewals, travel advisories.",
            url: "https://www.dfa.gov.ph",
            tag: "Documents",
            emoji: "🛂",
          },
          {
            title: "DMW / POEA",
            desc: "OFW services, contracts, OEC, job orders.",
            url: "https://dmw.gov.ph",
            tag: "OFW services",
            emoji: "🧳",
          },
          {
            title: "SSS",
            desc: "Contributions, loans, benefits checker.",
            url: "https://www.sss.gov.ph",
            tag: "Money",
            emoji: "💼",
          },
          {
            title: "Pag-IBIG",
            desc: "Savings, MP2, housing & cash loans.",
            url: "https://www.pagibigfund.gov.ph",
            tag: "Savings / loans",
            emoji: "🏠",
          },
          {
            title: "PhilHealth",
            desc: "Health coverage, member info & benefits.",
            url: "https://www.philhealth.gov.ph",
            tag: "Health",
            emoji: "🩺",
          },
          {
            title: "BIR",
            desc: "TIN, tax records & eBIR forms.",
            url: "https://www.bir.gov.ph",
            tag: "Tax",
            emoji: "🧾",
          },
        ].map((item) => (
          <a
            key={item.title}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex flex-col rounded-2xl border border-slate-200/80 bg-white/80 p-4 shadow-[0_4px_18px_rgba(15,23,42,0.04)]
            transition-transform hover:-translate-y-1 hover:shadow-[0_10px_30px_rgba(15,23,42,0.12)]
            hover:border-transparent hover:bg-gradient-to-br hover:from-slate-50 hover:via-white hover:to-amber-50"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900/90 text-lg text-white shadow-sm group-hover:scale-110 transition-transform">
                {item.emoji}
              </div>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
                {item.tag}
              </span>
            </div>
            <p className="mt-3 text-sm font-semibold text-slate-900">
              {item.title}
            </p>
            <p className="mt-1 text-[11px] text-slate-600 leading-snug">
              {item.desc}
            </p>
            <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-medium text-[var(--kh-blue)] group-hover:text-slate-900">
              Open site
              <span className="translate-y-[1px] transition-transform group-hover:translate-x-0.5">
                ↗
              </span>
            </span>
          </a>
        ))}
      </div>
    </div>

    {/* 🇸🇦 SAUDI GOV LINKS */}
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-[#006C35] via-white to-[#006C35] text-xs text-emerald-900 shadow-md">
            🇸🇦
          </span>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Saudi government portals
            </h3>
            <p className="text-[11px] text-slate-500">
              For Iqama, visas, labor concerns, addresses, and deliveries.
            </p>
          </div>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-semibold text-emerald-700">
          🪪 For Iqama & residency
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {[
          {
            title: "Absher",
            desc: "Iqama, traffic fines, exit/re-entry, family members.",
            url: "https://www.absher.sa",
            tag: "Residency",
            emoji: "🟢",
          },
          {
            title: "MOFA Visa",
            desc: "Family visit visa, status tracking, approvals.",
            url: "https://visa.mofa.gov.sa",
            tag: "Visas",
            emoji: "📝",
          },
          {
            title: "MUSANED",
            desc: "Domestic worker contracts, complaints, info.",
            url: "https://www.musaned.com.sa",
            tag: "Household",
            emoji: "🏡",
          },
          {
            title: "MHRSD (Labor)",
            desc: "Labor laws, complaints, work disputes.",
            url: "https://www.mhrsd.gov.sa",
            tag: "Labor",
            emoji: "⚖️",
          },
          {
            title: "Saudi Post (SPL)",
            desc: "Wasel address, parcels, delivery tracking.",
            url: "https://splonline.com.sa",
            tag: "Deliveries",
            emoji: "📦",
          },
          {
            title: "Saudi Electricity",
            desc: "Bills, account info, e-services.",
            url: "https://www.se.com.sa",
            tag: "Utilities",
            emoji: "💡",
          },
        ].map((item) => (
          <a
            key={item.title}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex flex-col rounded-2xl border border-emerald-100 bg-white/80 p-4 shadow-[0_4px_18px_rgba(15,23,42,0.04)]
            transition-transform hover:-translate-y-1 hover:shadow-[0_10px_30px_rgba(15,23,42,0.12)]
            hover:border-transparent hover:bg-gradient-to-br hover:from-emerald-50 hover:via-white hover:to-emerald-50"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-lg text-white shadow-sm group-hover:scale-110 transition-transform">
                {item.emoji}
              </div>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-700">
                {item.tag}
              </span>
            </div>
            <p className="mt-3 text-sm font-semibold text-slate-900">
              {item.title}
            </p>
            <p className="mt-1 text-[11px] text-slate-600 leading-snug">
              {item.desc}
            </p>
            <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 group-hover:text-slate-900">
              Open site
              <span className="translate-y-[1px] transition-transform group-hover:translate-x-0.5">
                ↗
              </span>
            </span>
          </a>
        ))}
      </div>
    </div>
  </div>
</section>

    </div>
  );
}

/** Small helper component for gov link cards */
type GovLinkProps = {
  name: string;
  description: string;
  href: string;
};

function GovLinkCard({ name, description, href }: GovLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-bg-card)] p-4 text-xs text-[var(--kh-text-secondary)] shadow-[var(--kh-card-shadow)] hover:border-[var(--kh-blue)] hover:shadow-md"
    >
      <p className="text-[11px] font-semibold text-[var(--kh-text)]">{name}</p>
      <p className="mt-1">{description}</p>
      <span className="mt-2 inline-flex text-[10px] font-semibold text-[var(--kh-blue)]">
        Open official site ↗
      </span>
    </a>
  );
}