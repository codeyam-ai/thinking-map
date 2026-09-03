import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // The floating dev badge otherwise lands in the corner of every capture.
  devIndicators: false,

  // Normally `.next`. The browser eval run (`npm run evals:browser`) starts a
  // SECOND dev server, pointed at a throwaway database schema, and two Next
  // processes sharing one build directory corrupt each other's output. It
  // therefore sets this to a scratch directory of its own, so an eval run and a
  // `npm run dev` you already had open cannot interfere.
  //
  // Read from the environment rather than hardcoded because the eval runner is
  // a separate process launching this one: there is no other seam through which
  // it can say "build somewhere else".
  distDir: process.env.NEXT_DIST_DIR || '.next',

  turbopack: {
    // Required: prevents Turbopack from inferring a parent directory as root
    // when .codeyam/ exists above the project (which breaks import resolution)
    root: '.',
  },
};

export default nextConfig;
