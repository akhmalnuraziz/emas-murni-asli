import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'PT Emas Murni Asli — Production System',
  description: 'Enterprise ERP System untuk Produksi & Inventory Logam Mulia',
  robots: 'noindex, nofollow',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400&display=swap" rel="stylesheet" />
        <meta name="theme-color" content="#7C3AED" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", background: '#F2F2F7' }}>
        {children}
      </body>
    </html>
  )
}
