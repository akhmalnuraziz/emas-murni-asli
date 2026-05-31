import type { NextConfig } from 'next'

function hostnameFromUrl(value: string | undefined): string | undefined {
  if (!value) return undefined
  try {
    return value.includes('://') ? new URL(value).host : value
  } catch {
    return undefined
  }
}

function expandHostVariants(host: string | undefined): string[] {
  if (!host) return []
  const h = host.trim()
  if (!h) return []
  if (h.startsWith('www.')) return [h, h.slice(4)]
  return [h, `www.${h}`]
}

function splitCsv(value: string | undefined): string[] {
  if (!value) return []
  return value.split(',').map(s => s.trim()).filter(Boolean)
}

const allowedOrigins = Array.from(new Set([
  'localhost:3000',
  'produksigudangcj.vercel.app',
  ...expandHostVariants(hostnameFromUrl(process.env.NEXT_PUBLIC_APP_URL)),
  ...expandHostVariants(hostnameFromUrl(process.env.VERCEL_URL)),
  ...splitCsv(process.env.NEXT_PUBLIC_ALLOWED_ORIGINS).flatMap(v => expandHostVariants(hostnameFromUrl(v))),
]))

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'kcwrsovghmivborkgcam.supabase.co' },
    ],
  },
  experimental: {
    serverActions: {
      allowedOrigins,
      bodySizeLimit: '10mb',
    },
  },
}

export default nextConfig

