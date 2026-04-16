import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'upload.wikimedia.org' },
      { protocol: 'https', hostname: '**.wikimedia.org' },
      { protocol: 'https', hostname: 'commons.wikimedia.org' },
      { protocol: 'https', hostname: '**.fbcdn.net' },
      { protocol: 'https', hostname: '**.cdninstagram.com' },
      { protocol: 'https', hostname: '**.timesofmalta.com' },
      { protocol: 'https', hostname: '**.maltatoday.com.mt' },
      { protocol: 'https', hostname: '**.independent.com.mt' },
      { protocol: 'https', hostname: '**.lovinmalta.com' },
    ],
  },
}

export default nextConfig
