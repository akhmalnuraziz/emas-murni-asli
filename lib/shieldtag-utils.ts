// ============================================================
// SHIELDTAG RANGE GENERATOR
// Charset: 0-9, A-Z (base-36, case insensitive)
// ============================================================

const CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'

function incrementCode(code: string): string | null {
  const chars = code.toUpperCase().split('')
  for (let i = chars.length - 1; i >= 0; i--) {
    const idx = CHARSET.indexOf(chars[i])
    if (idx === -1) continue
    if (idx < CHARSET.length - 1) {
      chars[i] = CHARSET[idx + 1]
      return chars.join('')
    } else {
      chars[i] = CHARSET[0] // wrap to '0', carry over
    }
  }
  return null // overflow
}

export function generateShieldtagRange(
  start: string,
  end: string
): { codes: string[]; error?: string } {
  const s = start.toUpperCase().trim()
  const e = end.toUpperCase().trim()

  if (!s || !e) return { codes: [], error: 'Kode awal dan akhir wajib diisi' }
  if (s.length !== e.length) return { codes: [], error: 'Kode awal dan akhir harus sama panjang' }

  // Validate all chars in charset
  for (const ch of s + e) {
    if (CHARSET.indexOf(ch) === -1) {
      return { codes: [], error: `Karakter "${ch}" tidak valid. Gunakan 0-9 dan A-Z` }
    }
  }

  const codes: string[] = []
  let current = s
  const MAX = 5000

  while (true) {
    codes.push(current)
    if (current === e) break
    const next = incrementCode(current)
    if (!next) break
    current = next
    if (codes.length > MAX) {
      return { codes: [], error: `Range terlalu besar (maks ${MAX} kode per input)` }
    }
  }

  if (codes[codes.length - 1] !== e) {
    return { codes: [], error: 'Kode akhir lebih kecil dari kode awal. Periksa kembali.' }
  }

  return { codes }
}

export function detectPrefix(start: string, end: string): { prefix: string; startSuffix: string; endSuffix: string } {
  const s = start.toUpperCase()
  const e = end.toUpperCase()
  let i = 0
  while (i < s.length && i < e.length && s[i] === e[i]) i++
  return { prefix: s.slice(0, i), startSuffix: s.slice(i), endSuffix: e.slice(i) }
}

export function previewRange(start: string, end: string): { count: number; preview: string[]; error?: string } {
  const result = generateShieldtagRange(start, end)
  if (result.error) return { count: 0, preview: [], error: result.error }
  const preview = result.codes.length <= 6
    ? result.codes
    : [...result.codes.slice(0, 3), '...', ...result.codes.slice(-2)]
  return { count: result.codes.length, preview }
}
