import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Use the Next.js runtime on Vercel for dynamic market and news routes.
  // Allow isolated local previews/builds while another dev server is running.
  distDir: process.env.KABAYAN_BUILD_DIR || ".next",
};

export default nextConfig;
