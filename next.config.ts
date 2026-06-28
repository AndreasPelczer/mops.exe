import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Statischer Export -> erzeugt fertige Dateien in out/ fuer Cloudflare Pages
  // (game.baumops.com). Kein laufender Server noetig, das Spiel ist clientseitig.
  output: "export",
  images: { unoptimized: true },
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
