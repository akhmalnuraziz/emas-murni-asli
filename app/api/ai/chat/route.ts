import { NextRequest, NextResponse } from 'next/server'

const GROQ_API_URL = process.env.GROQ_API_URL!
const GROQ_API_KEY = process.env.GROQ_API_KEY!

const SYSTEM_PROMPT = `Kamu adalah asisten AI untuk sistem manajemen produksi emas PT Emas Murni Asli. 
Kamu bisa membantu menjawab pertanyaan tentang:
- Stok emas dan shieldtag
- Status produksi (Cutting, Pas Berat, Annealing, Packing)
- Data penjualan dan buyback
- Mutasi barang antar cabang
- Laporan keuangan dan pengeluaran
- PO (Purchase Order) dan packaging
- KPI tim dan performa produksi

Jawablah dengan singkat, jelas, dan dalam Bahasa Indonesia.
Gunakan data yang diberikan user untuk memberikan analisis yang akurat.`

export async function POST(req: NextRequest) {
  try {
    const { messages, model = 'llama-3.3-70b-versatile' } = await req.json()

    if (!GROQ_API_URL || !GROQ_API_KEY) {
      return NextResponse.json(
        { error: 'API belum dikonfigurasi. Hubungi admin.' },
        { status: 500 }
      )
    }

    const response = await fetch(`${GROQ_API_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...messages,
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
      } catch {
        // Use default
      }

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
