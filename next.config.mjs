/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Self-contained server bundle that Electron runs locally.
  output: 'standalone',
  // Native / adapter packages must be loaded at runtime from node_modules
  // (the cipher shim relies on sharing globalThis with the server).
  serverExternalPackages: [
    '@prisma/client',
    '@prisma/adapter-better-sqlite3',
    'better-sqlite3',
    'better-sqlite3-multiple-ciphers',
  ],
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  images: { unoptimized: true },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;
