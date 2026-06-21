import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Server-side sign out handler.
 * Dipakai oleh client agar cookie Supabase dihapus di level server,
 * sehingga middleware tidak salah deteksi sesi lama.
 *
 * Usage: window.location.href = '/api/auth/signout'
 * atau : window.location.href = '/api/auth/signout?reason=idle'
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  await supabase.auth.signOut()

  const reason = request.nextUrl.searchParams.get('reason')
  const loginUrl = new URL('/login', request.url)
  if (reason) loginUrl.searchParams.set('reason', reason)

  const response = NextResponse.redirect(loginUrl)

  // Hapus cookie Supabase secara eksplisit juga (defensive)
  const cookieName = `sb-${process.env.NEXT_PUBLIC_SUPABASE_URL?.split('//')[1]?.split('.')[0]}-auth-token`
  response.cookies.delete(cookieName)
  response.cookies.delete(`${cookieName}.0`)
  response.cookies.delete(`${cookieName}.1`)

  return response
}

// Support POST juga untuk form action
export const POST = GET
