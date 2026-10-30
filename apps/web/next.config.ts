import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Independent preview/build output: never overwrite the landing preview's .next.
  distDir: process.env.RENER_DIST_DIR || '.next',
  // Redirect before the async workspace layout starts streaming; Next preserves query values.
  async redirects() {
    return [{ source: '/team/lab', destination: '/team/kiem-tra', permanent: true }];
  },
  // Resolve listing metadata before streaming so a missing listing can return HTTP 404.
  htmlLimitedBots: /.*/,
};

export default nextConfig;
