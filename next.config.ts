import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  // Resize share thumbnails in Node. Bundling sharp breaks the native binary.
  serverExternalPackages: ["sharp"],
  async headers() {
    return [
      {
        // Upload names are content hashes or UUIDs, so the bytes do not change.
        source: "/uploads/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
