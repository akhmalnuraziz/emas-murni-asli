/**
 * Validasi server-side untuk upload base64 image.
 * - Cek magic bytes (JPEG/PNG/WebP), bukan trust MIME.
 * - Hard cap size (default 1MB setelah decode).
 * Throw Error dengan message human-readable kalau invalid.
 */
const MAX_BYTES_DEFAULT = 1_000_000 // 1 MB after base64 decode

export type ImageFormat = 'jpeg' | 'png' | 'webp'

export function decodeAndValidateBase64Image(
  b64: string,
  opts: { maxBytes?: number; allow?: ImageFormat[] } = {}
): { buffer: Buffer; format: ImageFormat; ext: string; contentType: string } {
  const maxBytes = opts.maxBytes ?? MAX_BYTES_DEFAULT
  const allow = opts.allow ?? ['jpeg', 'png', 'webp']

  const stripped = b64.replace(/^data:image\/[^;]+;base64,/, '')
  if (!stripped) throw new Error('Format base64 tidak valid')

  let buffer: Buffer
  try { buffer = Buffer.from(stripped, 'base64') }
  catch { throw new Error('Decode base64 gagal') }
  if (buffer.length === 0) throw new Error('Foto kosong')
  if (buffer.length > maxBytes) {
    throw new Error(`Foto terlalu besar (${(buffer.length / 1024).toFixed(0)} KB). Max ${(maxBytes / 1024).toFixed(0)} KB.`)
  }

  // Magic bytes detection
  let format: ImageFormat | null = null
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) format = 'jpeg'
  else if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) format = 'png'
  else if (
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) format = 'webp'

  if (!format) throw new Error('File bukan gambar (magic bytes tidak cocok)')
  if (!allow.includes(format)) throw new Error(`Format ${format} tidak diizinkan`)

  const ext = format === 'jpeg' ? 'jpg' : format
  const contentType = `image/${format}`
  return { buffer, format, ext, contentType }
}

export function sanitizePathSegment(s: string): string {
  return s.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80)
}
