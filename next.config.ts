import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'kcwrsovghmivborkgcam.supabase.co' },
    ],
  },
  experimental: {
    serverActions: {
      allowedOrigins: ['produksigudangcj.vercel.app', 'localhost:3000'],
      bodySizeLimit: '10mb', // ← fix untuk foto base64 upload
    },
  },
}

export default nextConfig