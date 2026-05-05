import type { NextConfig } from "next";

const FIREBASE_PROJECT = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "pokercoins-7828c";

const nextConfig: NextConfig = {
  transpilePackages: ["@poker-coins/db", "@poker-coins/game", "@poker-coins/ui"],
  // Proxiamos los handlers de Firebase Auth a nuestro propio dominio para
  // evitar el cross-origin entre <project>.firebaseapp.com y poker-coins-web.
  // Esto resuelve fallos del flujo signInWithRedirect en Safari/iOS y
  // navegadores con políticas estrictas de cookies/storage.
  async rewrites() {
    return [
      {
        source: "/__/auth/:path*",
        destination: `https://${FIREBASE_PROJECT}.firebaseapp.com/__/auth/:path*`,
      },
      {
        source: "/__/firebase/:path*",
        destination: `https://${FIREBASE_PROJECT}.firebaseapp.com/__/firebase/:path*`,
      },
    ];
  },
};

export default nextConfig;
