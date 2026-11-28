import type { CameraStreamConfig } from '@/types';
import { stripCameraCredentials } from '@/utils/cameraUrl';

/**
 * Deployment-managed CCTV sources.
 *
 * The page keeps per-account camera settings in `user.camera_config`; this
 * module is the *initial* source for a workspace that has no saved layout yet.
 * Keeping the URL out of the component means the same build can point at a
 * development or production MediaMTX instance.
 *
 * `NEXT_PUBLIC_CCTV_STREAMS` is a JSON array:
 *
 * [
 *   {
 *     "id": "front-door",
 *     "name": "หน้าบ้าน",
 *     "location": "ประตูหลัก",
 *     "url": "https://mediamtx.onrender.com/front-door/index.m3u8",
 *     "fps": 25,
 *     "resolution": "1920x1080"
 *   }
 * ]
 */
export const CCTV_STREAMS_ENV = 'NEXT_PUBLIC_CCTV_STREAMS';

type StreamRecord = Record<string, unknown>;

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function numberValue(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return undefined;
}

function validHlsUrl(raw: string): string | null {
  const cleaned = stripCameraCredentials(raw);
  try {
    const parsed = new URL(cleaned);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Parse the public env value without letting one malformed entry take down the
 * whole page. Invalid JSON and entries without a usable HTTP(S) URL are skipped.
 */
export function parseCctvStreams(raw: string | null | undefined): CameraStreamConfig[] {
  if (!raw?.trim()) return [];

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    console.warn('[CCTV] NEXT_PUBLIC_CCTV_STREAMS is not valid JSON; using defaults.');
    return [];
  }

  if (!Array.isArray(value)) {
    console.warn('[CCTV] NEXT_PUBLIC_CCTV_STREAMS must be a JSON array; using defaults.');
    return [];
  }

  const seen = new Set<string>();
  return value.flatMap((entry, index) => {
    if (!entry || typeof entry !== 'object') return [];
    const record = entry as StreamRecord;
    const rawUrl = stringValue(record.url);
    if (!rawUrl) return [];
    const url = validHlsUrl(rawUrl);
    if (!url) return [];

    const baseId = stringValue(record.id) ?? `cctv-${index + 1}`;
    let id = baseId;
    let suffix = 2;
    while (seen.has(id)) {
      id = `${baseId}-${suffix}`;
      suffix += 1;
    }
    seen.add(id);

    return [
      {
        id,
        name: stringValue(record.name) ?? `Camera ${index + 1}`,
        location: stringValue(record.location) ?? 'CCTV',
        url,
        streamType: 'hls' as const,
        status: 'online' as const,
        fps: numberValue(record.fps),
        resolution: stringValue(record.resolution),
      },
    ];
  });
}

/** The deployment's HLS cameras, or an empty list when none are configured. */
export function configuredCctvStreams(): CameraStreamConfig[] {
  // Keep this a literal member expression: Next.js only inlines
  // `process.env.NEXT_PUBLIC_*` accesses it can see at build time.
  return parseCctvStreams(process.env.NEXT_PUBLIC_CCTV_STREAMS);
}
