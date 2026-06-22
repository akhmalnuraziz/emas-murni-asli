'use client'

import { useRef, useState, useEffect } from 'react'

// Canvas tanda tangan digital. Output: dataURL PNG via onChange.
export default function SignaturePad({ label, onChange }: {
  label: string
  onChange: (dataUrl: string | null) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const [hasSign, setHasSign] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    // High-DPI scaling
    const ratio = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * ratio
    canvas.height = rect.height * ratio
    ctx.scale(ratio, ratio)
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#1F2937'
  }, [])

  function pos(e: React.PointerEvent) {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function start(e: React.PointerEvent) {
    e.preventDefault()
    drawing.current = true
    const ctx = canvasRef.current!.getContext('2d')!
    const { x, y } = pos(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }
  function move(e: React.PointerEvent) {
    if (!drawing.current) return
    e.preventDefault()
    const ctx = canvasRef.current!.getContext('2d')!
    const { x, y } = pos(e)
    ctx.lineTo(x, y)
    ctx.stroke()
    if (!hasSign) setHasSign(true)
  }
  function end() {
    if (!drawing.current) return
    drawing.current = false
    const canvas = canvasRef.current!
    onChange(canvas.toDataURL('image/png'))
  }
  function clear() {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasSign(false)
    onChange(null)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-[12px] font-semibold text-gray-500">{label}</label>
        {hasSign && (
          <button type="button" onClick={clear} className="text-[10px] font-semibold text-red-400 hover:text-red-600">Hapus</button>
        )}
      </div>
      <div className="relative rounded-2xl overflow-hidden" style={{ background: '#F8FAFC', border: '1px solid rgba(139,92,246,0.2)' }}>
        <canvas
          ref={canvasRef}
          className="w-full h-32 touch-none cursor-crosshair block"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
        />
        {!hasSign && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-[12px] text-gray-300">✍️ Tanda tangan di sini</span>
          </div>
        )}
      </div>
    </div>
  )
}
