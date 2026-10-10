import type { NextConfig } from 'next';

/**
 * Fully static export. There is no server here by design: a shared link carries
 * its own question in the URL hash, so nothing needs to be stored or looked up.
 *
 * BASE_PATH handles subpath hosting (GitHub/GitLab project sites). Vercel serves
 * at a domain root, so it stays unset there. The hash is basePath-agnostic either
 * way, which is the other reason the config travels in the hash and not the path.
 */
const basePath = process.env.BASE_PATH ?? '';

const nextConfig: NextConfig = {
  output: 'export',
  basePath,
  images: { unoptimized: true },
  reactStrictMode: true,
  // Keep local development from generating ignored AI-agent instruction files.
  agentRules: false,
};

export default nextConfig;
