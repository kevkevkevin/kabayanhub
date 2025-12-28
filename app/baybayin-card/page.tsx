"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type ThemeStyle = "sunset" | "flag" | "midnight";
type Mode = "modern" | "traditional";

export default function BaybayinCardPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [text, setText] = useState("Kabayan Hub sa Saudi");
  const [name, setName] = useState("Kev");
  const [theme, setTheme] = useState<ThemeStyle>("sunset");
  const [mode, setMode] = useState<Mode>("modern");
  const [status, setStatus] = useState<string | null>(null);

  // ✅ Replace this with your real converter once you paste it in
  const baybayin = useMemo(() => convertToBaybayin(text, mode), [text, mode]);

  // Draw card whenever inputs change
  useEffect(() => {
    const run = async () => {
      setStatus(null);

      // Make sure the Baybayin font is ready for CANVAS
      // (it uses the local font you already loaded via next/font with CSS var)
      try {
        // Try common names; if it fails, canvas will still draw (but may fallback)
        await (document as any).fonts?.load?.(`28px var(--font-baybayin)`);
        await (document as any).fonts?.ready;
      } catch {}

      drawCard({
        canvas: canvasRef.current,
        theme,
        baybayinText: baybayin,
        latinText: text,
        name,
      });
    };

    run();
  }, [text, name, theme, baybayin]);

  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `baybayin-card-${slugify(name || "kabayan")}.png`;
    a.click();
    setStatus("Downloaded! Post mo na yan 😋");
  };

  const share = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Web Share API works best on mobile
    try {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/png")
      );
      if (!blob) throw new Error("No blob");

      const file = new File([blob], "baybayin-card.png", { type: "image/png" });

      // @ts-ignore
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        // @ts-ignore
        await navigator.share({
          title: "My Baybayin Card",
          text: "Made in Kabayan Hub 🇵🇭",
          files: [file],
        });
        setStatus("Shared! 🔥");
      } else {
        download(); // fallback
      }
    } catch (e) {
      download(); // fallback
    }
  };

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full bg-[var(--kh-blue-soft)]/40 px-3 py-1 text-[11px] font-semibold text-[var(--kh-blue)]">
          🪪 MAKE YOUR OWN BAYBAYIN CARD
        </div>
        <h1 className="text-2xl md:text-3xl font-semibold text-[var(--kh-text)]">
          Create a shareable Baybayin card ✨
        </h1>
        <p className="max-w-2xl text-sm text-[var(--kh-text-secondary)]">
          Type Tagalog/English (best when spelled like Tagalog sound), generate Baybayin,
          then download/share the card.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-[1fr,1.2fr]">
        {/* Controls */}
        <div className="kh-card card-hover space-y-4">
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-[var(--kh-text-secondary)]">
              Your text
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              className="w-full rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-3 text-sm text-[var(--kh-text)] outline-none focus:border-[var(--kh-blue)]"
              placeholder="e.g. Kumusta ka, kabayan?"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {["kumusta", "salamat", "mahal kita", "kabayan sa saudi"].map((s) => (
                <button
                  key={s}
                  onClick={() => setText(s)}
                  className="rounded-full bg-[var(--kh-bg-subtle)] px-3 py-1 text-[11px] text-[var(--kh-text-secondary)] hover:brightness-105"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-[var(--kh-text-secondary)]">
                Name / Signature
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-sm text-[var(--kh-text)] outline-none focus:border-[var(--kh-blue)]"
                placeholder="Your name"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-[var(--kh-text-secondary)]">
                Theme
              </label>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value as ThemeStyle)}
                className="w-full rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-sm text-[var(--kh-text)] outline-none focus:border-[var(--kh-blue)]"
              >
                <option value="sunset">Sunset Candy 🍬</option>
                <option value="flag">PH Flag Pop 🇵🇭</option>
                <option value="midnight">Midnight Glow 🌙</option>
              </select>
            </div>
          </div>

          <div className="kh-card !p-3 bg-[var(--kh-bg-subtle)] border border-[var(--kh-border)]">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-[var(--kh-text)]">Output mode</p>
                <p className="text-[11px] text-[var(--kh-text-muted)]">
                  Modern uses virama (᜔). Traditional skips it.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  className={`kh-btn ${mode === "modern" ? "bg-[var(--kh-blue)] text-white border-transparent" : ""}`}
                  onClick={() => setMode("modern")}
                  type="button"
                >
                  Modern
                </button>
                <button
                  className={`kh-btn ${mode === "traditional" ? "bg-[var(--kh-red)] text-white border-transparent" : ""}`}
                  onClick={() => setMode("traditional")}
                  type="button"
                >
                  Traditional
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] p-3">
            <p className="text-[11px] font-semibold text-[var(--kh-text-secondary)]">
              Live preview (Baybayin)
            </p>
            <div className="mt-2 baybayin-text">{baybayin || "—"}</div>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <button onClick={download} className="kh-btn bg-[var(--kh-yellow)] text-slate-900 border-transparent">
              Download PNG ⬇️
            </button>
            <button onClick={share} className="kh-btn bg-[var(--kh-blue)] text-white border-transparent">
              Share 📲
            </button>
            <button
              onClick={() => {
                setText("Kabayan Hub sa Saudi");
                setName("Kev");
                setTheme("sunset");
              }}
              className="kh-btn"
            >
              Reset
            </button>
          </div>

          {status && (
            <p className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
              {status}
            </p>
          )}
        </div>

        {/* Canvas Preview */}
        <div className="kh-card card-hover">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-[var(--kh-text)]">Your share card</h2>
              <p className="text-[11px] text-[var(--kh-text-muted)]">
                Looks best on Instagram Story / FB post
              </p>
            </div>
            <span className="rounded-full bg-[var(--kh-bg-subtle)] px-3 py-1 text-[10px] text-[var(--kh-text-muted)]">
              1080×1080
            </span>
          </div>

          <div className="mt-4 overflow-hidden rounded-3xl border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] p-3">
            <canvas ref={canvasRef} width={1080} height={1080} className="w-full h-auto rounded-2xl" />
          </div>

          <p className="mt-3 text-[11px] text-[var(--kh-text-muted)]">
            If you still see □□□ on the card, that means the font file isn’t loaded.
            Double-check the font path in <code>public/fonts</code>.
          </p>
        </div>
      </section>
    </div>
  );
}

/**
 * ✅ Canvas drawing: cute card with background + baybayin + signature + badge
 */
function drawCard(opts: {
  canvas: HTMLCanvasElement | null;
  theme: ThemeStyle;
  baybayinText: string;
  latinText: string;
  name: string;
}) {
  const { canvas, theme, baybayinText, latinText, name } = opts;
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const W = canvas.width;
  const H = canvas.height;

  // Clear
  ctx.clearRect(0, 0, W, H);

  // Background gradient
  const bg = ctx.createLinearGradient(0, 0, W, H);
  if (theme === "sunset") {
    bg.addColorStop(0, "#fff3d6");
    bg.addColorStop(0.35, "#ffd6f3");
    bg.addColorStop(0.7, "#d6f0ff");
    bg.addColorStop(1, "#fff7d1");
  } else if (theme === "flag") {
    bg.addColorStop(0, "#e8f0ff");
    bg.addColorStop(0.33, "#ffffff");
    bg.addColorStop(0.66, "#fff7d1");
    bg.addColorStop(1, "#fce2e2");
  } else {
    bg.addColorStop(0, "#050b1d");
    bg.addColorStop(0.5, "#0f1b3c");
    bg.addColorStop(1, "#150a2b");
  }
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Cute blobs
  blob(ctx, theme, 160, 220, 260);
  blob(ctx, theme, 900, 280, 300);
  blob(ctx, theme, 560, 980, 350);

  // Card surface
  const pad = 80;
  const cardX = pad;
  const cardY = pad;
  const cardW = W - pad * 2;
  const cardH = H - pad * 2;

  roundRect(ctx, cardX, cardY, cardW, cardH, 56);
  ctx.fillStyle = theme === "midnight" ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.82)";
  ctx.fill();

  ctx.lineWidth = 3;
  ctx.strokeStyle = theme === "midnight" ? "rgba(255,255,255,0.25)" : "rgba(15,23,42,0.08)";
  ctx.stroke();

  // Header badge
  pill(ctx, cardX + 56, cardY + 56, 380, 54, theme === "midnight" ? "rgba(255,255,255,0.12)" : "rgba(15,23,42,0.90)");
  ctx.fillStyle = theme === "midnight" ? "rgba(255,255,255,0.9)" : "#ffffff";
  ctx.font = "700 26px system-ui, -apple-system, Segoe UI, Arial";
  ctx.fillText("🇵🇭  KABAYAN BAYBAYIN CARD", cardX + 78, cardY + 92);

  // Main Baybayin text (IMPORTANT: uses CSS var font family)
  ctx.fillStyle = theme === "midnight" ? "rgba(255,255,255,0.95)" : "#0f172a";
  ctx.textAlign = "left";

  // Try to use the loaded font variable name in canvas:
  // Some browsers won't accept CSS var in canvas font, so we add fallbacks.
  // If your font doesn't render in canvas, we'll fix it next by using a known family name.
  ctx.font = `700 96px var(--font-baybayin), "Noto Sans Tagalog", "Noto Sans Tagalog Regular", system-ui`;

  const lines = wrapLines(ctx, baybayinText || "—", cardX + 56, cardY + 210, cardW - 112, 108);
  for (let i = 0; i < lines.length && i < 4; i++) {
    ctx.fillText(lines[i], cardX + 56, cardY + 240 + i * 110);
  }

  // Latin subtext
  ctx.fillStyle = theme === "midnight" ? "rgba(255,255,255,0.75)" : "rgba(15,23,42,0.62)";
  ctx.font = `600 34px system-ui, -apple-system, Segoe UI, Arial`;
  const sub = latinText.length > 90 ? latinText.slice(0, 90) + "…" : latinText;
  ctx.fillText(`“${sub}”`, cardX + 56, cardY + cardH - 170);

  // Signature
  ctx.fillStyle = theme === "midnight" ? "rgba(255,255,255,0.85)" : "rgba(15,23,42,0.75)";
  ctx.font = `800 32px system-ui, -apple-system, Segoe UI, Arial`;
  ctx.fillText(`— ${name || "Kabayan"}`, cardX + 56, cardY + cardH - 110);

  // Footer mini badge
  pill(ctx, cardX + cardW - 330, cardY + cardH - 140, 274, 54, theme === "midnight" ? "rgba(250,204,21,0.16)" : "rgba(250,204,21,0.85)");
  ctx.fillStyle = theme === "midnight" ? "rgba(250,204,21,0.95)" : "#0f172a";
  ctx.font = "900 26px system-ui, -apple-system, Segoe UI, Arial";
  ctx.fillText("Made in Kabayan Hub", cardX + cardW - 308, cardY + cardH - 104);
}

function pill(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string) {
  roundRect(ctx, x, y, w, h, 999);
  ctx.fillStyle = fill;
  ctx.fill();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function blob(ctx: CanvasRenderingContext2D, theme: ThemeStyle, cx: number, cy: number, size: number) {
  ctx.save();
  ctx.globalAlpha = theme === "midnight" ? 0.20 : 0.35;
  const g = ctx.createRadialGradient(cx, cy, 20, cx, cy, size);
  if (theme === "flag") {
    g.addColorStop(0, "rgba(0,56,168,0.18)");
    g.addColorStop(0.5, "rgba(252,209,22,0.18)");
    g.addColorStop(1, "rgba(206,17,38,0.10)");
  } else if (theme === "sunset") {
    g.addColorStop(0, "rgba(252,209,22,0.22)");
    g.addColorStop(0.5, "rgba(206,17,38,0.16)");
    g.addColorStop(1, "rgba(0,56,168,0.12)");
  } else {
    g.addColorStop(0, "rgba(96,165,250,0.22)");
    g.addColorStop(0.5, "rgba(250,204,21,0.18)");
    g.addColorStop(1, "rgba(249,115,115,0.14)");
  }
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
) {
  const words = (text || "").split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    const m = ctx.measureText(test).width;
    if (m > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function slugify(s: string) {
  return (s || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * ✅ IMPORTANT:
 * You should replace this with your real Baybayin converter so it outputs
 * Baybayin Unicode chars (ᜃᜊᜌᜈ...).
 */
function convertToBaybayin(input: string, mode: "modern" | "traditional") {
  const virama = "᜔"; // modern pamudpod
  const useVirama = mode === "modern";

  // Baybayin base letters (consonant = "a" by default)
  const C: Record<string, string> = {
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
    r: "ᜇ", // approximate (Baybayin historically has "da/ra")
    l: "ᜎ",
    w: "ᜏ",
    s: "ᜐ",
    h: "ᜑ",
  };

  // Independent vowels
  const V: Record<string, string> = {
    a: "ᜀ",
    i: "ᜁ",
    e: "ᜁ", // approximate to i
    o: "ᜂ", // U/ O
    u: "ᜂ",
  };

  // Kudlit marks
  const KUDLIT_I = "ᜒ"; // i/e
  const KUDLIT_U = "ᜓ"; // u/o

  // Normalize text for conversion
  let s = (input || "")
    .toLowerCase()
    .replace(/qu/g, "kw")
    .replace(/q/g, "k")
    .replace(/c(?=[eiy])/g, "s")
    .replace(/c/g, "k")
    .replace(/x/g, "ks")
    .replace(/f/g, "p")
    .replace(/v/g, "b")
    .replace(/j/g, "dy")
    .replace(/z/g, "s")
    .replace(/ch/g, "ts")
    .replace(/[^\p{L}\s'-]/gu, " "); // remove weird punctuation but keep letters/spaces

  const isVowel = (ch: string) => !!V[ch];
  const vowelMark = (v: string) => {
    if (v === "i" || v === "e") return KUDLIT_I;
    if (v === "u" || v === "o") return KUDLIT_U;
    return ""; // 'a' = no mark
  };

  // Tokenize by words but keep spaces
  const parts = s.split(/(\s+)/);

  const outParts = parts.map((part) => {
    if (/^\s+$/.test(part)) return part; // preserve spaces

    let i = 0;
    let out = "";

    while (i < part.length) {
      // handle apostrophes/hyphens as separators
      const ch = part[i];
      if (ch === "'" || ch === "-") {
        out += " ";
        i++;
        continue;
      }

      // vowel at start
      if (isVowel(ch)) {
        out += V[ch];
        i++;
        continue;
      }

      // detect digraph "ng"
      let cons = "";
      if (part.slice(i, i + 2) === "ng") cons = "ng";
      else cons = ch;

      // if consonant not known, just output original char
      if (!C[cons]) {
        out += part[i];
        i++;
        continue;
      }

      const bayCons = C[cons];
      i += cons.length;

      // lookahead vowel
      const next = part[i] || "";
      if (isVowel(next)) {
        const vm = vowelMark(next);
        out += bayCons + vm;
        i++; // consume vowel
      } else {
        // consonant ends the syllable: add virama if modern, otherwise leave as default 'a'
        out += useVirama ? bayCons + virama : bayCons;
      }
    }

    return out.replace(/\s+/g, " ").trim();
  });

  return outParts.join("").replace(/\s+/g, " ").trim();
}

