'use client'

import { useState, useRef, useEffect } from 'react'
import { QrCode, Copy, Download, Check, Barcode, Share2, Printer } from 'lucide-react'
import WidgetSizeToggle from './WidgetSizeToggle'
import { QRCodeCanvas } from 'qrcode.react'
import JsBarcode from 'jsbarcode'
import { showToast } from '@/utils/sweetalert'

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
  const STORAGE_KEY = 'artQrWidgetV1'
  const [format, setFormat] = useState<BarcodeFormat>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      const parsed = raw ? (JSON.parse(raw) as any) : null
      return parsed?.format === 'qrcode' || parsed?.format === 'code128' ? parsed.format : 'code128'
    } catch {
      return 'code128'
    }
  })
  const [text, setText] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      const parsed = raw ? (JSON.parse(raw) as any) : null
      return typeof parsed?.text === 'string' && parsed.text.trim() ? parsed.text : ''
    } catch {
      return ''
    }
  })
  const [generatedText, setGeneratedText] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [copyingImage, setCopyingImage] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [printing, setPrinting] = useState(false)
  const barcodeSvgRef = useRef<SVGSVGElement>(null)
  const qrWrapRef = useRef<HTMLDivElement | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [qrSize, setQrSize] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      const parsed = raw ? (JSON.parse(raw) as any) : null
      const s = Number(parsed?.qrSize)
      if (Number.isFinite(s) && s >= 120 && s <= 320) return s
      return 160
    } catch {
      return 160
    }
  })
  const [qrFg, setQrFg] = useState<string>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      const parsed = raw ? (JSON.parse(raw) as any) : null
      return typeof parsed?.qrFg === 'string' ? parsed.qrFg : '#ffffff'
    } catch {
      return '#ffffff'
    }
  })
  const [qrBg, setQrBg] = useState<string>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      const parsed = raw ? (JSON.parse(raw) as any) : null
      return typeof parsed?.qrBg === 'string' ? parsed.qrBg : '#0f172a'
    } catch {
      return '#0f172a'
    }
  })
  const [barcodeFg, setBarcodeFg] = useState<string>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      const parsed = raw ? (JSON.parse(raw) as any) : null
      return typeof parsed?.barcodeFg === 'string' ? parsed.barcodeFg : '#0f172a'
    } catch {
      return '#0f172a'
    }
  })
  const [barcodeBg, setBarcodeBg] = useState<string>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      const parsed = raw ? (JSON.parse(raw) as any) : null
      return typeof parsed?.barcodeBg === 'string' ? parsed.barcodeBg : '#ffffff'
    } catch {
      return '#ffffff'
    }
  })

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const trimmed = text.trim()
    if (!trimmed) { setGeneratedText(null); setError(null); return }
    debounceRef.current = setTimeout(() => { setError(null); setGeneratedText(trimmed) }, 350)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [text, format])

  useEffect(() => {
    // hydrate generatedText on first render
    const trimmed = text.trim()
    setGeneratedText(trimmed ? trimmed : null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ format, text, qrSize, qrFg, qrBg, barcodeFg, barcodeBg }),
      )
    } catch {
      // ignore
    }
  }, [format, text, qrSize, qrFg, qrBg, barcodeFg, barcodeBg])

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
          lineColor: barcodeFg,
          background: barcodeBg,
        })
      } catch (e: any) {
        setError(e.message || 'ไม่สามารถสร้าง Barcode ได้')
      }
    }
  }, [generatedText, format, barcodeFg, barcodeBg])

  const getQrCanvas = () => {
    return qrWrapRef.current?.querySelector('canvas') as HTMLCanvasElement | null
  }

  const canvasToPngBlob = (canvas: HTMLCanvasElement) =>
    new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) reject(new Error('ไม่สามารถสร้างไฟล์รูปภาพได้'))
        else resolve(blob)
      }, 'image/png')
    })

  const getQrPngBlob = async (): Promise<Blob> => {
    const canvas = getQrCanvas()
    if (!canvas) throw new Error('ไม่พบ QR Code')
    return canvasToPngBlob(canvas)
  }

  const getBarcodeSvgBlob = async (): Promise<Blob> => {
    const svg = barcodeSvgRef.current
    if (!svg) throw new Error('ไม่พบบาร์โค้ด')
    const svgString = new XMLSerializer().serializeToString(svg)
    return new Blob([svgString], { type: 'image/svg+xml' })
  }

  // Convert SVG barcode to PNG Blob via offscreen canvas for clipboard copying
  const getBarcodePngBlob = async (): Promise<Blob> => {
    const svg = barcodeSvgRef.current
    if (!svg) throw new Error('ไม่พบบาร์โค้ด')
    const svgString = new XMLSerializer().serializeToString(svg)
    const blob = new Blob([svgString], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const img = new Image()
    // Ensure image loads before drawing
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = (e) => reject(new Error('โหลดภาพ SVG ไม่สำเร็จ'))
      img.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = img.width || 200
    canvas.height = img.height || 200
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('ไม่สามารถสร้าง Canvas context ได้')
    ctx.drawImage(img, 0, 0)
    URL.revokeObjectURL(url)
    return canvasToPngBlob(canvas)
  }

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.download = filename
    link.href = url
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const copyToClipboard = async () => {
    if (!generatedText) return
    try {
      await navigator.clipboard.writeText(generatedText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      showToast('ไม่สามารถคัดลอกได้', 'error')
    }
  }

  const copyImageToClipboard = async () => {
    if (!generatedText) return
    if (!navigator.clipboard || typeof (window as any).ClipboardItem === 'undefined') {
      showToast('เบราว์เซอร์ไม่รองรับการคัดลอกรูปภาพ', 'warning')
      return
    }

    setCopyingImage(true)
    try {
      if (format === 'qrcode') {
        const blob = await getQrPngBlob()
        // ClipboardItem type is available in modern browsers; we guard above
        const item = new (window as any).ClipboardItem({ 'image/png': blob })
        await navigator.clipboard.write([item])
        showToast('คัดลอกรูปภาพแล้ว', 'success')
        return
      }

      // Barcode: copy image by converting SVG to PNG
      try {
        const blob = await getBarcodePngBlob()
        const item = new (window as any).ClipboardItem({ 'image/png': blob })
        await navigator.clipboard.write([item])
        showToast('คัดลอกรูปภาพบาร์โค้ดแล้ว', 'success')
        return
      } catch (e) {
        // Fallback to copy text if image conversion fails
        await navigator.clipboard.writeText(generatedText)
        showToast('คัดลอกข้อความแล้ว (บาร์โค้ดคัดลอกเป็นรูปต้องใช้ HTTPS/เบราว์เซอร์ที่รองรับ)', 'info')
      }
    } catch {
      showToast('ไม่สามารถคัดลอกรูปภาพได้', 'error')
    } finally {
      setCopyingImage(false)
    }
  }

  const shareImage = async () => {
    if (!generatedText) return
    if (!('share' in navigator)) {
      showToast('อุปกรณ์นี้ไม่รองรับการแชร์', 'warning')
      return
    }

    setSharing(true)
    try {
      if (format === 'qrcode') {
        const blob = await getQrPngBlob()
        const file = new File([blob], `qr-${Date.now()}.png`, { type: 'image/png' })
        await (navigator as any).share({ files: [file], title: 'QR Code', text: generatedText })
        return
      }

      const blob = await getBarcodeSvgBlob()
      const file = new File([blob], `barcode-${Date.now()}.svg`, { type: 'image/svg+xml' })
      await (navigator as any).share({ files: [file], title: 'Barcode', text: generatedText })
    } catch {
      // user cancelled or not supported
    } finally {
      setSharing(false)
    }
  }

  const printCode = async () => {
    if (!generatedText) return
    setPrinting(true)
    try {
      const w = window.open('', '_blank', 'noopener,noreferrer')
      if (!w) {
        showToast('ไม่สามารถเปิดหน้าต่างพิมพ์ได้', 'error')
        return
      }

      const renderPrint = (url: string) => {
        const html = `
          <html>
            <head><title>Print</title><style>body{margin:0;display:flex;align-items:center;justify-content:center;height:100vh;}</style></head>
            <body>
              <img src="${url}" style="max-width:90vw;max-height:90vh;" onload="window.print(); setTimeout(() => { URL.revokeObjectURL('${url}'); window.close(); }, 500);" />
            </body>
          </html>`;
        w.document.open();
        w.document.write(html);
        w.document.close();
        w.focus();
      }

      if (format === 'qrcode') {
        const blob = await getQrPngBlob()
        const url = URL.createObjectURL(blob)
        renderPrint(url)
        return
      }

      const blob = await getBarcodePngBlob()
      const url = URL.createObjectURL(blob)
      renderPrint(url)
      return
    } finally {
      setPrinting(false)
    }
  }

  const downloadImage = () => {
    if (!generatedText) return
    if (format === 'qrcode') {
      getQrPngBlob()
        .then((blob) => downloadBlob(blob, `qr-${Date.now()}.png`))
        .catch(() => showToast('ไม่สามารถดาวน์โหลดได้', 'error'))
    } else {
      getBarcodePngBlob()
        .then((blob) => downloadBlob(blob, `barcode-${Date.now()}.png`))
        .catch(() => showToast('ไม่สามารถดาวน์โหลดได้', 'error'))
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
                <div ref={qrWrapRef} className="p-3 bg-white rounded-xl shadow-sm border border-slate-200">
                  <QRCodeCanvas
                    value={generatedText}
                    size={width === 3 ? Math.max(qrSize, 200) : qrSize}
                    fgColor={qrFg}
                    bgColor={qrBg}
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
              <div className="flex flex-wrap justify-center gap-2.5">
                <button
                  onClick={copyImageToClipboard}
                  disabled={copyingImage}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                  aria-label="คัดลอกรูปภาพ"
                >
                  <Copy size={14} />
                  {copyingImage ? 'กำลังคัดลอก...' : 'คัดลอกรูป'}
                </button>
                <button
                  onClick={downloadImage}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 hover:bg-slate-700 px-4 py-2 text-xs font-semibold text-white transition-all active:scale-95"
                  aria-label="ดาวน์โหลด"
                >
                  <Download size={14} />
                  ดาวน์โหลด
                </button>
                <button
                  onClick={printCode}
                  disabled={printing}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                  aria-label="พิมพ์"
                >
                  <Printer size={14} />
                  {printing ? 'กำลังเตรียม...' : 'พิมพ์'}
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
