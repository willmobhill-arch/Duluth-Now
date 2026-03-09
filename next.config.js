/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'duluthga.net' },
    ],
  },
}

module.exports = nextConfig
