/**
 * Compress an image file client-side using Canvas API.
 * Max 1200px on longest side, quality 0.82.
 * Returns a base64 data URL string.
 */
export async function compressImage(file: File, maxPx = 1200, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        let { width, height } = img
        if (width > maxPx || height > maxPx) {
          if (width > height) { height = Math.round((height / width) * maxPx); width = maxPx }
          else { width = Math.round((width / height) * maxPx); height = maxPx }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.onerror = reject
      img.src = e.target?.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/**
 * Pick an image file via input and return compressed base64.
 * Returns null if user cancels.
 */
export function pickAndCompress(maxPx = 1200, quality = 0.82): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) { resolve(null); return }
      try {
        const compressed = await compressImage(file, maxPx, quality)
        resolve(compressed)
      } catch { resolve(null) }
    }
    input.oncancel = () => resolve(null)
    input.click()
  })
}
