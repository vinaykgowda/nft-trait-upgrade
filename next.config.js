/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['argon2', 'pg']
  },
  images: {
    domains: ['arweave.net', 'gateway.irys.xyz'],
  },
  // Disable caching to reduce bundle size
  generateBuildId: () => 'build-' + Date.now(),
  
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