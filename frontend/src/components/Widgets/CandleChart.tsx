'use client';

import { useMemo } from 'react';

export interface Candle {
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
}

const UP = '#12a150';
const DOWN = '#e5484d';

/** Small quotes (yen is ~0.21 THB) need more decimals than gold at 4,000. */
function formatPrice(value: number) {
  const digits = Math.abs(value) >= 10 ? 2 : 4;
  return value.toLocaleString('th-TH', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

const dayFormat = new Intl.DateTimeFormat('th-TH', {
  day: 'numeric',
  month: 'short',
  timeZone: 'Asia/Bangkok',
});

const timeFormat = new Intl.DateTimeFormat('th-TH', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  timeZone: 'Asia/Bangkok',
});

function labelFor(iso: string, intraday: boolean) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return intraday ? timeFormat.format(date) : dayFormat.format(date);
}

/**
 * Candlestick chart drawn as plain SVG.
 *
 * The widget used to embed TradingView, but that script is blocked on several
 * Thai networks and failed with ERR_CONNECTION_RESET, leaving an empty card. A
 * hand-drawn chart from the OHLC data the backend already proxies has no third
 * party to fail: no iframe, no remote script, no CSP exceptions.
 */
export default function CandleChart({
  points,
  interval,
  label,
}: {
  points: Candle[];
  interval: string;
  label?: string;
}) {
  const intraday = interval === '15m' || interval === '60m';

  const chart = useMemo(() => {
    if (points.length === 0) return null;

    const WIDTH = 640;
    const HEIGHT = 260;
    const PAD_TOP = 12;
    const PAD_BOTTOM = 22;
    const PAD_RIGHT = 58;
    const PAD_LEFT = 4;

    const highs = points.map((point) => point.h);
    const lows = points.map((point) => point.l);
    const rawMax = Math.max(...highs);
    const rawMin = Math.min(...lows);
    // A flat series would collapse to a single line; give it a visible band.
    const span = rawMax - rawMin || Math.max(rawMax * 0.01, 0.01);
    const max = rawMax + span * 0.08;
    const min = rawMin - span * 0.08;

    const plotWidth = WIDTH - PAD_LEFT - PAD_RIGHT;
    const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
    const step = plotWidth / points.length;
    const bodyWidth = Math.max(step * 0.62, 1);

    const y = (price: number) => PAD_TOP + ((max - price) / (max - min)) * plotHeight;

    const candles = points.map((point, index) => {
      const centerX = PAD_LEFT + step * (index + 0.5);
      const openY = y(point.o);
      const closeY = y(point.c);
      const up = point.c >= point.o;
      return {
        key: `${point.t}-${index}`,
        x: centerX - bodyWidth / 2,
        width: bodyWidth,
        top: Math.min(openY, closeY),
        height: Math.max(Math.abs(closeY - openY), 1),
        wickX: centerX,
        wickTop: y(point.h),
        wickBottom: y(point.l),
        color: up ? UP : DOWN,
      };
    });

    // Five gridlines is enough to read a price without cluttering a small card.
    const gridlines = Array.from({ length: 5 }, (_, index) => {
      const price = max - ((max - min) / 4) * index;
      return { price, y: y(price) };
    });

    const last = points[points.length - 1];
    const lastUp = last.c >= last.o;
    const tickIndexes = [...new Set([0, Math.floor(points.length / 2), points.length - 1])];

    return {
      WIDTH,
      HEIGHT,
      PAD_LEFT,
      PAD_RIGHT,
      PAD_BOTTOM,
      plotWidth,
      candles,
      gridlines,
      last,
      lastUp,
      lastY: y(last.c),
      ticks: tickIndexes.map((index) => ({
        index,
        x: PAD_LEFT + step * (index + 0.5),
        text: labelFor(points[index].t, intraday),
      })),
    };
  }, [points, intraday]);

  if (!chart) {
    return (
      <div className="flex h-full items-center justify-center text-[12px] text-[var(--ink-tertiary)]">
        ยังไม่มีข้อมูลกราฟ
      </div>
    );
  }

  const { WIDTH, HEIGHT, PAD_LEFT, PAD_RIGHT, PAD_BOTTOM, candles, gridlines, last, lastUp, lastY, ticks } =
    chart;
  const lineColor = lastUp ? UP : DOWN;

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      className="h-full w-full"
      role="img"
      aria-label={`กราฟแท่งเทียน${label ? ` ${label}` : ''} จำนวน ${points.length} แท่ง`}
    >
      {gridlines.map((line) => (
        <g key={line.price}>
          <line
            x1={PAD_LEFT}
            x2={WIDTH - PAD_RIGHT}
            y1={line.y}
            y2={line.y}
            stroke="#ececf0"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
          <text
            x={WIDTH - PAD_RIGHT + 8}
            y={line.y + 3.5}
            fontSize={10}
            fill="#a1a1a6"
            className="tabular-nums"
          >
            {formatPrice(line.price)}
          </text>
        </g>
      ))}

      {candles.map((candle) => (
        <g key={candle.key}>
          <line
            x1={candle.wickX}
            x2={candle.wickX}
            y1={candle.wickTop}
            y2={candle.wickBottom}
            stroke={candle.color}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
          <rect
            x={candle.x}
            y={candle.top}
            width={candle.width}
            height={candle.height}
            fill={candle.color}
            rx={0.5}
          />
        </g>
      ))}

      {/* Last close: a dashed guide plus the price, so the card answers
          "where is it now" without hovering. */}
      <line
        x1={PAD_LEFT}
        x2={WIDTH - PAD_RIGHT}
        y1={lastY}
        y2={lastY}
        stroke={lineColor}
        strokeWidth={1}
        strokeDasharray="3 3"
        opacity={0.55}
        vectorEffect="non-scaling-stroke"
      />
      <rect
        x={WIDTH - PAD_RIGHT + 2}
        y={lastY - 8}
        width={PAD_RIGHT - 4}
        height={16}
        rx={4}
        fill={lineColor}
      />
      <text
        x={WIDTH - PAD_RIGHT + 6}
        y={lastY + 4}
        fontSize={10}
        fontWeight={700}
        fill="#ffffff"
        className="tabular-nums"
      >
        {formatPrice(last.c)}
      </text>

      {ticks.map((tick) => (
        <text
          key={`${tick.index}-${tick.text}`}
          x={tick.x}
          y={HEIGHT - PAD_BOTTOM + 14}
          fontSize={10}
          fill="#a1a1a6"
          textAnchor={tick.index === 0 ? 'start' : tick.index === points.length - 1 ? 'end' : 'middle'}
        >
          {tick.text}
        </text>
      ))}
    </svg>
  );
}
