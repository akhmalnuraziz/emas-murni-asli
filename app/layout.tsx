import type { Metadata } from 'next'
import './globals.css'

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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  )
}
