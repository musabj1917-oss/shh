import path from 'node:path';
import type { NextConfig } from 'next';

const config: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  transpilePackages: ['@haiku/contracts'],
  turbopack: { root: path.resolve(process.cwd(), '../..') },
  async rewrites() {
    return [
      { source: '/app', destination: '/' },
      { source: '/web', destination: '/' },
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
