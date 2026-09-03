import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // The floating dev badge otherwise lands in the corner of every capture.
  devIndicators: false,

  turbopack: {
    // Required: prevents Turbopack from inferring a parent directory as root
    // when .codeyam/ exists above the project (which breaks import resolution)
    root: '.',
  },
};

export default nextConfig;
