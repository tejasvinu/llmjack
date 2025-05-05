import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    serverComponentsExternalPackages: ['@ai-sdk/google', '@ai-sdk/groq'],
  },
};

export default nextConfig;
