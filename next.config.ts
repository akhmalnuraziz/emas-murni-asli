import type { NextConfig } from 'next'

function hostnameFromUrl(value: string | undefined): string | undefined {
  if (!value) return undefined
  try {
    // Accept full URLs (https://...) or bare hostnames (example.com)
    return value.includes('://') ? new URL(value).host : value
  } catch {
    return undefined
  }
}

const allowedOrigins = Array.from(
  new Set(
    [
      'localhost:3000',
      'produksigudangcj.vercel.app',
      hostnameFromUrl(process.env.NEXT_PUBLIC_APP_URL),
      hostnameFromUrl(process.env.VERCEL_URL),
    ].filter(Boolean) as string[]
  )
)

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'kcwrsovghmivborkgcam.supabase.co' },
    ],
  },
  experimental: {
    serverActions: {
      allowedOrigins,
      bodySizeLimit: '10mb', // ← fix untuk foto base64 upload
    },
  },
}

export default nextConfig