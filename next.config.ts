import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  turbopack: {}, // Allow webpack config
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'polymarket.com' },
      { protocol: 'https', hostname: 'gamma-api.polymarket.com' },
      { protocol: 'https', hostname: 'clob.polymarket.com' },
      { protocol: 'https', hostname: 'ipfs.io' },
      { protocol: 'https', hostname: 'gateway.pinata.cloud' },
      { protocol: 'https', hostname: 'cloudflare-ipfs.com' },
      { protocol: 'https', hostname: 'icons.llamao.fi' },
      { protocol: 'https', hostname: 'static.rainbow.me' },
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
      { protocol: 'https', hostname: 'raw.githubusercontent.com' },
    ],
  },
  webpack: (config, { isServer }) => {
    // Fixes for Transformers.js
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push({
        'sharp': 'commonjs sharp',
        'onnxruntime-node': 'commonjs onnxruntime-node',
      });
    }

    // Set async WebAssembly for transformers
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    return config;
  },
};

export default nextConfig;
