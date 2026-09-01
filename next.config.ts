import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // The floating dev badge otherwise lands in the corner of every capture.
  devIndicators: false,
  // Required: better-sqlite3 is a native module that can't be bundled
  serverExternalPackages: ['better-sqlite3'],

  turbopack: {
    // Required: prevents Turbopack from inferring a parent directory as root
    // when .codeyam/ exists above the project (which breaks import resolution)
    root: '.',
  },
};

export default nextConfig;
