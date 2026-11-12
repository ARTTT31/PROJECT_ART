import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';

import NotificationBell, {
  isCrossOriginSocket,
  resolveNotificationsWsUrl,
} from './NotificationBell';

// The ticket endpoint and the history sync both go through fetchWithAuth; mocking
// it keeps these tests off the network and lets a case decide whether a ticket
// is issued.
const { fetchWithAuthMock } = vi.hoisted(() => ({ fetchWithAuthMock: vi.fn() }));

vi.mock('@/lib/api/fetchWithAuth', () => ({ fetchWithAuth: fetchWithAuthMock }));

// The bell reads the session only to add admin-only alerts; the socket behaviour
// below is the same for every signed-in account, so mount as a plain member.
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 1, role: 'user' }, updateUser: vi.fn() }),
}));

/**
 * The bell is the only live channel in the app: it opens the authenticated
 * WebSocket feed, reconnects with backoff, and gives up when the server says the
 * session is invalid (close code 1008). None of that was covered before — the
 * socket URL was also wrong for the `/api`-rewrite deployment, which is why the
 * origin rules are asserted directly here.
 */

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];

  url: string;
  closed = false;
  onopen: ((event: unknown) => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  close() {
    this.closed = true;
    this.onclose?.({ code: 1000 });
  }

  emitMessage(payload: unknown) {
    this.onmessage?.({ data: JSON.stringify(payload) });
  }

  emitRaw(data: string) {
    this.onmessage?.({ data });
  }

  emitClose(code: number) {
    this.onclose?.({ code });
  }
}

const bellButton = () => screen.getByRole('button', { name: /การแจ้งเตือน/ });

/** Both public env vars default to unset; each test opts into what it needs. */
function stubOrigins(apiUrl = '', wsUrl = '') {
  vi.stubEnv('NEXT_PUBLIC_API_URL', apiUrl);
  vi.stubEnv('NEXT_PUBLIC_WS_URL', wsUrl);
}

beforeEach(() => {
  FakeWebSocket.instances = [];
  vi.stubGlobal('WebSocket', FakeWebSocket);
  stubOrigins();
  fetchWithAuthMock.mockReset();
  fetchWithAuthMock.mockResolvedValue({ ok: true, json: async () => ({}) });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('resolveNotificationsWsUrl', () => {
  it('prefers an explicit WebSocket origin', () => {
    stubOrigins('https://api.example.com', 'wss://rt.example.com/');

    expect(resolveNotificationsWsUrl({ protocol: 'https:', host: 'app.example.com' })).toBe(
      'wss://rt.example.com/api/v1/ws/notifications',
    );
  });

  it('derives the socket origin from the API URL', () => {
    stubOrigins('https://api.example.com/');

    expect(resolveNotificationsWsUrl({ protocol: 'https:', host: 'app.example.com' })).toBe(
      'wss://api.example.com/api/v1/ws/notifications',
    );
  });

  it('only a real origin change counts as cross-origin', () => {
    expect(isCrossOriginSocket('ws://localhost:3000/api/v1/ws/notifications', { host: 'localhost:3000' })).toBe(
      false,
    );
    expect(
      isCrossOriginSocket('wss://api.example.com/api/v1/ws/notifications', {
        host: 'app.example.com',
      }),
    ).toBe(true);
  });

  it('falls back to this origin and upgrades the scheme', () => {
    expect(resolveNotificationsWsUrl({ protocol: 'https:', host: 'art.example.com' })).toBe(
      'wss://art.example.com/api/v1/ws/notifications',
    );
    expect(resolveNotificationsWsUrl({ protocol: 'http:', host: 'localhost:3000' })).toBe(
      'ws://localhost:3000/api/v1/ws/notifications',
    );
  });
});

describe('NotificationBell — live feed', () => {
  it('opens the socket against the resolved origin', async () => {
    stubOrigins('http://localhost:8080');
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: async () => ({ ticket: 'ticket-1' }),
    } as unknown as Response);

    render(<NotificationBell />);
    await act(async () => {});

    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(FakeWebSocket.instances[0].url).toBe(
      'ws://localhost:8080/api/v1/ws/notifications?ticket=ticket-1',
    );
  });

  it('trades the cookie for a ticket before a cross-origin upgrade', async () => {
    // The cookie belongs to the page origin, so the API origin cannot see it on
    // the handshake — that is the deployment bug this covers.
    stubOrigins('https://api.example.com');
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: async () => ({ ticket: 'ticket-9' }),
    } as unknown as Response);

    render(<NotificationBell />);
    await act(async () => {});

    expect(fetchWithAuthMock).toHaveBeenCalledWith('/api/v1/ws/ticket', { method: 'POST' });
    expect(FakeWebSocket.instances[0].url).toBe(
      'wss://api.example.com/api/v1/ws/notifications?ticket=ticket-9',
    );
  });

  it('still opens the socket when no ticket can be issued', async () => {
    stubOrigins('https://api.example.com');
    fetchWithAuthMock.mockResolvedValue({ ok: false, json: async () => ({}) } as unknown as Response);

    render(<NotificationBell />);
    await act(async () => {});

    expect(FakeWebSocket.instances[0].url).toBe('wss://api.example.com/api/v1/ws/notifications');
  });

  it('does not ask for a ticket on a same-origin socket', async () => {
    render(<NotificationBell />);
    await act(async () => {});

    const paths = fetchWithAuthMock.mock.calls.map(([path]) => path);
    expect(paths).not.toContain('/api/v1/ws/ticket');
    expect(FakeWebSocket.instances[0].url).toBe('ws://localhost:3000/api/v1/ws/notifications');
  });

  it('turns a broadcast frame into a visible notification', async () => {
    render(<NotificationBell />);
    const socket = FakeWebSocket.instances[0];

    await act(async () => {
      socket.emitMessage({
        id: 'broadcast-1',
        type: 'system',
        level: 'warning',
        title: 'แจ้งเตือนทดสอบจากเซิร์ฟเวอร์',
        body: 'รายละเอียดการแจ้งเตือน',
      });
    });

    await act(async () => {
      fireEvent.click(bellButton());
    });

    expect(screen.getByText('แจ้งเตือนทดสอบจากเซิร์ฟเวอร์')).toBeTruthy();
    expect(screen.getByText('รายละเอียดการแจ้งเตือน')).toBeTruthy();
  });

  it('ignores a frame that is not JSON instead of throwing', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<NotificationBell />);

    await act(async () => {
      FakeWebSocket.instances[0].emitRaw('not json at all');
    });

    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('stops reconnecting once the server rejects the session with 1008', async () => {
    vi.useFakeTimers();
    render(<NotificationBell />);

    await act(async () => {
      FakeWebSocket.instances[0].emitClose(1008);
    });
    await act(async () => {
      vi.advanceTimersByTime(180_000);
    });

    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  it('backs off and reconnects after an unexpected close', async () => {
    vi.useFakeTimers();
    render(<NotificationBell />);

    await act(async () => {
      FakeWebSocket.instances[0].emitClose(1006);
    });

    await act(async () => {
      vi.advanceTimersByTime(4_999);
    });
    expect(FakeWebSocket.instances).toHaveLength(1);

    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(FakeWebSocket.instances).toHaveLength(2);
  });

  it('closes the socket on unmount without scheduling a reconnect', async () => {
    vi.useFakeTimers();
    const { unmount } = render(<NotificationBell />);
    const socket = FakeWebSocket.instances[0];

    await act(async () => {
      unmount();
    });
    await act(async () => {
      vi.advanceTimersByTime(120_000);
    });

    expect(socket.closed).toBe(true);
    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  it('generates smart alerts for critical PM2.5 and oil price adjustments', async () => {
    localStorage.setItem(
      'artWeatherCacheV7',
      JSON.stringify({
        airQuality: { pm25: 85 },
        weather: { rainProb: 75 },
        cityName: 'กรุงเทพฯ',
      }),
    );

    localStorage.setItem(
      'artOilPriceCacheV1',
      JSON.stringify({
        data: {
          update_date: '2026-10-31',
          prices: [
            { key: 'diesel', name: 'ดีเซล', price: 33.94 },
            { key: 'gasohol_95', name: 'แก๊สโซฮอล์ 95', price: 37.55 },
          ],
        },
      }),
    );

    localStorage.setItem(
      'artOilPricePrevV1',
      JSON.stringify({
        diesel: 32.94,
        gasohol_95: 37.55,
      }),
    );

    render(<NotificationBell />);

    await act(async () => {
      fireEvent.click(bellButton());
    });

    // PM2.5 critical red alert
    expect(screen.getByText(/วิกฤตฝุ่น PM 2.5 ในกรุงเทพฯ ระดับสีแดง/)).toBeTruthy();
    // Rain high alert
    expect(screen.getByText(/โอกาสเกิดฝนตกสูง 75%/)).toBeTruthy();
    // Oil price change alert
    expect(screen.getByText(/แจ้งเตือนการปรับราคาน้ำมัน/)).toBeTruthy();
    expect(screen.getByText(/ดีเซล \+1 บาท/)).toBeTruthy();
  });
});
