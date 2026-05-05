import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@poker-coins/db", "@poker-coins/game", "@poker-coins/ui"],
};

export default nextConfig;
