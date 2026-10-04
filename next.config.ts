import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  // Resize share thumbnails in Node. Bundling sharp breaks the native binary.
  serverExternalPackages: ["sharp"],
};

export default nextConfig;
