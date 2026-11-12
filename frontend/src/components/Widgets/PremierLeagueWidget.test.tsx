import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import PremierLeagueWidget from './PremierLeagueWidget';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';

vi.mock('@/lib/api/fetchWithAuth', () => ({ fetchWithAuth: vi.fn() }));

const mockedFetch = vi.mocked(fetchWithAuth);

const TEAM = {
  id: '1',
  name: 'Brighton',
  full_name: 'Brighton & Hove Albion',
  abbreviation: 'BHA',
  logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/331.png',
  winner: true,
};

const MATCH = {
  id: 'm1',
  kickoff: '2026-11-08T14:00Z',
  status: 'Full Time',
  detail: 'FT',
  clock: "90'+6'",
  state: 'post',
  completed: true,
  home: { ...TEAM, score: 2 },
  away: { ...TEAM, id: '2', name: 'Brentford', winner: false, score: 0 },
  venue: 'American Express Stadium',
  broadcast: 'Peacock',
};

const LIVE_MATCH = {
  ...MATCH,
  id: 'm2',
  state: 'in',
  completed: false,
  status: 'In Progress',
  detail: "67'",
  clock: "67'",
  home: { ...TEAM, name: 'Man Utd', winner: false, score: 1 },
  away: { ...TEAM, id: '3', name: 'Aston Villa', winner: false, score: 1 },
};

const UPCOMING_MATCH = {
  ...MATCH,
  id: 'm3',
  kickoff: '2026-11-21T12:30Z',
  state: 'pre',
  completed: false,
  status: 'Scheduled',
  detail: 'Scheduled',
  clock: "0'",
  home: { ...TEAM, name: 'Man City', score: null },
  away: { ...TEAM, id: '4', name: 'Fulham', score: null },
};

function payload(events: unknown[]) {
  return {
    success: true,
    league: 'English Premier League',
    date: null,
    events,
    is_live: events.some((event) => (event as { state?: string }).state === 'in'),
    fetched_at: '2026-11-08T15:00:00Z',
    is_stale: false,
    source: 'ESPN',
  };
}

beforeEach(() => {
  localStorage.clear();
  mockedFetch.mockReset();
  mockedFetch.mockResolvedValue({
    ok: true,
    json: async () => payload([MATCH]),
  } as unknown as Response);
});

describe('PremierLeagueWidget', () => {
  it('renders team crests from the provider', async () => {
    const { container } = render(<PremierLeagueWidget />);

    await screen.findByText('Brighton');
    const sources = Array.from(container.querySelectorAll('img')).map((img) => img.getAttribute('src'));

    expect(sources).toContain('https://a.espncdn.com/i/teamlogos/soccer/500/331.png');
  });

  it('requests the selected day when the date picker changes', async () => {
    render(<PremierLeagueWidget />);
    await screen.findByText('Brighton');

    fireEvent.change(screen.getByLabelText('เลือกวันที่ดูผลพรีเมียร์ลีก'), {
      target: { value: '2026-11-21' },
    });

    await waitFor(() =>
      expect(mockedFetch).toHaveBeenLastCalledWith(
        '/api/v1/football/premier-league?date=2026-11-21',
        expect.anything(),
      ),
    );
  });

  it('marks an in-progress match as LIVE with its clock', async () => {
    mockedFetch.mockResolvedValue({
      ok: true,
      json: async () => payload([LIVE_MATCH, MATCH, UPCOMING_MATCH]),
    } as unknown as Response);

    render(<PremierLeagueWidget />);

    expect(await screen.findByText('กำลังแข่งขัน')).toBeTruthy();
    expect(screen.getByText(/LIVE 67'/)).toBeTruthy();
    expect(screen.getByText('ผลการแข่งขัน')).toBeTruthy();
    expect(screen.getByText('โปรแกรมถัดไป')).toBeTruthy();
  });
});
