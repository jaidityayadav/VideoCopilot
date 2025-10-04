/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  output: 'standalone',
  // Skip static generation for API routes during build
  generateBuildId: async () => {
    return 'build-id-' + Date.now()
  },
};

module.exports = nextConfig;