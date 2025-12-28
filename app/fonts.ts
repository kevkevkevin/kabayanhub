import localFont from "next/font/local";

export const baybayinFont = localFont({
  src: "../public/fonts/NotoSansTagalog-Regular.ttf", // ✅ change if your filename is different
  variable: "--font-baybayin",
  display: "swap",
});
