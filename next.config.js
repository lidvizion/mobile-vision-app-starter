const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Expose environment variables to serverless functions
  env: {
    GEMINI_LAMBDA_ENDPOINT: process.env.GEMINI_LAMBDA_ENDPOINT,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    HUGGINGFACE_API_KEY: process.env.HUGGINGFACE_API_KEY,
    MONGODB_URI: process.env.MONGODB_URI,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    ROBOFLOW_API_KEY: process.env.ROBOFLOW_API_KEY,
  },
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
      },
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 60,
  },
  webpack: (config, { dev, isServer }) => {
    // Exclude puppeteer-core and chromium from webpack bundle (server-side only)
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push('puppeteer-core', '@sparticuz/chromium');
    }
    if (!dev && !isServer) {
      config.optimization.splitChunks.cacheGroups = {
        ...config.optimization.splitChunks.cacheGroups,
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
        },
        common: {
          name: 'common',
          minChunks: 2,
          chunks: 'all',
          enforce: true,
        },
      };
    }
    return config;
  },
  // Performance optimizations
  compiler: {
    removeConsole: false, // Keep console logs for debugging
  },
  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
        ],
      },
    ];
  },
};
module.exports = withBundleAnalyzer(nextConfig);
