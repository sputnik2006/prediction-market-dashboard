/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // External upstreams are fetched server-side in route handlers, so no rewrites needed.
  // Keep `ws` out of the server bundle so its frame masking works at runtime.
  serverExternalPackages: ["ws"],
};

export default nextConfig;
