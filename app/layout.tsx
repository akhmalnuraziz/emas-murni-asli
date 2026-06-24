import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], display: 'swap' })

export const metadata: Metadata = {
  title: 'PT Emas Murni Asli — Production System',
  description: 'Enterprise ERP System untuk Produksi & Inventory Logam Mulia',
  robots: 'noindex, nofollow',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Emas Murni' },
  other: { 'mobile-web-app-capable': 'yes', 'msapplication-TileColor': '#6450D6' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body className={`${inter.className} antialiased`}>
        {children}
      </body>
    </html>
  )
}
