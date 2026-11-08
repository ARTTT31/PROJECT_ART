import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSun,
  ShieldAlert,
  ShieldCheck,
  Sun,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

export interface CityLocation {
  id: string;
  name: string;
  lat: number;
  lon: number;
  isGps?: boolean;
}

export const CITY_PRESETS: CityLocation[] = [
  { id: 'bkk', name: 'กรุงเทพมหานคร', lat: 13.7563, lon: 100.5018 },
  { id: 'cnx', name: 'เชียงใหม่', lat: 18.7883, lon: 98.9853 },
  { id: 'pty', name: 'ชลบุรี / พัทยา', lat: 12.9236, lon: 100.8825 },
  { id: 'ryg', name: 'ระยอง', lat: 12.6815, lon: 101.2816 },
  { id: 'hkt', name: 'ภูเก็ต', lat: 7.8804, lon: 98.3923 },
  { id: 'kkn', name: 'ขอนแก่น', lat: 16.4419, lon: 102.8359 },
  { id: 'nbr', name: 'นนทบุรี', lat: 13.8621, lon: 100.5144 },
  { id: 'spk', name: 'สมุทรปราการ', lat: 13.5991, lon: 100.5968 },
];

export interface HourlyForecastItem {
  time: string;
  rawTime: string;
  weatherCode: number;
  temp: number;
  rainProb: number;
  isCurrent?: boolean;
}

export interface WeatherData {
  currentTemp: number;
  apparentTemp: number;
  humidity: number;
  windSpeed: number;
  weatherCode: number;
  tempMax: number;
  tempMin: number;
  rainProb: number;
  hourlyForecast: HourlyForecastItem[];
}

export interface AirQualityData {
  pm25: number;
  pm10: number;
  usAqi: number;
}

export interface CombinedWeatherCache {
  savedAt: number;
  cityId: string;
  cityName: string;
  lat: number;
  lon: number;
  weather: WeatherData;
  airQuality: AirQualityData;
}

// ── Cache helpers ────────────────────────────────────────────────────────────

export const CACHE_KEY = 'artWeatherCacheV7';
export const LOCATION_KEY = 'artWeatherLocationV7';
export const CACHE_TTL_MS = 20 * 60_000; // 20 minutes

export function safeJsonParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

// ── Weather Code Interpreter (WMO standard) ───────────────────────────────────

export function getWeatherMeta(code: number) {
  switch (code) {
    case 0:
      return {
        label: 'ท้องฟ้าแจ่มใส',
        icon: Sun,
        colorClass: 'text-amber-500',
        bgClass: 'bg-amber-50',
      };
    case 1:
    case 2:
      return {
        label: 'มีเมฆบางส่วน',
        icon: CloudSun,
        colorClass: 'text-sky-500',
        bgClass: 'bg-sky-50',
      };
    case 3:
      return {
        label: 'มีเมฆมาก',
        icon: Cloud,
        colorClass: 'text-slate-500',
        bgClass: 'bg-slate-100',
      };
    case 45:
    case 48:
      return {
        label: 'หมอกลง',
        icon: CloudFog,
        colorClass: 'text-slate-500',
        bgClass: 'bg-slate-100',
      };
    case 51:
    case 53:
    case 55:
      return {
        label: 'ฝนปรอยๆ',
        icon: CloudDrizzle,
        colorClass: 'text-blue-500',
        bgClass: 'bg-blue-50',
      };
    case 61:
    case 63:
    case 65:
      return { label: 'ฝนตก', icon: CloudRain, colorClass: 'text-blue-600', bgClass: 'bg-blue-50' };
    case 80:
    case 81:
    case 82:
      return {
        label: 'ฝนตกหนัก',
        icon: CloudRain,
        colorClass: 'text-indigo-600',
        bgClass: 'bg-indigo-50',
      };
    case 95:
    case 96:
    case 99:
      return {
        label: 'ฝนฟ้าคะนอง',
        icon: CloudLightning,
        colorClass: 'text-purple-600',
        bgClass: 'bg-purple-50',
      };
    default:
      return {
        label: 'สภาพอากาศทั่วไป',
        icon: CloudSun,
        colorClass: 'text-sky-500',
        bgClass: 'bg-sky-50',
      };
  }
}

// ── PM 2.5 Evaluation (Thailand & US AQI Standards) ──────────────────────────

export function getPM25Meta(pm25: number) {
  if (pm25 <= 15) {
    return {
      level: 'ดีมาก',
      healthTip: 'อากาศบริสุทธิ์ เหมาะกับกิจกรรมกลางแจ้งทุกชนิด',
      badgeClass: 'bg-emerald-50 text-emerald-700 ring-emerald-200/80',
      dotClass: 'bg-emerald-500',
      icon: ShieldCheck,
    };
  }
  if (pm25 <= 25) {
    return {
      level: 'ดี',
      healthTip: 'คุณภาพอากาศดี ทำกิจกรรมกลางแจ้งได้ตามปกติ',
      badgeClass: 'bg-sky-50 text-sky-700 ring-sky-200/80',
      dotClass: 'bg-sky-500',
      icon: ShieldCheck,
    };
  }
  if (pm25 <= 37.5) {
    return {
      level: 'ปานกลาง',
      healthTip: 'กลุ่มเสี่ยงควรสังเกตอาการผิดปกติและเลี่ยงกิจกรรมหนัก',
      badgeClass: 'bg-amber-50 text-amber-700 ring-amber-200/80',
      dotClass: 'bg-amber-500',
      icon: ShieldAlert,
    };
  }
  if (pm25 <= 75) {
    return {
      level: 'เริ่มมีผลกระทบ',
      healthTip: 'ควรสวมหน้ากากป้องกันฝุ่นเมื่อออกกลางแจ้ง',
      badgeClass: 'bg-orange-50 text-orange-700 ring-orange-200/80',
      dotClass: 'bg-orange-500',
      icon: ShieldAlert,
    };
  }
  return {
    level: 'มีผลกระทบต่อสุขภาพ',
    healthTip: 'งดกิจกรรมกลางแจ้งทุกชนิด ใช้อุปกรณ์ฟอกอากาศในอาคาร',
    badgeClass: 'bg-rose-50 text-rose-700 ring-rose-200/80',
    dotClass: 'bg-rose-500',
    icon: ShieldAlert,
  };
}
