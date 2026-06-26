import { NextRequest, NextResponse } from 'next/server'

const GROQ_API_URL = process.env.GROQ_API_URL!
const GROQ_API_KEY = process.env.GROQ_API_KEY!

const ANALYSIS_PROMPT = `Kamu adalah analis data untuk PT Emas Murni Asli, produsen emas.
Berdasarkan data yang diberikan, buatlah analisis singkat yang mencakup:
1. Ringkasan kondisi saat ini
2. Trend atau pola yang terlihat
3. Potensi masalah atau risiko
4. Rekomendasi tindakan

Jawab dalam Bahasa Indonesia, singkat dan padat. Gunakan poin-poin jika perlu.`

export async function POST(req: NextRequest) {
  try {
    const { data, question, model = 'llama-3.3-70b-versatile' } = await req.json()

    if (!GROQ_API_URL || !GROQ_API_KEY) {
      return NextResponse.json(
        { error: 'API belum dikonfigurasi. Hubungi admin.' },
        { status: 500 }
      )
    }

    const userMessage = `Berikut adalah data dari sistem ERP kami:

${JSON.stringify(data, null, 2)}

Pertanyaan: ${question || 'Buat analisis kondisi bisnis saat ini berdasarkan data di atas.'}`

    const response = await fetch(`${GROQ_API_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: ANALYSIS_PROMPT },
          { role: 'user', content: userMessage },
        ],
        stream: true,
        max_tokens: 2048,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      let errorMsg = 'Layanan AI sedang tidak tersedia.'

      try {
        const errorData = JSON.parse(errorText)
        if (errorData.error?.message) {
          errorMsg = errorData.error.message
        }
      } catch {}

      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: errorMsg })}\n\n`))
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        },
      })

      return new Response(stream, {
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
      })
    }

    const encoder = new TextEncoder()
    const decoder = new TextDecoder()

    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader()
        if (!reader) { controller.close(); return }

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            const chunk = decoder.decode(value, { stream: true })
            const lines = chunk.split('\n').filter(line => line.trim() !== '')

            for (const line of lines) {
              const trimmed = line.replace(/^data: /, '')
              if (trimmed === '[DONE]') {
                controller.enqueue(encoder.encode('data: [DONE]\n\n'))
                break
              }
              try {
                const parsed = JSON.parse(trimmed)
                const content = parsed.choices?.[0]?.delta?.content
                if (content) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`))
                }
              } catch {}
            }
          }
        } catch (error) {
          controller.error(error)
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Gagal terhubung ke server. Periksa koneksi internet anda.' },
      { status: 500 }
    )
  }
}
