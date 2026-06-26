import { NextRequest, NextResponse } from 'next/server'
import { fetchDashboardContext } from '@/lib/ai/fetch-context'

const GROQ_API_URL = process.env.GROQ_API_URL!
const GROQ_API_KEY = process.env.GROQ_API_KEY!
const GEMINI_API_KEY = process.env.GEMINI_API_KEY!

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

== ATURAN PENTING ==
- Jika user tanya sesuatu yang TIDAK ada di data, jawab: "Data untuk [X] belum tersedia di sistem"
- Jangan mengarang data atau angka
- Jangan menjual produk atau menawarkan layanan
- Fokus hanya pada data produksi, stok, penjualan, dan operasional emas`

// Gemini API (Google AI Studio)
async function callGemini(messages: any[], dataContext: string, lastUserMsg: string) {
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))

  const contextWithQuery = `== DATA REAL-TIME DARI DATABASE ERP ==

${dataContext}

== PERTANYAAN USER ==
${lastUserMsg}`

  // Replace last user message with context-enriched version
  if (contents.length > 0) {
    contents[contents.length - 1].parts[0].text = contextWithQuery
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents,
        generationConfig: {
          maxOutputTokens: 2048,
          temperature: 0.7,
        },
      }),
    }
  )

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Gemini API error: ${errText}`)
  }

  // Stream Gemini response
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const reader = response.body?.getReader()
      if (!reader) { controller.close(); return }
      const decoder = new TextDecoder()

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value, { stream: true })
          // Gemini streaming returns JSON array of chunks
          try {
            const lines = chunk.split('\n').filter(l => l.trim().startsWith('{'))
            for (const line of lines) {
              const cleaned = line.replace(/^data: /, '').trim()
              if (!cleaned) continue
              const data = JSON.parse(cleaned)
              const text = data.candidates?.[0]?.content?.parts?.[0]?.text
              if (text) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: text })}\n\n`))
              }
            }
          } catch {}
        }
      } catch (e) {
        controller.error(e)
      } finally {
        controller.close()
      }
    },
  })

  return stream
}

// Groq API (OpenAI-compatible)
async function callGroq(messages: any[], model: string, dataContext: string, lastUserMsg: string) {
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
    const errText = await response.text()
    let errorMsg = 'Layanan AI sedang tidak tersedia.'
    try {
      const errData = JSON.parse(errText)
      if (errData.error?.message) errorMsg = errData.error.message
    } catch {}
    throw new Error(errorMsg)
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

  return stream
}

export async function POST(req: NextRequest) {
  try {
    const { messages, model = 'meta-llama/llama-4-scout-17b-16e-instruct', provider = 'groq' } = await req.json()

    // Fetch real-time data dari Supabase
    const dataContext = await fetchDashboardContext()
    const lastUserMsg = messages[messages.length - 1]?.content || ''

    let stream: ReadableStream

    if (provider === 'gemini' && GEMINI_API_KEY) {
      // Use Gemini
      try {
        stream = await callGemini(messages, dataContext, lastUserMsg)
      } catch (geminiError: any) {
        // Fallback to Groq if Gemini fails
        console.error('[Gemini fallback]', geminiError?.message)
        stream = await callGroq(messages, 'meta-llama/llama-4-scout-17b-16e-instruct', dataContext, lastUserMsg)
      }
    } else {
      // Use Groq
      if (!GROQ_API_URL || !GROQ_API_KEY) {
        return NextResponse.json(
          { error: 'API belum dikonfigurasi. Hubungi admin.' },
          { status: 500 }
        )
      }
      stream = await callGroq(messages, model, dataContext, lastUserMsg)
    }

    return new Response(stream, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Gagal terhubung ke server. Periksa koneksi internet anda.' },
      { status: 500 }
    )
  }
}
