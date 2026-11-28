import { afterEach, describe, expect, it, vi } from 'vitest';
import { CCTV_STREAMS_ENV, configuredCctvStreams, parseCctvStreams } from './cctvStreams';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('parseCctvStreams', () => {
  it('maps valid MediaMTX manifests to HLS cameras', () => {
    const streams = parseCctvStreams(
      JSON.stringify([
        {
          id: 'front',
          name: 'หน้าบ้าน',
          location: 'ประตูหลัก',
          url: 'https://mediamtx.onrender.com/front/index.m3u8',
          fps: 25,
          resolution: '1920x1080',
        },
      ]),
    );

    expect(streams).toEqual([
      {
        id: 'front',
        name: 'หน้าบ้าน',
        location: 'ประตูหลัก',
        url: 'https://mediamtx.onrender.com/front/index.m3u8',
        streamType: 'hls',
        status: 'online',
        fps: 25,
        resolution: '1920x1080',
      },
    ]);
  });

  it('strips credentials and skips entries without a usable HTTP URL', () => {
    const streams = parseCctvStreams(
      JSON.stringify([
        { id: 'safe', url: 'https://user:pass@mediamtx.onrender.com/safe/index.m3u8' },
        { id: 'missing-url' },
        { id: 'bad-scheme', url: 'rtsp://mediamtx.local/camera' },
      ]),
    );

    expect(streams).toHaveLength(1);
    expect(streams[0].url).toBe('https://mediamtx.onrender.com/safe/index.m3u8');
    expect(streams[0].name).toBe('Camera 1');
  });

  it('keeps ids unique when the config repeats one', () => {
    const streams = parseCctvStreams(
      JSON.stringify([
        { id: 'same', url: 'https://example.com/a/index.m3u8' },
        { id: 'same', url: 'https://example.com/b/index.m3u8' },
      ]),
    );

    expect(streams.map((stream) => stream.id)).toEqual(['same', 'same-2']);
  });

  it('returns an empty list for malformed JSON or a non-array payload', () => {
    expect(parseCctvStreams('not json')).toEqual([]);
    expect(parseCctvStreams('{"url":"https://example.com/index.m3u8"}')).toEqual([]);
    expect(parseCctvStreams(undefined)).toEqual([]);
  });
});

describe('configuredCctvStreams', () => {
  it('reads the public environment variable', () => {
    vi.stubEnv(
      CCTV_STREAMS_ENV,
      JSON.stringify([{ id: 'env-cam', url: 'https://example.com/env/index.m3u8' }]),
    );

    expect(configuredCctvStreams()).toMatchObject([
      { id: 'env-cam', streamType: 'hls', url: 'https://example.com/env/index.m3u8' },
    ]);
  });
});
