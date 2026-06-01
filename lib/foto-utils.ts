'use server'
/**
 * Foto utilities - upload ke Supabase Storage
 * Dipanggil dari semua server actions yang handle foto
 */
import { createClient } from '@/lib/supabase/server'

export async function uploadFotosToStorage(
  base64List: string[],
  folder: string
): Promise<string[]> {
  if (!base64List || base64List.length === 0) return []
  const supabase = await createClient()
  const urls: string[] = []

  for (const b64 of base64List) {
    try {
      // Strip data URL prefix jika ada
      const clean = b64.includes(',') ? b64.split(',')[1] : b64
      const mime  = b64.includes('data:') ? b64.split(';')[0].split(':')[1] : 'image/jpeg'
      const ext   = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg'

      const buf  = Buffer.from(clean, 'base64')
      const name = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

      const { data, error } = await supabase.storage
        .from('fotos')
        .upload(name, buf, { contentType: mime, upsert: false })

      if (!error && data) {
        const { data: urlData } = supabase.storage.from('fotos').getPublicUrl(data.path)
        urls.push(urlData.publicUrl)
      }
    } catch (e) {
      console.error('Upload foto error:', e)
      // Skip foto yang gagal, jangan break semua
    }
  }
  return urls
}
