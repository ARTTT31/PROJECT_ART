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
  goals: [
    { clock: "45'", team_id: '1', player: 'Danny Welbeck', type: 'goal' },
    { clock: "80'", team_id: '1', player: 'Evan Ferguson', type: 'penalty' },
  ],
  cards: [
    { clock: "72'", team_id: '1', player: 'Lewis Dunk', type: 'yellow' },
  ],
  headline: 'Brighton dominate in home win against Brentford',
  attendance: 31500,
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

  it('anchors to the latest finished matchday and displays past match results', async () => {
    mockedFetch.mockResolvedValue({
      ok: true,
      json: async () => payload([MATCH, UPCOMING_MATCH]),
    } as unknown as Response);

    render(<PremierLeagueWidget />);

    expect(await screen.findByText('ผลการแข่งขัน')).toBeTruthy();
    expect(screen.getByText('โปรแกรมถัดไป')).toBeTruthy();
    // Finished match from 8 Nov should display its full score and date tag
    expect(screen.getByText(/8 พ\.ย\. · FT/)).toBeTruthy();
    expect(screen.getByText('Brighton')).toBeTruthy();
    expect(screen.getByText('Man City')).toBeTruthy();
  });

  it('expands match row on click to reveal goalscorers, cards and attendance', async () => {
    mockedFetch.mockResolvedValue({
      ok: true,
      json: async () => payload([MATCH]),
    } as unknown as Response);

    render(<PremierLeagueWidget />);
    await screen.findByText('Brighton');

    // Goals and cards should initially be hidden
    expect(screen.queryByText('ผู้ทำประตู')).toBeNull();

    // Click on the match row
    fireEvent.click(screen.getByText('Brighton'));

    // Details should now appear
    expect(await screen.findByText('ผู้ทำประตู')).toBeTruthy();
    expect(screen.getByText('Danny Welbeck')).toBeTruthy();
    expect(screen.getByText('Evan Ferguson')).toBeTruthy();
    expect(screen.getByText(/จุดโทษ/)).toBeTruthy();
    expect(screen.getByText('Lewis Dunk')).toBeTruthy();
    expect(screen.getByText(/31,500/)).toBeTruthy();
  });

  it('switches to standings tab and renders table data', async () => {
    mockedFetch.mockImplementation(async (url) => {
      if (typeof url === 'string' && url.includes('/api/v1/football/standings')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            league: 'English Premier League',
            season: 2026,
            standings: [
              {
                rank: 1,
                team: { id: '1', name: 'Arsenal', full_name: 'Arsenal', abbreviation: 'ARS', logo: 'https://example.com/ars.png' },
                played: 11,
                won: 8,
                drawn: 2,
                lost: 1,
                goal_diff: '+15',
                points: 26,
              },
              {
                rank: 2,
                team: { id: '2', name: 'Man City', full_name: 'Manchester City', abbreviation: 'MCI', logo: 'https://example.com/mci.png' },
                played: 11,
                won: 7,
                drawn: 2,
                lost: 2,
                goal_diff: '+12',
                points: 23,
              },
            ],
            fetched_at: '2026-11-08T15:00:00Z',
          }),
        } as unknown as Response;
      }
      return {
        ok: true,
        json: async () => payload([MATCH]),
      } as unknown as Response;
    });

    render(<PremierLeagueWidget />);
    await screen.findByText('Brighton');

    // Switch tab
    fireEvent.click(screen.getByRole('button', { name: 'ตารางคะแนน' }));

    // Verify standings table is fetched and displayed
    expect(await screen.findByText('Arsenal')).toBeTruthy();
    expect(screen.getByText('26')).toBeTruthy();
    expect(screen.getByText('+15')).toBeTruthy();
  });
});
