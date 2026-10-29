import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, type Mock } from 'vitest';
import WatchlistWidget from './WatchlistWidget';

// Mock the fetchWithAuth module
const mockFetchWithAuth = vi.fn();
vi.mock('@/lib/api/fetchWithAuth', () => ({
  fetchWithAuth: (...args: Parameters<typeof mockFetchWithAuth>) => mockFetchWithAuth(...args),
}));

// Import after mocking
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';

describe('WatchlistWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockSymbols = [
    { symbol: 'PTT.BK', label: 'PTT Public Company' },
    { symbol: 'AAPL', label: 'Apple Inc.' },
    { symbol: 'BTC-USD', label: 'Bitcoin' },
  ];

  const mockQuotes = {
    'PTT.BK': { symbol: 'PTT.BK', price: 35.50, change: 0.85, change_percent: 2.47, currency: 'THB', name: 'PTT Public Company' },
    'AAPL': { symbol: 'AAPL', price: 178.32, change: -1.24, change_percent: -0.69, currency: 'USD', name: 'Apple Inc.' },
    'BTC-USD': { symbol: 'BTC-USD', price: 42150.00, change: 1250.00, change_percent: 3.06, currency: 'USD', name: 'Bitcoin' },
  };

  it('renders loading state initially', () => {
    mockFetchWithAuth.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ symbols: [] }),
    } as Response);

    render(<WatchlistWidget />);

    expect(screen.getByRole('status', { name: /กำลังโหลดรายการติดตาม/i })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /กำลังโหลด/i })).toBeInTheDocument();
  });

  it('displays error when load fails', async () => {
    mockFetchWithAuth.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: async () => ({ message: 'Not found' }),
    } as Response);

    render(<WatchlistWidget />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('โหลดรายการติดตามไม่สำเร็จ');
    });
  });

  it('displays watchlist items when loaded successfully', async () => {
    // First call: load watchlist
    mockFetchWithAuth.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ symbols: mockSymbols }),
    } as Response);

    // Second call: fetch quotes for the symbols
    mockFetchWithAuth.mockResolvedValueOnce({
      ok: true,
      json: async () => Object.values(mockQuotes),
    } as Response);

    render(<WatchlistWidget />);

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByRole('status', { name: /กำลังโหลด/i })).not.toBeInTheDocument();
    });

    // Check title
    expect(screen.getByText('รายการติดตาม')).toBeInTheDocument();

    // Check summary text
    expect(screen.getByText('3 สัญลักษณ์ · เพิ่มขึ้น 2')).toBeInTheDocument();

    // Check each symbol is displayed
    mockSymbols.forEach(({ symbol, label }) => {
      expect(screen.getByText(symbol)).toBeInTheDocument();
      expect(screen.getByText(label)).toBeInTheDocument();
    });

    // Check prices
    expect(screen.getByText('35.50')).toBeInTheDocument();
    expect(screen.getByText('178.32')).toBeInTheDocument();
  });

  it('shows empty state when no symbols', async () => {
    mockFetchWithAuth.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ symbols: [] }),
    } as Response);

    render(<WatchlistWidget />);

    await waitFor(() => {
      expect(screen.queryByRole('status', { name: /กำลังโหลด/i })).not.toBeInTheDocument();
    });

    expect(screen.getByText('ยังไม่มีรายการติดตาม')).toBeInTheDocument();
    expect(screen.getByText('ลองพิมพ์ PTT.BK, AAPL หรือ BTC-USD')).toBeInTheDocument();
  });

  it('adds a new symbol when form submitted', async () => {
    // Initial load
    mockFetchWithAuth.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ symbols: [] }),
    } as Response);

    render(<WatchlistWidget />);

    // Wait for initial load
    await waitFor(() => {
      expect(screen.queryByRole('status', { name: /กำลังโหลด/i })).not.toBeInTheDocument();
    });

    // Setup: mock PUT response for saving
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: async () => ({ symbols: [{ symbol: 'AAPL' }] }),
    } as Response);

    // Setup: mock quote fetch for new symbol
    mockFetchWithAuth.mockResolvedValueOnce({
      ok: true,
      json: async () => [mockQuotes['AAPL']],
    } as Response);

    // Find and fill the input
    const input = screen.getByLabelText(/เพิ่มสัญลักษณ์ในรายการติดตาม/i);
    await userEvent.type(input, 'AAPL');

    // Click add button
    const addButton = screen.getByRole('button', { name: /เพิ่มสัญลักษณ์/i });
    await userEvent.click(addButton);

    // Should call PUT to save
    await waitFor(() => {
      expect(mockFetchWithAuth).toHaveBeenCalledWith(
        '/api/v1/profile/watchlist',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ symbols: [{ symbol: 'AAPL' }] }),
        })
      );
    });

    // Should show the new symbol
    await waitFor(() => {
      expect(screen.getByText('AAPL')).toBeInTheDocument();
    });
  });

  it('validates symbol format on add', async () => {
    mockFetchWithAuth.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ symbols: [] }),
    } as Response);

    render(<WatchlistWidget />);

    await waitFor(() => {
      expect(screen.queryByRole('status', { name: /กำลังโหลด/i })).not.toBeInTheDocument();
    });

    const input = screen.getByLabelText(/เพิ่มสัญลักษณ์ในรายการติดตาม/i);
    await userEvent.type(input, 'invalid-symbol!@#');

    const addButton = screen.getByRole('button', { name: /เพิ่มสัญลักษณ์/i });
    await userEvent.click(addButton);

    expect(screen.getByRole('alert')).toHaveTextContent('ชื่อย่อต้องเป็นตัวอักษรหรือตัวเลข');
  });

  it('shows error when adding duplicate symbol', async () => {
    mockFetchWithAuth.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ symbols: [{ symbol: 'AAPL' }] }),
    } as Response);

    mockFetchWithAuth.mockResolvedValueOnce({
      ok: true,
      json: async () => [mockQuotes['AAPL']],
    } as Response);

    render(<WatchlistWidget />);

    await waitFor(() => {
      expect(screen.queryByRole('status', { name: /กำลังโหลด/i })).not.toBeInTheDocument();
    });

    const input = screen.getByLabelText(/เพิ่มสัญลักษณ์ในรายการติดตาม/i);
    await userEvent.type(input, 'AAPL');

    const addButton = screen.getByRole('button', { name: /เพิ่มสัญลักษณ์/i });
    await userEvent.click(addButton);

    expect(screen.getByRole('alert')).toHaveTextContent('มีรายการนี้อยู่แล้ว');
  });

  it('removes a symbol when trash button clicked', async () => {
    mockFetchWithAuth.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ symbols: [{ symbol: 'AAPL' }] }),
    } as Response);

    mockFetchWithAuth.mockResolvedValueOnce({
      ok: true,
      json: async () => [mockQuotes['AAPL']],
    } as Response);

    render(<WatchlistWidget />);

    await waitFor(() => {
      expect(screen.queryByRole('status', { name: /กำลังโหลด/i })).not.toBeInTheDocument();
    });

    // Reset mock to track the remove call
    mockFetchWithAuth.mockClear();
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: async () => ({ symbols: [] }),
    } as Response);

    // Find and click trash button
    const trashButton = screen.getAllByRole('button', { name: /เลิกติดตาม/i })[0];
    await userEvent.click(trashButton);

    // Should call PUT to save without the removed symbol
    await waitFor(() => {
      expect(mockFetchWithAuth).toHaveBeenCalledWith(
        '/api/v1/profile/watchlist',
        expect.objectContaining({
          method: 'PUT',
        })
      );
    });

    // Should show empty state after removal
    await waitFor(() => {
      expect(screen.getByText('ยังไม่มีรายการติดตาม')).toBeInTheDocument();
    });
  });

  it('shows refresh indicator when quotes are being refreshed', async () => {
    mockFetchWithAuth.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ symbols: mockSymbols }),
    } as Response);

    mockFetchWithAuth.mockResolvedValueOnce({
      ok: true,
      json: async () => Object.values(mockQuotes),
    } as Response);

    render(<WatchlistWidget />);

    await waitFor(() => {
      expect(screen.queryByRole('status', { name: /กำลังโหลด/i })).not.toBeInTheDocument();
    });

    // Click refresh button
    const refreshButton = screen.getByRole('button', { name: /รีเฟรชราคา/i });
    await userEvent.click(refreshButton);

    // Should show loading indicator
    expect(screen.getByRole('img', { name: /กำลังโหลด/i })).toBeInTheDocument();
  });

  it('respects maximum symbol limit', async () => {
    // Create a list with MAX_SYMBOLS (12) symbols
    const maxSymbols = Array.from({ length: 12 }, (_, i) => ({
      symbol: `SYM${i + 1}`,
      label: `Symbol ${i + 1}`,
    }));

    mockFetchWithAuth.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ symbols: maxSymbols }),
    } as Response);

    mockFetchWithAuth.mockResolvedValueOnce({
      ok: true,
      json: async () => maxSymbols.map((s) => ({ symbol: s.symbol, price: 100 })),
    } as Response);

    render(<WatchlistWidget />);

    await waitFor(() => {
      expect(screen.queryByRole('status', { name: /กำลังโหลด/i })).not.toBeInTheDocument();
    });

    const input = screen.getByLabelText(/เพิ่มสัญลักษณ์ในรายการติดตาม/i);
    await userEvent.type(input, 'EXTRA');

    const addButton = screen.getByRole('button', { name: /เพิ่มสัญลักษณ์/i });
    await userEvent.click(addButton);

    expect(screen.getByRole('alert')).toHaveTextContent('ติดตามได้สูงสุด 12 รายการ');
  });
});
