import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root to this project so Turbopack doesn't infer a parent
  // directory as root (there's an unrelated pnpm-lock.yaml in the home folder).
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
