/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['pg', 'pinata']
  },
  images: {
    domains: ['arweave.net', 'gateway.irys.xyz'],
  },
  // Disable caching to reduce bundle size
  generateBuildId: () => 'build-' + Date.now(),
  
  // Server-side runtime config - these are ONLY available on the server at runtime
  // They are NOT inlined during build
  serverRuntimeConfig: {
    PINATA_JWT: process.env.PINATA_JWT,
    PINATA_GATEWAY: process.env.PINATA_GATEWAY,
  },
  
  webpack: (config, { isServer }) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        'pino-pretty': false,
      };
    }
    
    // Disable webpack cache to reduce size
    config.cache = false;
    
    return config;
  }
}

module.exports = nextConfig