"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";

type ThemeStyle = "hero" | "sunset" | "flag" | "midnight";
type Mode = "modern" | "traditional";
const BAYBAYIN_CANVAS_FONT = '400 96px "Baybayin", sans-serif';
type RenderedCard = { key: string; url: string; file: File | null; error: string | null };

export default function BaybayinCardPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [text, setText] = useState("Kabayan Hub sa Saudi");
  const [name, setName] = useState("Kev");
  const [theme, setTheme] = useState<ThemeStyle>("hero");
  const [mode, setMode] = useState<Mode>("modern");
  const [status, setStatus] = useState<string | null>(null);
  const [rendered, setRendered] = useState<RenderedCard>({ key: "", url: "", file: null, error: null });
  const [retry, setRetry] = useState(0);
  const [sharing, setSharing] = useState(false);

  const baybayin = useMemo(() => convertToBaybayin(text, mode), [text, mode]);
  const renderKey = JSON.stringify([text, name, theme, mode, retry]);
  const ready = rendered.key === renderKey && rendered.file !== null && !rendered.error;
  const renderError = rendered.key === renderKey ? rendered.error : null;

  // Draw card whenever inputs change
  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    const run = async () => {
      try {
        // Canvas does not resolve CSS var() font families. Use the explicit
        // @font-face family from globals.css and wait for its actual font file.
        const fonts = await document.fonts.load('400 96px "Baybayin"', "ᜃᜊᜌᜈ᜔");
        if (!fonts.length || !document.fonts.check('400 96px "Baybayin"', "ᜃᜊᜌᜈ᜔")) {
          throw new Error("Baybayin font unavailable");
        }
        const artwork = theme === "hero" ? await loadHeroArtwork() : undefined;
        if (cancelled) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        drawCard({ canvas, theme, baybayinText: baybayin, latinText: text, name, artwork });
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(value => value ? resolve(value) : reject(new Error("PNG export failed")), "image/png");
        });
        if (cancelled) return;
        const file = new File([blob], `baybayin-card-${slugify(name) || "kabayan"}.png`, { type: "image/png" });
        objectUrl = URL.createObjectURL(file);
        setRendered({ key: renderKey, url: objectUrl, file, error: null });
        setStatus(null);
      } catch {
        if (!cancelled) setRendered({ key: renderKey, url: "", file: null, error: "The card font or image couldn’t load. Check your connection and try again." });
      }
    };
    void run();
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [text, name, theme, baybayin, renderKey]);

  const download = () => {
    if (!ready || !rendered.file) return;
    const a = document.createElement("a");
    a.href = rendered.url;
    a.download = rendered.file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setStatus("Your PNG download is ready—with the Baybayin text included.");
  };

  const share = async () => {
    if (!ready || !rendered.file || sharing) return;

    // Web Share API works best on mobile
    setSharing(true);
    try {
      if (navigator.share && navigator.canShare?.({ files: [rendered.file] })) {
        await navigator.share({
          title: "My Baybayin Card",
          text: "Made in Kabayan Hub 🇵🇭",
          files: [rendered.file],
        });
        setStatus("Shared! 🔥");
      } else {
        download(); // fallback
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setStatus("Sharing isn’t available right now. Use Download PNG to save your card.");
    } finally { setSharing(false); }
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

      <section className="grid gap-4 md:grid-cols-[1fr_1.2fr]">
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
                <option value="hero">Kabayan Hero ✨</option>
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
            <button onClick={download} disabled={!ready || sharing} className="kh-button kh-button-yellow">
              Download PNG ⬇️
            </button>
            <button onClick={share} disabled={!ready || sharing} className="kh-button kh-button-primary">
              Share 📲
            </button>
            <button
              onClick={() => {
                setText("Kabayan Hub sa Saudi");
                setName("Kev");
                setTheme("hero");
                setMode("modern");
              }}
              className="kh-button kh-button-secondary"
            >
              Reset
            </button>
          </div>

          {renderError && <div role="alert" className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{renderError}<button className="ml-2 underline" onClick={() => setRetry(value => value + 1)}>Retry</button></div>}
          {status && ready && (
            <p role="status" className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
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
                Made for sharing your Filipino roots
              </p>
            </div>
            <span className="rounded-full bg-[var(--kh-bg-subtle)] px-3 py-1 text-[10px] text-[var(--kh-text-muted)]">
              1080×1080
            </span>
          </div>

          <div className="mt-4 overflow-hidden rounded-3xl border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] p-3">
            <canvas ref={canvasRef} width={1080} height={1080} aria-hidden="true" className="hidden" />
            {ready ? <Image src={rendered.url} alt={`Baybayin card: ${baybayin || "empty"}`} width={1080} height={1080} unoptimized className="w-full h-auto rounded-2xl" /> : <div role="status" className="aspect-square flex items-center justify-center p-6 text-center text-sm text-[var(--kh-text-secondary)]">{renderError ? "Your card couldn’t be prepared. Use Retry to try again." : "Preparing your Baybayin card…"}</div>}
          </div>

          <p className="mt-3 text-[11px] text-[var(--kh-text-muted)]">
            {ready ? "Your PNG includes the Baybayin lettering exactly as shown above." : renderError ? "The card isn’t ready to download yet." : "Preparing your Baybayin lettering and PNG…"}
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
  artwork?: HTMLImageElement;
}) {
  const { canvas, theme, baybayinText, latinText, name, artwork } = opts;
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");

  const W = canvas.width;
  const H = canvas.height;

  // Clear
  ctx.clearRect(0, 0, W, H);

  if (theme === "hero") {
    if (!artwork) throw new Error("Card artwork unavailable");
    drawHeroCard(ctx, artwork, baybayinText, latinText, name, W, H);
    return;
  }

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

  // Use the loaded, named font; CSS variables are invalid in canvas.font.
  ctx.fillStyle = theme === "midnight" ? "rgba(255,255,255,0.95)" : "#0f172a";
  ctx.textAlign = "left";

  ctx.font = BAYBAYIN_CANVAS_FONT;

  const lines = wrapLines(ctx, baybayinText || "—", cardW - 112);
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

let heroArtworkPromise: Promise<HTMLImageElement> | null = null;

function loadHeroArtwork() {
  if (!heroArtworkPromise) {
    const artwork = new window.Image();
    artwork.src = "/baybayin-hero.png";
    heroArtworkPromise = artwork.decode().then(() => artwork).catch(error => {
      heroArtworkPromise = null;
      throw error;
    });
  }
  return heroArtworkPromise;
}

function drawHeroCard(
  ctx: CanvasRenderingContext2D,
  artwork: HTMLImageElement,
  baybayinText: string,
  latinText: string,
  name: string,
  width: number,
  height: number
) {
  ctx.drawImage(artwork, 0, 0, width, height);
  ctx.textAlign = "left";
  ctx.fillStyle = "#123475";
  ctx.font = "700 22px system-ui, -apple-system, Segoe UI, Arial";
  ctx.fillText("BAYBAYIN / ATING PAMANA", 130, 244);
  ctx.fillStyle = "#dc3039";
  ctx.fillRect(130, 261, 48, 5);
  ctx.fillStyle = "#f5bf23";
  ctx.fillRect(178, 261, 48, 5);

  // Keep the lettering inside the open sky, above the mascot's face.
  let fontSize = 96;
  let lines: string[];
  do {
    ctx.font = `400 ${fontSize}px "Baybayin", sans-serif`;
    lines = wrapLines(ctx, baybayinText || "—", 790);
    if (lines.length * fontSize * 1.3 <= 215 || fontSize <= 32) break;
    fontSize -= 4;
  } while (true);
  ctx.fillStyle = "#112c65";
  const maxLines = Math.max(1, Math.floor(215 / (fontSize * 1.3)));
  lines.slice(0, maxLines).forEach((line, index) => {
    const display = index === maxLines - 1 && lines.length > maxLines ? `${line}…` : line;
    ctx.fillText(display, 130, 294 + fontSize + index * fontSize * 1.3, 790);
  });

  ctx.font = "600 30px system-ui, -apple-system, Segoe UI, Arial";
  ctx.fillStyle = "#263e60";
  const captionLines = wrapLines(ctx, latinText ? `“${latinText}”` : "", 390);
  captionLines.slice(0, 3).forEach((line, index) => {
    const display = index === 2 && captionLines.length > 3 ? `${line}…` : line;
    ctx.fillText(display, 130, 574 + index * 40, 390);
  });
  ctx.font = "700 25px system-ui, -apple-system, Segoe UI, Arial";
  ctx.fillText(`— ${name || "Kabayan"}`, 130, 574 + Math.min(captionLines.length, 3) * 40 + 22, 390);

  pill(ctx, 80, 952, 350, 58, "#102c65");
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 25px system-ui, -apple-system, Segoe UI, Arial";
  ctx.fillText("Made in Kabayan Hub", 105, 990, 300);
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
  maxWidth: number
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
  const s = (input || "")
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

