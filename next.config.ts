import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  output: "export",
  // Allow isolated local previews/builds while another dev server is running.
  distDir: process.env.KABAYAN_BUILD_DIR || "out",
};

export default nextConfig;
