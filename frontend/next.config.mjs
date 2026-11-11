/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // snarkjs / ffjavascript pull in Node-only modules we never use in the
  // browser. Alias them to an empty module for client bundles.
  turbopack: {
    resolveAlias: {
      fs: { browser: "./lib/empty.js" },
      readline: { browser: "./lib/empty.js" },
    },
  },
  async headers() {
    // Proof generation is CPU-heavy. Cross-origin isolation unlocks
    // SharedArrayBuffer so snarkjs can use its multi-threaded paths.
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      {
        source: "/circuits/(.*)",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
