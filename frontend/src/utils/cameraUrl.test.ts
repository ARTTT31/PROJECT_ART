import { describe, expect, it } from 'vitest';
import { sanitizeCameraStreams, stripCameraCredentials } from './cameraUrl';

describe('stripCameraCredentials', () => {
  it('removes stored credentials from http camera URLs', () => {
    expect(stripCameraCredentials('https://admin:attack@cam.local/stream.jpg')).toBe(
      'https://cam.local/stream.jpg',
    );
  });

  it('removes user-only userinfo', () => {
    expect(stripCameraCredentials('http://viewer@cam.local/v1/mjpeg')).toBe(
      'http://cam.local/v1/mjpeg',
    );
  });

  it('leaves credential-free URLs untouched', () => {
    expect(stripCameraCredentials('https://cam.local/snap.jpg?token=short')).toBe(
      'https://cam.local/snap.jpg?token=short',
    );
  });

  it('handles schemes the URL parser rejects via the regex fallback', () => {
    expect(stripCameraCredentials('rtsp://admin:password@192.168.1.10/ch1')).toBe(
      'rtsp://192.168.1.10/ch1',
    );
  });
});

describe('sanitizeCameraStreams', () => {
  it('migrates the removed iframe type to simulated', () => {
    const [out] = sanitizeCameraStreams([
      { id: '1', name: 'Legacy', streamType: 'iframe', url: 'https://nvr.local/ui' },
    ]);
    expect(out.streamType).toBe('simulated');
    expect(out.url).toBeNull();
  });

  it('strips credentials from every stored URL', () => {
    const [out] = sanitizeCameraStreams([
      {
        id: '2',
        name: 'Backyard',
        streamType: 'snapshot',
        url: 'https://root:secret@cam.local/img',
      },
    ]);
    expect(out.url).toBe('https://cam.local/img');
  });
});
