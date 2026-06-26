import { NextRequest, NextResponse } from 'next/server'
import { fetchDashboardContext } from '@/lib/ai/fetch-context'

const GROQ_API_URL = process.env.GROQ_API_URL!
const GROQ_API_KEY = process.env.GROQ_API_KEY!

const SYSTEM_PROMPT = `Kamu adalah asisten AI khusus untuk PT Emas Murni Asli — perusahaan produsen emas.

== CARA KERJA KAMU ==
1. Kamu DAPAT mengakses data real-time dari database ERP perusahaan
2. Data dikirim ke kamu bersamaan dengan pertanyaan user
3. Kamu WAJIB menjawab berdasarkan data yang diberikan, bukan dari pengetahuan umum
4. JANGAN pernah bilang "saya tidak punya akses" atau "saya butuh izin" — KAMU SUDAH PUNYA DATANYA

== FORMAT JAWABAN ==
- Gunakan Bahasa Indonesia
- Singkat, padat, langsung ke inti
- Selalu sebutkan ANGKA SPESIFIK dari data
- Gunakan bullet point untuk multiple items
- Kalo data kosong, bilang: "Belum ada data untuk [kategori]"

== CONTOH ==
User: "Batch aktif ada berapa?"
Data: [ada 5 batch: BCH/2026/061234 (Aktif), BCH/2026/061235 (Proses), ...]
Jawaban: "Saat ini ada 5 batch aktif:
• BCH/2026/061234 — Status: Aktif
• BCH/2026/061235 — Status: Proses
• ..."

User: "Packing hari ini ada?"
Data: [packing: 50 pcs, 10gr=30, 5gr=20]
Jawaban: "Hari ini sudah packing 50 pcs:
• 10gr: 30 pcs
• 5gr: 20 pcs"

User: "Stok shieldtag 10gr berapa?"
Data: [shieldtag 10gr: 15 pcs]
Jawaban: "Stok shieldtag 10gr aktif: 15 pcs"

== ATURAN PENTING ==
- Jika user tanya sesuatu yang TIDAK ada di data, jawab: "Data untuk [X] belum tersedia di sistem"
- Jangan mengarang data atau angka
- Jangan menjual produk atau menawarkan layanan
- Fokus hanya pada data produksi, stok, penjualan, dan operasional emas`

export async function POST(req: NextRequest) {
  try {
    const { messages, model = 'meta-llama/llama-4-scout-17b-16e-instruct' } = await req.json()

    if (!GROQ_API_URL || !GROQ_API_KEY) {
      return NextResponse.json(
        { error: 'API belum dikonfigurasi. Hubungi admin.' },
        { status: 500 }
      )
    }

    // Fetch real-time data dari Supabase
    const dataContext = await fetchDashboardContext()

    const lastUserMsg = messages[messages.length - 1]?.content || ''
    const contextWithQuery = `== DATA REAL-TIME DARI DATABASE ERP ==

${dataContext}

== PERTANYAAN USER ==
${lastUserMsg}`

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
