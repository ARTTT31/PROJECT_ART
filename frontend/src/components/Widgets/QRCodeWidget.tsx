'use client'

import { useEffect, useRef, useState } from 'react'
import { Barcode, Copy, Download, Printer, QrCode } from 'lucide-react'
import WidgetSizeToggle from './WidgetSizeToggle'
import { QRCodeCanvas } from 'qrcode.react'
import JsBarcode from 'jsbarcode'
import { showToast } from '@/utils/sweetalert'

// ── Types & constants ─────────────────────────────────────────────────────────

type BarcodeFormat = 'qrcode' | 'code128'

const formatOptions: { value: BarcodeFormat; label: string; icon: typeof QrCode }[] = [
  { value: 'code128', label: 'Code 128', icon: Barcode },
  { value: 'qrcode',  label: 'QR Code',  icon: QrCode  },
]

const STORAGE_KEY = 'artQrWidgetV1'

function readStorage<T>(key: keyof T, fallback: any, validator?: (v: any) => boolean): any {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as any) : null
    const v = parsed?.[key]
    if (validator) return validator(v) ? v : fallback
    return v ?? fallback
  } catch {
    return fallback
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function QRCodeWidget({
  width = 1,
  onResize,
}: {
  width?: number
  onResize?: (size: number) => void
}) {
  // ── Persisted state ─────────────────────────────────────────────────────────
  const [format, setFormat] = useState<BarcodeFormat>(() =>
    readStorage('format', 'code128', (v) => v === 'qrcode' || v === 'code128'),
  )
  const [text, setText] = useState<string>(() =>
    readStorage('text', '', (v) => typeof v === 'string' && v.trim().length > 0),
  )
  const [qrSize, setQrSize]   = useState<number>(() => readStorage('qrSize', 160,       (v) => Number.isFinite(+v) && +v >= 120 && +v <= 320))
  const [qrFg, setQrFg]       = useState<string>(() => readStorage('qrFg',   '#ffffff', (v) => typeof v === 'string'))
  const [qrBg, setQrBg]       = useState<string>(() => readStorage('qrBg',   '#0f172a', (v) => typeof v === 'string'))
  const [barcodeFg, setBarcodeFg] = useState<string>(() => readStorage('barcodeFg', '#0f172a', (v) => typeof v === 'string'))
  const [barcodeBg, setBarcodeBg] = useState<string>(() => readStorage('barcodeBg', '#ffffff',  (v) => typeof v === 'string'))

  // ── Ephemeral state ─────────────────────────────────────────────────────────
  const [generatedText, setGeneratedText] = useState<string | null>(null)
  const [error, setError]         = useState<string | null>(null)
  const [copyingImage, setCopyingImage] = useState(false)
  const [printing, setPrinting]   = useState(false)

  const barcodeSvgRef = useRef<SVGSVGElement>(null)
  const qrWrapRef     = useRef<HTMLDivElement | null>(null)
  const debounceRef   = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Hydrate generated text on mount ────────────────────────────────────────
  useEffect(() => {
    const trimmed = text.trim()
    setGeneratedText(trimmed || null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Debounced code generation ────────────────────────────────────────────────
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const trimmed = text.trim()
    if (!trimmed) { setGeneratedText(null); setError(null); return }
    debounceRef.current = setTimeout(() => { setError(null); setGeneratedText(trimmed) }, 350)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [text, format])

  // ── Persist to localStorage ──────────────────────────────────────────────────
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ format, text, qrSize, qrFg, qrBg, barcodeFg, barcodeBg }),
      )
    } catch { /* ignore */ }
  }, [format, text, qrSize, qrFg, qrBg, barcodeFg, barcodeBg])

  // ── Render barcode SVG ───────────────────────────────────────────────────────
  useEffect(() => {
    if (generatedText && format === 'code128' && barcodeSvgRef.current) {
      try {
        JsBarcode(barcodeSvgRef.current, generatedText, {
          format: 'CODE128',
          width: 2, height: 80,
          displayValue: true, fontSize: 14, margin: 10,
          lineColor: barcodeFg, background: barcodeBg,
        })
        setError(null)
      } catch (e: any) {
        setError(e.message || 'ไม่สามารถสร้าง Barcode ได้')
      }
    }
  }, [generatedText, format, barcodeFg, barcodeBg])

  // ── Image helpers ────────────────────────────────────────────────────────────
  const canvasToPngBlob = (canvas: HTMLCanvasElement) =>
    new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => b ? resolve(b) : reject(new Error('ไม่สามารถสร้างไฟล์รูปภาพได้')), 'image/png')
    })

  const getQrPngBlob = async (): Promise<Blob> => {
    const canvas = qrWrapRef.current?.querySelector('canvas') as HTMLCanvasElement | null
    if (!canvas) throw new Error('ไม่พบ QR Code')
    return canvasToPngBlob(canvas)
  }

  const getBarcodeSvgBlob = async (): Promise<Blob> => {
    const svg = barcodeSvgRef.current
    if (!svg) throw new Error('ไม่พบบาร์โค้ด')
    return new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' })
  }

  const getBarcodePngBlob = async (): Promise<Blob> => {
    const svg = barcodeSvgRef.current
    if (!svg) throw new Error('ไม่พบบาร์โค้ด')
    const svgBlob = new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(svgBlob)
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('โหลดภาพ SVG ไม่สำเร็จ'))
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

  // ── Actions ──────────────────────────────────────────────────────────────────
  const copyImageToClipboard = async () => {
    if (!generatedText) return
    if (!navigator.clipboard || typeof (window as any).ClipboardItem === 'undefined') {
      showToast('เบราว์เซอร์ไม่รองรับการคัดลอกรูปภาพ', 'warning')
      return
    }
    setCopyingImage(true)
    try {
      const blob = format === 'qrcode' ? await getQrPngBlob() : await getBarcodePngBlob().catch(async () => {
        await navigator.clipboard.writeText(generatedText)
        showToast('คัดลอกข้อความแล้ว (บาร์โค้ดคัดลอกเป็นรูปต้องใช้ HTTPS)', 'info')
        return null
      })
      if (!blob) return
      const item = new (window as any).ClipboardItem({ 'image/png': blob })
      await navigator.clipboard.write([item])
      showToast(format === 'qrcode' ? 'คัดลอกรูปภาพแล้ว' : 'คัดลอกรูปภาพบาร์โค้ดแล้ว', 'success')
    } catch {
      showToast('ไม่สามารถคัดลอกรูปภาพได้', 'error')
    } finally {
      setCopyingImage(false)
    }
  }

  const shareImage = async () => {
    if (!generatedText || !('share' in navigator)) {
      showToast('อุปกรณ์นี้ไม่รองรับการแชร์', 'warning')
      return
    }
    try {
      if (format === 'qrcode') {
        const blob = await getQrPngBlob()
        await (navigator as any).share({ files: [new File([blob], `qr-${Date.now()}.png`, { type: 'image/png' })], title: 'QR Code', text: generatedText })
      } else {
        const blob = await getBarcodeSvgBlob()
        await (navigator as any).share({ files: [new File([blob], `barcode-${Date.now()}.svg`, { type: 'image/svg+xml' })], title: 'Barcode', text: generatedText })
      }
    } catch { /* user cancelled */ }
  }

  const printCode = async () => {
    if (!generatedText) return
    setPrinting(true)
    try {
      const w = window.open('', '_blank', 'noopener,noreferrer')
      if (!w) { showToast('ไม่สามารถเปิดหน้าต่างพิมพ์ได้', 'error'); return }
      const blob = format === 'qrcode' ? await getQrPngBlob() : await getBarcodePngBlob()
      const url = URL.createObjectURL(blob)
      w.document.write(`<html><head><title>Print</title><style>body{margin:0;display:flex;align-items:center;justify-content:center;height:100vh;}</style></head><body><img src="${url}" style="max-width:90vw;max-height:90vh;" onload="window.print();setTimeout(()=>{URL.revokeObjectURL('${url}');window.close();},500);"/></body></html>`)
      w.document.close()
      w.focus()
    } finally {
      setPrinting(false)
    }
  }

  const downloadImage = () => {
    if (!generatedText) return
    const promise = format === 'qrcode' ? getQrPngBlob() : getBarcodePngBlob()
    promise
      .then((blob) => downloadBlob(blob, `${format === 'qrcode' ? 'qr' : 'barcode'}-${Date.now()}.png`))
      .catch(() => showToast('ไม่สามารถดาวน์โหลดได้', 'error'))
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <section
      className="flex h-full flex-col rounded-2xl bg-white ring-1 ring-black/[0.06]"
      aria-labelledby="qr-title"
    >
      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-5">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Dark icon badge — intentional for "code" identity */}
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[#1d1d1f]">
              {format === 'qrcode'
                ? <QrCode size={18} className="text-white" aria-hidden="true" />
                : <Barcode size={18} className="text-white" aria-hidden="true" />}
            </div>
            <div>
              <h3
                id="qr-title"
                className="text-[15px] font-bold tracking-tight text-[#1d1d1f]"
              >
                {format === 'qrcode' ? 'QR Code' : 'Code 128'}
              </h3>
              <p className="mt-0.5 text-[11px] text-[#6e6e73]">
                {format === 'qrcode' ? 'แปลงข้อความหรือ URL' : 'แปลงข้อความเป็นบาร์โค้ด'}
              </p>
            </div>
          </div>

          {onResize && (
            <WidgetSizeToggle value={width} onChange={onResize} sizes={[1, 2, 3]} />
          )}
        </div>

        {/* ── Format toggle ────────────────────────────────────────────── */}
        <div
          className="flex gap-2 rounded-full bg-[#f5f5f7] p-1"
          role="group"
          aria-label="เลือกรูปแบบโค้ด"
        >
          {formatOptions.map(({ value: val, label, icon: Icon }) => {
            const isActive = format === val
            return (
              <button
                key={val}
                onClick={() => { setFormat(val); setError(null) }}
                aria-pressed={isActive}
                className={[
                  'flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-semibold transition-all duration-150',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3] focus-visible:ring-offset-1',
                  isActive
                    ? 'bg-white text-[#1d1d1f] shadow-sm ring-1 ring-black/[0.06]'
                    : 'text-[#6e6e73] hover:text-[#1d1d1f]',
                ].join(' ')}
              >
                <Icon size={14} aria-hidden="true" />
                {label}
              </button>
            )
          })}
        </div>

        {/* ── Text input ───────────────────────────────────────────────── */}
        <input
          type="text"
          value={text}
          onChange={(e) => { setText(e.target.value); setError(null) }}
          placeholder={
            format === 'qrcode'
              ? 'พิมพ์ข้อความหรือ URL...'
              : 'พิมพ์ข้อความสำหรับบาร์โค้ด...'
          }
          className={[
            'w-full rounded-xl bg-[#f5f5f7] px-4 py-2.5 text-sm text-[#1d1d1f]',
            'placeholder:text-[#6e6e73]',
            'border-none outline-none',
            'ring-1 ring-black/[0.06]',
            'transition-all duration-150',
            'focus:bg-white focus:ring-2 focus:ring-[#0071e3]',
          ].join(' ')}
          aria-label="ข้อความสำหรับสร้าง"
        />

        {/* ── Result area ──────────────────────────────────────────────── */}
        <div className="flex min-h-0 flex-1 flex-col">

          {/* Generated output */}
          {generatedText && (
            <div className="flex flex-col items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-200">

              {/* Code preview */}
              {format === 'qrcode' ? (
                <div
                  ref={qrWrapRef}
                  className="overflow-hidden rounded-2xl bg-[#f5f5f7] p-3 ring-1 ring-black/[0.06]"
                >
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
                <div
                  className="flex w-full items-center justify-center overflow-hidden rounded-2xl bg-[#f5f5f7] p-3 ring-1 ring-black/[0.06]"
                  style={{ minHeight: '166px' }}
                >
                  <svg ref={barcodeSvgRef} />
                </div>
              )}

              {/* Generated text label */}
              <p className="w-full truncate rounded-xl bg-[#f5f5f7] px-3 py-1.5 text-center text-xs font-medium text-[#6e6e73]">
                {generatedText}
              </p>

              {/* Action buttons */}
              <div className="flex flex-wrap justify-center gap-2">
                <button
                  onClick={copyImageToClipboard}
                  disabled={copyingImage}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#f5f5f7] px-4 py-2 text-xs font-semibold text-[#1d1d1f] ring-1 ring-black/[0.06] transition-all duration-150 hover:bg-white hover:shadow-sm disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]"
                  aria-label="คัดลอกรูปภาพ"
                >
                  <Copy size={13} aria-hidden="true" />
                  {copyingImage ? 'กำลังคัดลอก...' : 'คัดลอกรูป'}
                </button>

                <button
                  onClick={downloadImage}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#0071e3] px-4 py-2 text-xs font-semibold text-white transition-all duration-150 hover:bg-[#0077ed] hover:shadow-[0_2px_8px_rgba(0,113,227,0.3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3] focus-visible:ring-offset-1 active:scale-[0.98]"
                  aria-label="ดาวน์โหลด"
                >
                  <Download size={13} aria-hidden="true" />
                  ดาวน์โหลด
                </button>

                <button
                  onClick={printCode}
                  disabled={printing}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#f5f5f7] px-4 py-2 text-xs font-semibold text-[#1d1d1f] ring-1 ring-black/[0.06] transition-all duration-150 hover:bg-white hover:shadow-sm disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]"
                  aria-label="พิมพ์"
                >
                  <Printer size={13} aria-hidden="true" />
                  {printing ? 'กำลังเตรียม...' : 'พิมพ์'}
                </button>
              </div>
            </div>
          )}

          {/* Empty state */}
          {!generatedText && !error && !text.trim() && (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
              <div className="mb-1 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f5f5f7]">
                {format === 'qrcode'
                  ? <QrCode size={32} className="text-slate-300" aria-hidden="true" />
                  : <Barcode size={32} className="text-slate-300" aria-hidden="true" />}
              </div>
              <p className="text-sm font-semibold text-[#1d1d1f]">
                {format === 'qrcode' ? 'ยังไม่มี QR Code' : 'ยังไม่มีบาร์โค้ด'}
              </p>
              <p className="max-w-[180px] text-xs text-[#6e6e73]">
                {format === 'qrcode' ? 'พิมพ์ข้อความหรือ URL ด้านบน' : 'พิมพ์ข้อความด้านบน'}
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-xs font-medium text-red-700 ring-1 ring-red-200">
              {error}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
