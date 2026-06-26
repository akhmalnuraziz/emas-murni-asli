import { NextRequest, NextResponse } from 'next/server'
import { fetchDashboardContext } from '@/lib/ai/fetch-context'

const GROQ_API_URL = process.env.GROQ_API_URL!
const GROQ_API_KEY = process.env.GROQ_API_KEY!

const SYSTEM_PROMPT = `Kamu adalah asisten AI untuk sistem manajemen produksi emas PT Emas Murni Asli.

Kamu punya akses REAL-TIME ke database sistem ERP kami. Data yang tersedia:
- Batch emas (kode, status, supplier, berat, HPP)
- Pipeline produksi (Cutting → Pas Berat → Annealing → Siap Packing)
- Shieldtag aktif (kode, gramasi, lokasi)
- Penjualan bulan ini
- Packing harian
- Mutasi antar cabang
- Reject yang belum dilebur
- Pengeluaran

TUGASMU:
1. Jawab pertanyaan user BERDASARKAN DATA yang diberikan di bawah
2. Selalu sebutkan angka spesifik dari data
3. Kalo data kosong atau gak ada, bilang "Belum ada data untuk kategori ini"
4. Jawab dalam Bahasa Indonesia, singkat, padat, dan akurat
5. Kalo user tanya tentang sesuatu yang gak ada di data, bilang saja gak ada datanya

CONTOH JAWABAN YANG BAIK:
- "Batch aktif ada 5: BCH/2026/061234, BCH/2026/061235, ..."
- "Hari ini baru packing 50 pcs, gramasi: 10gr (30 pcs), 5gr (20 pcs)"

CONTOH JAWABAN YANG SALAH:
- "Saya tidak memiliki akses ke database" (INI SALAH - KAMU UDAH PUNYA DATA)
- "Anda perlu memberikan izin" (INI SALAH - DATA UDAH DIKIRIM KE KAMU)`

export async function POST(req: NextRequest) {
  try {
    const { messages, model = 'llama-3.3-70b-versatile' } = await req.json()

    if (!GROQ_API_URL || !GROQ_API_KEY) {
      return NextResponse.json(
        { error: 'API belum dikonfigurasi. Hubungi admin.' },
        { status: 500 }
      )
    }

    // Fetch real-time data dari Supabase
    const dataContext = await fetchDashboardContext()

    const lastUserMsg = messages[messages.length - 1]?.content || ''
    const contextWithQuery = `DATA SAAT INI DARI DATABASE:\n${dataContext}\n\n\nPertanyaan user: "${lastUserMsg}"`

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
          ...messages.slice(0, -1),
          { role: 'user', content: contextWithQuery },
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
