/**
 * Client-side foto compression
 * Compress sebelum kirim ke server — drastis mengurangi ukuran
 * Max 800px, quality 0.75, output JPEG
 */
export async function compressFoto(file: File, maxPx = 800, quality = 0.75): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let { width, height } = img

        // Scale down kalau lebih besar dari maxPx
        if (width > maxPx || height > maxPx) {
          if (width > height) {
            height = Math.round(height * maxPx / width)
            width  = maxPx
          } else {
            width  = Math.round(width  * maxPx / height)
            height = maxPx
          }
        }

        canvas.width  = width
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

export async function compressFotos(files: File[]): Promise<string[]> {
  return Promise.all(files.map(f => compressFoto(f)))
}
