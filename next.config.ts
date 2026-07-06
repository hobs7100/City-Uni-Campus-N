import type { NextConfig } from "next";

// In local/hosted dev sandboxes the app may be previewed through a proxied
// domain reported by the environment; when present, Next.js needs it listed
// so its dev-mode origin check doesn't reject the proxied requests. This has
// no effect on `next build`/`next start` (production), only on `next dev`.
const devHost = process.env.REPLIT_DEV_DOMAIN;

const nextConfig: NextConfig = {
  /* config options here */
  ...(devHost ? { allowedDevOrigins: [devHost] } : {}),
};

export default nextConfig;
