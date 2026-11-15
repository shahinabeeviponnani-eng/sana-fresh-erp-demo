// In development, setup Cloudflare Dev Platform for local D1 & R2 simulation
if (process.env.NODE_ENV === 'development') {
  const { setupDevPlatform } = require('@cloudflare/next-on-pages/next-dev');
  setupDevPlatform();
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts'],
  },
  webpack: (config, { dev }) => {
    if (dev) config.output.chunkLoadTimeout = 120000;
    // Exclude Node-only modules from Edge bundle
    config.resolve.alias = {
      ...config.resolve.alias,
      pg: false,
      bcryptjs: false,
      jsonwebtoken: false,
    };
    return config;
  },
};

module.exports = nextConfig;
