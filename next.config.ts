import path from 'node:path';
import type { NextConfig } from 'next';

const config: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  transpilePackages: ['@haiku/contracts'],
  serverExternalPackages: ['firebase-admin', 'jose', 'jwks-rsa', 'google-auth-library'],
  turbopack: { root: process.cwd() },
  async rewrites() {
    return [
      { source: '/app', destination: '/' },
      { source: '/web', destination: '/' },
      { source: '/mcp', destination: '/api/mcp' },
    ];
  },
  webpack: (cfg) => {
    cfg.resolve = cfg.resolve || {};
    cfg.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js'],
      '.mjs': ['.mts', '.mjs'],
    };
    return cfg;
  },
};

export default config;
