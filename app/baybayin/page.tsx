"use client";

import { useMemo, useState } from "react";

type Mode = "modern" | "traditional";

const VOWELS: Record<string, string> = {
  a: "ᜀ",
  e: "ᜁ", // Baybayin has I; used for e/i
  i: "ᜁ",
  o: "ᜂ", // Baybayin has U; used for o/u
  u: "ᜂ",
};

// Base consonants are the “-a” sound by default
const CONS_BASE: Record<string, string> = {
  k: "ᜃ",
  g: "ᜄ",
  ng: "ᜅ",
  t: "ᜆ",
  d: "ᜇ",
  n: "ᜈ",
  p: "ᜉ",
  b: "ᜊ",
  m: "ᜋ",
  y: "ᜌ",
  r: "ᜍ", // ra/da letter; used for r
  l: "ᜎ",
  w: "ᜏ",
  s: "ᜐ",
  h: "ᜑ",
};

// Kudlit marks
const KUDLIT_I = "ᜒ"; // U+1712
const KUDLIT_U = "ᜓ"; // U+1713
const VIRAMA = "᜔"; // U+1714 pamudpod/virama

function normalizeText(input: string) {
  // lower, trim, normalize common Tagalog spellings
  return input
    .toLowerCase()
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    // keep letters, spaces, basic punct
    .replace(/[^a-z0-9\s.,!?'"-]/g, "")
    .trim();
}

function isVowel(ch: string) {
  return ch === "a" || ch === "e" || ch === "i" || ch === "o" || ch === "u";
}

function applyVowelMark(baseConsonant: string, vowel: string) {
  // consonant already includes "a" by default; only add mark for i/e or u/o
  if (vowel === "a") return baseConsonant;
  if (vowel === "i" || vowel === "e") return baseConsonant + KUDLIT_I;
  if (vowel === "o" || vowel === "u") return baseConsonant + KUDLIT_U;
  return baseConsonant;
}

/**
 * Simple Tagalog-ish transliteration:
 * - Treat "ng" as one consonant
 * - Convert "c" -> k or s (heuristic)
 * - Convert "q" -> k
 * - Convert "v" -> b
 * - Convert "f" -> p
 * - Convert "j" -> dy (approx)
 * - Convert "x" -> ks
 * - Convert "z" -> s
 */
function preMapLatin(s: string) {
  return s
    .replace(/ng/g, "ŋ") // temp token
    .replace(/qu/g, "k") // quick
    .replace(/q/g, "k")
    .replace(/v/g, "b")
    .replace(/f/g, "p")
    .replace(/j/g, "dy")
    .replace(/x/g, "ks")
    .replace(/z/g, "s")
    // heuristic: "ce/ci" -> s, otherwise c -> k
    .replace(/c(?=[ei])/g, "s")
    .replace(/c/g, "k")
    .replace(/ŋ/g, "ng");
}

function toBaybayin(input: string, mode: Mode) {
  const text = preMapLatin(normalizeText(input));
  if (!text) return "";

  // Split while keeping punctuation as separate tokens
  const tokens = text.split(/(\s+|[.,!?'"-])/g).filter((t) => t !== "");

  const out: string[] = [];

  for (const token of tokens) {
    // whitespace or punctuation -> keep
    if (/^\s+$/.test(token) || /^[.,!?'"-]$/.test(token)) {
      out.push(token);
      continue;
    }

    // translate a word
    out.push(translateWord(token, mode));
  }

  return out.join("");
}

function translateWord(word: string, mode: Mode) {
  let i = 0;
  let result = "";

  while (i < word.length) {
    const ch = word[i];

    // numbers stay as-is
    if (/[0-9]/.test(ch)) {
      result += ch;
      i++;
      continue;
    }

    // vowel standalone
    if (isVowel(ch)) {
      result += VOWELS[ch] ?? ch;
      i++;
      continue;
    }

    // consonant handling (including ng)
    let cons = "";
    if (word.slice(i, i + 2) === "ng") {
      cons = "ng";
      i += 2;
    } else {
      cons = ch;
      i += 1;
    }

    const base = CONS_BASE[cons];
    if (!base) {
      // unknown letter, just keep
      result += cons;
      continue;
    }

    // look ahead for vowel
    const next = word[i] ?? "";
    if (next && isVowel(next)) {
      result += applyVowelMark(base, next);
      i += 1;
      continue;
    }

    // no vowel after consonant => it's a final consonant or consonant cluster
    // Modern: add virama to kill inherent 'a'
    // Traditional: keep base (reads as consonant+a)
    if (mode === "modern") {
      result += base + VIRAMA;
    } else {
      result += base;
    }
  }

  return result;
}

export default function BaybayinPage() {
  const [text, setText] = useState("Kabayan Hub sa Saudi");
  const [mode, setMode] = useState<Mode>("modern");
  const [copied, setCopied] = useState(false);

  const output = useMemo(() => toBaybayin(text, mode), [text, mode]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(output || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-6 md:space-y-8 page-fade">
      {/* Header */}
      <header className="space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full bg-[var(--kh-blue-soft)]/50 px-3 py-1 text-[10px] text-[var(--kh-blue)]">
          <span className="kp-coin kp-coin-delay-1">ᜃ</span>
          <span className="font-semibold uppercase tracking-wide">
            Baybayin Translator
          </span>
        </div>

        <h1 className="text-2xl font-semibold text-[var(--kh-text)] md:text-3xl">
          Type Tagalog, get Baybayin ✨
        </h1>

        <p className="max-w-2xl text-sm text-[var(--kh-text-secondary)]">
          Quick Baybayin converter for Kabayans. Best for Tagalog-style spelling.
          For names/English words, it will “approximate” the sound.
        </p>
      </header>

      {/* Controls */}
      <section className="kh-card card-hover">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-[var(--kh-text)]">
              Output mode
            </p>
            <p className="text-xs text-[var(--kh-text-secondary)]">
              Modern uses <span className="font-semibold">virama (᜔)</span> to end consonants.
              Traditional skips it.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setMode("modern")}
              className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
                mode === "modern"
                  ? "border-[var(--kh-blue)] bg-[var(--kh-blue-soft)] text-[var(--kh-blue)]"
                  : "border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] text-[var(--kh-text-secondary)] hover:bg-[var(--kh-bg)]"
              }`}
            >
              Modern (with ᜔)
            </button>
            <button
              type="button"
              onClick={() => setMode("traditional")}
              className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
                mode === "traditional"
                  ? "border-[var(--kh-red)] bg-[var(--kh-red-soft)] text-[var(--kh-red)]"
                  : "border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] text-[var(--kh-text-secondary)] hover:bg-[var(--kh-bg)]"
              }`}
            >
              Traditional (no ᜔)
            </button>
          </div>
        </div>
      </section>

      {/* Input / Output */}
      <section className="grid gap-4 md:grid-cols-2">
        {/* Input */}
        <div className="kh-card card-hover">
          <h2 className="text-sm font-semibold text-[var(--kh-text)]">
            Your text
          </h2>
          <p className="mt-1 text-xs text-[var(--kh-text-secondary)]">
            Tip: Try “kumusta”, “salamat”, “mahal kita”, “kabayan”.
          </p>

          <textarea
            rows={7}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="mt-3 w-full rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-3 text-sm text-[var(--kh-text)] outline-none focus:border-[var(--kh-blue)]"
            placeholder="Type here…"
          />

          <div className="mt-3 flex flex-wrap gap-2">
            {["kumusta", "salamat", "mahal kita", "kabayan sa saudi"].map((t) => (
              <button
                key={t}
                onClick={() => setText(t)}
                className="rounded-full bg-[var(--kh-bg-subtle)] px-3 py-1.5 text-[11px] font-semibold text-[var(--kh-text-secondary)] hover:bg-[var(--kh-bg)]"
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Output */}
        <div className="kh-card card-hover">
          <div className="flex items-start justify-between gap-2 baybayin-text">
            <div className="baybayin-text">
              <h2 className="text-sm font-semibold text-[var(--kh-text)]">
                Baybayin output
              </h2>
              <p className="mt-1 text-xs text-[var(--kh-text-secondary)]">
                Copy and use it in posts, bio, and Kabayan Moments 😄
              </p>
            </div>

            <button
              onClick={handleCopy}
              disabled={!output}
              className="rounded-full bg-[var(--kh-yellow)] px-4 py-2 text-xs font-black text-slate-900 shadow-[var(--kh-card-shadow)] hover:brightness-105 disabled:opacity-60"
            >
              {copied ? "Copied ✅" : "Copy"}
            </button>
          </div>

          <div className="mt-3 rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] p-4 baybayin-text">
            <p className="text-2xl md:text-3xl leading-relaxed text-[var(--kh-text)] baybayin-text">
              {output || "—"}
            </p>
          </div>

          <div className="mt-3 text-[11px] text-[var(--kh-text-muted)] space-y-1">
            <p>
              • Baybayin is syllabic. Some modern spelling rules are approximated.
            </p>
            <p>
              • If you want “more accurate”, type words closer to Tagalog sound.
            </p>
          </div>
        </div>
        <pre className="text-[11px] text-[var(--kh-text-muted)] mt-2">
        {Array.from(output || "")
            .map((c) => `U+${c.codePointAt(0)?.toString(16).toUpperCase()}`)
            .join(" ")}
        </pre>
      </section>
    </div>
  );
}
