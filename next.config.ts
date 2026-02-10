import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.zoom.us blob:",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' https://*.zoom.us data:",
              "media-src 'self' https://*.zoom.us",
              "font-src 'self' https://source.zoom.us data:",
              "connect-src 'self' https://*.zoom.us wss://*.zoom.us",
              "worker-src blob:",
              "base-uri 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
