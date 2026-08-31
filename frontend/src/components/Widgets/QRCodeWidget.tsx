'use client'

import { useEffect, useRef, useState } from 'react'
import { Barcode, Copy, Download, Printer, QrCode, Check, AlertCircle } from 'lucide-react'
import WidgetSizeToggle from './WidgetSizeToggle'
import { QRCodeCanvas } from 'qrcode.react'
import JsBarcode from 'jsbarcode'
import { showToast } from '@/utils/sweetalert'

// ── Types & constants ─────────────────────────────────────────────────────────

type BarcodeFormat = 'code128' | 'qrcode'

const formatOptions: { value: BarcodeFormat; label: string; icon: typeof QrCode }[] = [
  { value: 'code128', label: 'Code 128 (บาร์โค้ด)', icon: Barcode },
  { value: 'qrcode', label: 'QR Code', icon: QrCode },
]

const STORAGE_KEY = 'artQrWidgetV2'

function readStorage<T>(key: keyof T, fallback: any, validator?: (v: any) => boolean): any {
  if (typeof window === 'undefined') return fallback
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
  const [qrSize, setQrSize] = useState<number>(() =>
    readStorage('qrSize', 160, (v) => Number.isFinite(+v) && +v >= 120 && +v <= 320),
  )

  // ── Ephemeral state ─────────────────────────────────────────────────────────
  const [generatedText, setGeneratedText] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copyingImage, setCopyingImage] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [copiedSuccess, setCopiedSuccess] = useState(false)

  const barcodeCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const qrWrapRef = useRef<HTMLDivElement | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Hydrate generated text on mount ────────────────────────────────────────
  useEffect(() => {
    const trimmed = text.trim()
    setGeneratedText(trimmed || null)
  }, [])

  // ── Debounced code generation ────────────────────────────────────────────────
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const trimmed = text.trim()
    if (!trimmed) {
      setGeneratedText(null)
      setError(null)
      return
    }
    debounceRef.current = setTimeout(() => {
      setError(null)
      setGeneratedText(trimmed)
    }, 200)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [text, format])

  // ── Persist to localStorage ──────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ format, text, qrSize }),
      )
    } catch {}
  }, [format, text, qrSize])

  // ── Render Barcode directly on Canvas (High performance & Reliable) ─────────
  useEffect(() => {
    if (generatedText && format === 'code128' && barcodeCanvasRef.current) {
      try {
        // Validate ASCII for Code 128
        // eslint-disable-next-line no-control-regex
        const isNonAscii = /[^\x00-\x7F]/.test(generatedText)
        if (isNonAscii) {
          setError('บาร์โค้ด Code 128 รองรับเฉพาะภาษาอังกฤษและตัวเลข (สำหรับภาษาไทยแนะนำให้เลือกใช้ QR Code)')
          return
        }

        JsBarcode(barcodeCanvasRef.current, generatedText, {
          format: 'CODE128',
          width: width >= 2 ? 2.5 : 2,
          height: width >= 3 ? 90 : 75,
          displayValue: true,
          fontSize: 14,
          margin: 12,
          lineColor: '#0f172a',
          background: '#ffffff',
          valid: (valid) => {
            if (!valid) {
              setError('รูปแบบข้อความไม่ถูกต้องสำหรับบาร์โค้ด Code 128')
            } else {
              setError(null)
            }
          },
        })
      } catch (e: any) {
        console.warn('Barcode render error:', e)
        setError(e.message || 'ไม่สามารถสร้าง Barcode ได้')
      }
    }
  }, [generatedText, format, width])

  // ── Actions: Download PNG (Synchronous & Zero Failure) ───────────────────────
  const downloadImage = () => {
    if (!generatedText) return
    try {
      let canvas: HTMLCanvasElement | null = null
      if (format === 'qrcode') {
        canvas = qrWrapRef.current?.querySelector('canvas') || null
      } else {
        canvas = barcodeCanvasRef.current
      }

      if (!canvas) {
        showToast('ไม่พบรูปภาพสำหรับดาวน์โหลด', 'error')
        return
      }

      const dataUrl = canvas.toDataURL('image/png')
      const sanitizedName = generatedText.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 20) || 'code'
      const filename = `${format === 'qrcode' ? 'qr' : 'barcode'}_${sanitizedName}.png`

      const link = document.createElement('a')
      link.download = filename
      link.href = dataUrl
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      showToast('ดาวน์โหลดรูปภาพสำเร็จ', 'success')
    } catch (err) {
      console.error('Download error:', err)
      showToast('ไม่สามารถดาวน์โหลดรูปได้', 'error')
    }
  }

  // ── Actions: Copy to Clipboard ───────────────────────────────────────────────
  const copyImageToClipboard = async () => {
    if (!generatedText) return
    setCopyingImage(true)
    try {
      let canvas: HTMLCanvasElement | null = null
      if (format === 'qrcode') {
        canvas = qrWrapRef.current?.querySelector('canvas') || null
      } else {
        canvas = barcodeCanvasRef.current
      }

      if (!canvas) {
        throw new Error('ไม่พบรูปภาพ')
      }

      // Try modern Clipboard API (image/png)
      if (navigator.clipboard && typeof window.ClipboardItem !== 'undefined') {
        const blob = await new Promise<Blob | null>((resolve) => canvas!.toBlob(resolve, 'image/png'))
        if (blob) {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
          setCopiedSuccess(true)
          setTimeout(() => setCopiedSuccess(false), 2000)
          showToast(format === 'qrcode' ? 'คัดลอกรูปภาพ QR Code แล้ว' : 'คัดลอกรูปภาพบาร์โค้ดแล้ว', 'success')
          return
        }
      }

      // Fallback to text copy if image clipboard is unsupported
      await navigator.clipboard.writeText(generatedText)
      setCopiedSuccess(true)
      setTimeout(() => setCopiedSuccess(false), 2000)
      showToast('คัดลอกข้อความลงคลิปบอร์ดแล้ว', 'info')
    } catch (err: any) {
      console.warn('Copy image error, fallback to text:', err)
      try {
        await navigator.clipboard.writeText(generatedText)
        setCopiedSuccess(true)
        setTimeout(() => setCopiedSuccess(false), 2000)
        showToast('คัดลอกข้อความแล้ว (เบราว์เซอร์ไม่รองรับคัดลอกรูป)', 'info')
      } catch {
        showToast('ไม่สามารถคัดลอกได้', 'error')
      }
    } finally {
      setCopyingImage(false)
    }
  }

  // ── Actions: Print Code ──────────────────────────────────────────────────────
  const printCode = () => {
    if (!generatedText) return
    setPrinting(true)
    try {
      let canvas: HTMLCanvasElement | null = null
      if (format === 'qrcode') {
        canvas = qrWrapRef.current?.querySelector('canvas') || null
      } else {
        canvas = barcodeCanvasRef.current
      }

      if (!canvas) {
        showToast('ไม่พบรูปภาพสำหรับสั่งพิมพ์', 'error')
        return
      }

      const dataUrl = canvas.toDataURL('image/png')
      const printWindow = window.open('', '_blank')
      if (!printWindow) {
        showToast('กรุณาอนุญาตป๊อปอัปเพื่อเปิดหน้าต่างสั่งพิมพ์', 'warning')
        return
      }

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>พิมพ์ ${format === 'qrcode' ? 'QR Code' : 'Barcode'} - ART Workspace</title>
            <meta charset="utf-8" />
            <style>
              @page { size: auto; margin: 15mm; }
              body {
                margin: 0;
                padding: 20px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                background: #fff;
              }
              .card {
                display: flex;
                flex-direction: column;
                align-items: center;
                padding: 16px;
                border: 1px solid #e2e8f0;
                border-radius: 12px;
                max-width: 400px;
              }
              img {
                max-width: 100%;
                height: auto;
              }
              .label {
                margin-top: 10px;
                font-size: 14px;
                font-weight: 600;
                color: #0f172a;
                word-break: break-all;
                text-align: center;
              }
            </style>
          </head>
          <body>
            <div class="card">
              <img src="${dataUrl}" onload="window.print(); setTimeout(() => window.close(), 800);" />
              <div class="label">${generatedText}</div>
            </div>
          </body>
        </html>
      `)
      printWindow.document.close()
    } catch (err) {
      console.error('Print error:', err)
      showToast('ไม่สามารถสั่งพิมพ์ได้', 'error')
    } finally {
      setPrinting(false)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <section
      className="flex h-full flex-col justify-between rounded-2xl bg-white p-4 sm:p-5 ring-1 ring-black/[0.06] shadow-sm transition-all duration-200"
      aria-labelledby="qr-title"
    >
      <div>
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Icon badge */}
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[#1d1d1f]">
              {format === 'qrcode' ? (
                <QrCode size={18} className="text-white" aria-hidden="true" />
              ) : (
                <Barcode size={18} className="text-white" aria-hidden="true" />
              )}
            </div>
            <div>
              <h2 id="qr-title" className="text-[15px] font-bold tracking-tight text-[#1d1d1f]">
                {format === 'qrcode' ? 'สร้าง QR Code' : 'สร้างบาร์โค้ด Code 128'}
              </h2>
              <p className="mt-0.5 text-[11px] text-[#475569]">
                {format === 'qrcode' ? 'แปลงข้อความ หรือ URL เป็น QR Code' : 'แปลงรหัสสินค้า/ตัวเลข เป็นบาร์โค้ดมาตรฐาน'}
              </p>
            </div>
          </div>

          {onResize && (
            <WidgetSizeToggle value={width} onChange={onResize} sizes={[1, 2, 3]} />
          )}
        </div>

        {/* ── Format toggle pills ─────────────────────────────────────── */}
        <div
          className="mt-4 flex gap-1.5 rounded-full bg-[#f5f5f7] p-1 ring-1 ring-black/[0.04]"
          role="group"
          aria-label="เลือกรูปแบบโค้ด"
        >
          {formatOptions.map(({ value: val, label, icon: Icon }) => {
            const isActive = format === val
            return (
              <button
                key={val}
                type="button"
                onClick={() => {
                  setFormat(val)
                  setError(null)
                }}
                aria-pressed={isActive}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3] ${
                  isActive
                    ? 'bg-white text-[#1d1d1f] shadow-sm ring-1 ring-black/[0.06]'
                    : 'text-[#475569] hover:text-[#1d1d1f]'
                }`}
              >
                <Icon size={14} aria-hidden="true" />
                <span>{label}</span>
              </button>
            )
          })}
        </div>

        {/* ── Text input ───────────────────────────────────────────────── */}
        <div className="mt-3">
          <input
            type="text"
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              setError(null)
            }}
            placeholder={
              format === 'qrcode'
                ? 'พิมพ์ข้อความ, URL, เบอร์โทร หรือ PromptPay...'
                : 'พิมพ์รหัส เช่น ART-10023, 12345678 (ภาษาอังกฤษ/ตัวเลข)...'
            }
            className="w-full rounded-xl bg-[#f8fafc] px-3.5 py-2.5 text-sm text-[#1d1d1f] placeholder:text-slate-400 ring-1 ring-slate-200/80 transition-all duration-150 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0071e3]"
            aria-label="ข้อความสำหรับสร้างโค้ด"
          />
        </div>

        {/* ── Error Banner ─────────────────────────────────────────────── */}
        {error && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 ring-1 ring-amber-200">
            <AlertCircle size={14} className="shrink-0 text-amber-600" />
            <span>{error}</span>
          </div>
        )}

        {/* ── Preview Card & Actions ───────────────────────────────────── */}
        <div className="mt-4 flex flex-col items-center">
          {generatedText && !error ? (
            <div className="flex w-full flex-col items-center gap-3.5 animate-in fade-in duration-200">
              {/* Render Canvas Wrapper */}
              <div className="flex w-full items-center justify-center overflow-hidden rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200/60 shadow-2xs">
                {format === 'qrcode' ? (
                  <div ref={qrWrapRef} className="rounded-xl bg-white p-2.5 shadow-sm ring-1 ring-black/[0.05]">
                    <QRCodeCanvas
                      value={generatedText}
                      size={width >= 3 ? 200 : width >= 2 ? 170 : 145}
                      fgColor="#0f172a"
                      bgColor="#ffffff"
                      level="M"
                      includeMargin={false}
                    />
                  </div>
                ) : (
                  <div className="flex w-full items-center justify-center overflow-x-auto rounded-xl bg-white p-2.5 shadow-sm ring-1 ring-black/[0.05]">
                    <canvas ref={barcodeCanvasRef} className="max-w-full" />
                  </div>
                )}
              </div>

              {/* Action Buttons: Copy / Download / Print */}
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={copyImageToClipboard}
                  disabled={copyingImage}
                  className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-800 transition-all duration-150 hover:bg-white hover:shadow-sm ring-1 ring-slate-200 active:scale-[0.98] disabled:opacity-50"
                  aria-label="คัดลอกรูปภาพลงคลิปบอร์ด"
                >
                  {copiedSuccess ? (
                    <>
                      <Check size={14} className="text-emerald-600" />
                      <span className="text-emerald-700">คัดลอกแล้ว!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={13} />
                      <span>{copyingImage ? 'กำลังคัดลอก...' : 'คัดลอกรูป'}</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={downloadImage}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#0071e3] px-4 py-2 text-xs font-semibold text-white transition-all duration-150 hover:bg-[#0077ed] hover:shadow-[0_2px_8px_rgba(0,113,227,0.3)] active:scale-[0.98]"
                  aria-label="ดาวน์โหลดรูปภาพ PNG"
                >
                  <Download size={13} />
                  <span>ดาวน์โหลด PNG</span>
                </button>

                <button
                  type="button"
                  onClick={printCode}
                  disabled={printing}
                  className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-800 transition-all duration-150 hover:bg-white hover:shadow-sm ring-1 ring-slate-200 active:scale-[0.98] disabled:opacity-50"
                  aria-label="พิมพ์โค้ด"
                >
                  <Printer size={13} />
                  <span>{printing ? 'กำลังเตรียม...' : 'สั่งพิมพ์'}</span>
                </button>
              </div>
            </div>
          ) : !generatedText ? (
            /* Empty state */
            <div className="flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                {format === 'qrcode' ? <QrCode size={28} /> : <Barcode size={28} />}
              </div>
              <p className="text-sm font-semibold text-slate-800">
                {format === 'qrcode' ? 'ยังไม่ได้ระบุข้อความ QR Code' : 'ยังไม่ได้ระบุรหัสบาร์โค้ด'}
              </p>
              <p className="max-w-[220px] text-xs text-slate-500">
                พิมพ์ข้อความหรือรหัสสินค้าในช่องด้านบนเพื่อสร้างภาพ
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}
