'use client'

import { useState, useRef, useEffect } from 'react'
import { QrCode, Copy, Download, Check, Barcode } from 'lucide-react'
import WidgetSizeToggle from './WidgetSizeToggle'
import { QRCodeCanvas } from 'qrcode.react'
import JsBarcode from 'jsbarcode'

type BarcodeFormat = 'qrcode' | 'code128'

const formatOptions: { value: BarcodeFormat; label: string; icon: typeof QrCode }[] = [
  { value: 'code128', label: 'Code 128', icon: Barcode },
  { value: 'qrcode', label: 'QR Code', icon: QrCode },
]

export default function QRCodeWidget({
  width = 1,
  onResize
}: {
  width?: number
  onResize?: (size: number) => void
}) {
  const [format, setFormat] = useState<BarcodeFormat>('code128')
  const [text, setText] = useState('TEST-001')
  const [generatedText, setGeneratedText] = useState<string | null>('TEST-001')
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const barcodeSvgRef = useRef<SVGSVGElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const trimmed = text.trim()
    if (!trimmed) { setGeneratedText(null); setError(null); return }
    debounceRef.current = setTimeout(() => { setError(null); setGeneratedText(trimmed) }, 400)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [text, format])

  useEffect(() => {
    if (generatedText && format === 'code128' && barcodeSvgRef.current) {
      try {
        JsBarcode(barcodeSvgRef.current, generatedText, {
          format: 'CODE128',
          width: 2,
          height: 80,
          displayValue: true,
          fontSize: 14,
          margin: 10,
          lineColor: '#0f172a',
          background: 'transparent',
        })
      } catch (e: any) {
        setError(e.message || 'ไม่สามารถสร้าง Barcode ได้')
      }
    }
  }, [generatedText, format])

  const copyToClipboard = async () => {
    if (!generatedText) return
    try {
      await navigator.clipboard.writeText(generatedText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* silent */ }
  }

  const downloadImage = () => {
    if (format === 'qrcode') {
      const canvas = document.querySelector('#qr-code-canvas canvas') as HTMLCanvasElement
      if (!canvas) return
      const link = document.createElement('a')
      link.download = `qr-${Date.now()}.png`
      link.href = canvas.toDataURL('image/png')
      document.body.appendChild(link); link.click(); document.body.removeChild(link)
    } else {
      const svg = barcodeSvgRef.current
      if (!svg) return
      const svgString = new XMLSerializer().serializeToString(svg)
      const url = URL.createObjectURL(new Blob([svgString], { type: 'image/svg+xml' }))
      const link = document.createElement('a')
      link.download = `barcode-${Date.now()}.svg`
      link.href = url
      document.body.appendChild(link); link.click(); document.body.removeChild(link)
      URL.revokeObjectURL(url)
    }
  }

  return (
    <section className="premium-card !rounded-[14px] h-full flex flex-col" aria-labelledby="qr-title">
      <div className="p-4 sm:p-5 flex flex-col gap-4 flex-1">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-slate-900 text-white shadow-sm">
              {format === 'qrcode' ? <QrCode size={18} /> : <Barcode size={18} />}
            </div>
            <div>
              <h3 id="qr-title" className="text-base font-bold text-slate-900 tracking-tight">
                {format === 'qrcode' ? 'QR Code' : 'Code 128'}
              </h3>
              <p className="text-[11px] text-slate-400">
                {format === 'qrcode' ? 'แปลงข้อความหรือ URL' : 'แปลงข้อความเป็นบาร์โค้ด'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {onResize && <WidgetSizeToggle value={width} onChange={onResize} sizes={[1, 2, 3]} />}
          </div>
        </div>

        {/* Format toggle */}
        <div className="relative bg-slate-100 rounded-xl p-1 flex">
          {formatOptions.map((opt) => {
            const Icon = opt.icon
            const isActive = format === opt.value
            return (
              <button
                key={opt.value}
                onClick={() => {
                  setFormat(opt.value)
                  setError(null)
                  setText('TEST-001')
                  setGeneratedText('TEST-001')
                }}
                className={`relative z-10 flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-[10px] text-sm font-semibold transition-all duration-200 ${
                  isActive ? 'text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {isActive && <span className="absolute inset-0 rounded-[10px] bg-slate-900 shadow-sm" />}
                <span className="relative z-10 flex items-center gap-1.5">
                  <Icon size={16} />
                  {opt.label}
                </span>
              </button>
            )
          })}
        </div>

        {/* Input */}
        <input
          type="text"
          value={text}
          onChange={(e) => { setText(e.target.value); setError(null) }}
          placeholder={format === 'qrcode' ? 'พิมพ์ข้อความหรือ URL...' : 'พิมพ์ข้อความสำหรับบาร์โค้ด...'}
          className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-900 transition shadow-sm"
          aria-label="ข้อความสำหรับสร้าง"
        />

        {/* Result */}
        <div className="min-h-0 flex-1 flex flex-col">
          {generatedText && (
            <div className="flex flex-col items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {format === 'qrcode' ? (
                <div id="qr-code-canvas" className="p-3 bg-white rounded-xl shadow-sm border border-slate-200">
                  <QRCodeCanvas
                    value={generatedText}
                    size={140}
                    fgColor="#ffffff"
                    bgColor="#0f172a"
                    level="M"
                    includeMargin
                  />
                </div>
              ) : (
                <div className="p-3 bg-white rounded-xl shadow-sm border border-slate-200 w-full flex justify-center" style={{ minHeight: '166px', alignItems: 'center' }}>
                  <svg ref={barcodeSvgRef} />
                </div>
              )}
              <p className="text-xs text-slate-500 text-center max-w-full truncate px-2 font-medium bg-slate-50 rounded-lg py-1.5 w-full">
                {generatedText}
              </p>
              <div className="flex gap-2.5">
                <button
                  onClick={copyToClipboard}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 transition-all active:scale-95"
                  aria-label="คัดลอกข้อความ"
                >
                  {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                  {copied ? 'คัดลอกแล้ว' : 'คัดลอก'}
                </button>
                <button
                  onClick={downloadImage}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 hover:bg-slate-700 px-4 py-2 text-xs font-semibold text-white transition-all active:scale-95"
                  aria-label="ดาวน์โหลด"
                >
                  <Download size={14} />
                  ดาวน์โหลด
                </button>
              </div>
            </div>
          )}

          {!generatedText && !error && !text.trim() && (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-6 gap-2">
              <div className="p-4 rounded-full bg-slate-100 mb-1">
                {format === 'qrcode'
                  ? <QrCode size={36} className="text-slate-300" />
                  : <Barcode size={36} className="text-slate-300" />
                }
              </div>
              <p className="text-sm text-slate-400 font-medium">
                {format === 'qrcode' ? 'ยังไม่มี QR Code' : 'ยังไม่มีบาร์โค้ด'}
              </p>
              <p className="text-xs text-slate-300 max-w-[200px]">
                {format === 'qrcode' ? 'พิมพ์ข้อความหรือ URL ด้านบน' : 'พิมพ์ข้อความด้านบน'}
              </p>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 px-3.5 py-2.5 rounded-xl text-xs font-medium">
              {error}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
