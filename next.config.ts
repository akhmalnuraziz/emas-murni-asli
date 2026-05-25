import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'kcwrsovghmivborkgcam.supabase.co' },
    ],
  },
  experimental: {
    serverActions: { allowedOrigins: ['produksigudangcj.vercel.app'] },
  },
}

export default nextConfig
