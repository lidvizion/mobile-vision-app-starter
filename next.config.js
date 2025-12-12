const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Expose environment variables to serverless functions
  // CRITICAL: In AWS Amplify, env vars must be explicitly listed here to be available in API routes
  env: {
    GEMINI_LAMBDA_ENDPOINT: process.env.GEMINI_LAMBDA_ENDPOINT,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    HUGGINGFACE_API_KEY: process.env.HUGGINGFACE_API_KEY,
    MONGODB_URI: process.env.MONGODB_URI,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    ROBOFLOW_API_KEY: process.env.ROBOFLOW_API_KEY,
    // S3 Configuration - Required for media uploads
    S3_BUCKET_NAME: process.env.S3_BUCKET_NAME,
    S3_REGION: process.env.S3_REGION,
    S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID,
    S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY,
    // AWS fallback variables
    AWS_REGION: process.env.AWS_REGION,
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    // Legacy fallback
    NEXT_PUBLIC_STORAGE_BUCKET: process.env.NEXT_PUBLIC_STORAGE_BUCKET,
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
