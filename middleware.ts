import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Routes accessible by each role — mirrors ROLE_ACCESS in lib/types/database.ts
const ROLE_ROUTES: Record<string, string[]> = {
  owner:            ['*'],
  manager:          ['*'],
  spv:              ['*'],
  admin_produksi:   ['dashboard', 'bahan-baku', 'produksi', 'packing-log', 'shieldtag', 'kpi-tim', 'scrap'],
  admin_gudang:     ['dashboard', 'inventory', 'mutasi', 'stock-opname', 'stok-cabang', 'po-cabang', 'po-vendor-packaging', 'prioritas-produksi'],
  admin_accounting: ['dashboard', 'penjualan', 'retur-penjualan', 'pelanggan', 'buyback', 'pengeluaran', 'laporan'],
}

function canAccessRoute(role: string, pathname: string): boolean {
  const allowed = ROLE_ROUTES[role]
  if (!allowed) return false
  if (allowed[0] === '*') return true
  // Extract first segment of dashboard path, e.g. /packing-log/... → packing-log
  const segment = pathname.replace(/^\//, '').split('/')[0]
  return allowed.includes(segment)
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname

  // Legacy redirect: /shieldtag-explorer merged into /shieldtag
  if (pathname === '/shieldtag-explorer' || pathname.startsWith('/shieldtag-explorer/')) {
    const url = request.nextUrl.clone()
    url.pathname = '/shieldtag'
    return NextResponse.redirect(url)
  }

  const isAuthPage    = pathname.startsWith('/login')
  const isPublicPath  = pathname === '/'
    || isAuthPage
    || pathname.startsWith('/reset-password')
    || pathname.startsWith('/auth/')

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && isAuthPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  if (pathname === '/') {
    const url = request.nextUrl.clone()
    url.pathname = user ? '/dashboard' : '/login'
    return NextResponse.redirect(url)
  }

  // Role-based route guard: only check dashboard paths (not API/auth/static)
  if (user && !isPublicPath && !pathname.startsWith('/api/')) {
    const { data: profile } = await supabase
      .from('users_profile')
      .select('role')
      .eq('id', user.id)
      .single()

    const role = profile?.role ?? ''
    if (role && !canAccessRoute(role, pathname)) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
