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

function expandHostVariants(host: string | undefined): string[] {
  if (!host) return []
  const h = host.trim()
  if (!h) return []
  if (h.startsWith('www.')) return [h, h.slice(4)]
  return [h, `www.${h}`]
}

function splitCsv(value: string | undefined): string[] {
  if (!value) return []
  return value
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
}

const allowedOrigins = Array.from(new Set([
  'localhost:3000',
  'produksigudangcj.vercel.app',
  ...expandHostVariants(hostnameFromUrl(process.env.NEXT_PUBLIC_APP_URL)),
  ...expandHostVariants(hostnameFromUrl(process.env.VERCEL_URL)),
  // Optional: comma-separated hostnames/domains for additional deployments
  ...splitCsv(process.env.NEXT_PUBLIC_ALLOWED_ORIGINS).flatMap(v => expandHostVariants(hostnameFromUrl(v))),
]))

const securityHeaders = [
  { key: 'X-Frame-Options',           value: 'DENY' },
  { key: 'X-Content-Type-Options',    value: 'nosniff' },
  { key: 'Referrer-Policy',           value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy',        value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'X-DNS-Prefetch-Control',    value: 'on' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next.js butuh unsafe-inline/eval
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https://kcwrsovghmivborkgcam.supabase.co",
      "font-src 'self' https://fonts.gstatic.com",
      "connect-src 'self' https://kcwrsovghmivborkgcam.supabase.co wss://kcwrsovghmivborkgcam.supabase.co",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
]

const nextConfig: NextConfig = {
  allowedDevOrigins: ['127.0.0.1'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'kcwrsovghmivborkgcam.supabase.co' },
    ],
  },
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }]
  },
  experimental: {
    serverActions: {
      allowedOrigins,
      bodySizeLimit: '10mb',
    },
  },
}

export default nextConfig