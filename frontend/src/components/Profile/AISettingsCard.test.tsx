import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AISettingsCard from './AISettingsCard';
import * as fetchWithAuthModule from '@/lib/api/fetchWithAuth';

vi.mock('@/utils/sweetalert', () => ({
  showSuccess: vi.fn(),
  showError: vi.fn(),
  showConfirm: vi.fn().mockResolvedValue({ isConfirmed: true }),
}));

const connected = {
  result: 'success',
  data: {
    provider: 'gemini',
    has_key: true,
    base_url: '',
    model: 'gemini-3.5-flash',
    source: 'user',
  },
};

const notConfigured = {
  result: 'success',
  data: { provider: 'gemini', has_key: false, base_url: '', model: '', source: 'none' },
};

describe('AISettingsCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the connected provider and model', async () => {
    vi.spyOn(fetchWithAuthModule, 'fetchWithAuth').mockResolvedValueOnce({
      ok: true,
      json: async () => connected,
    } as Response);

    render(<AISettingsCard />);

    await waitFor(() => {
      expect(screen.getByText('เชื่อมต่อด้วยคีย์ของคุณ')).toBeInTheDocument();
      expect(screen.getByText(/Gemini · gemini-3.5-flash/)).toBeInTheDocument();
    });
  });

  it('saves a typed key and then keeps it when the field is left empty', async () => {
    const fetchMock = vi
      .spyOn(fetchWithAuthModule, 'fetchWithAuth')
      .mockResolvedValueOnce({ ok: true, json: async () => notConfigured } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => connected } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => connected } as Response);

    render(<AISettingsCard />);

    const keyInput = await screen.findByLabelText('API Key');
    fireEvent.change(keyInput, { target: { value: 'gemini-personal-key' } });
    fireEvent.click(screen.getByRole('button', { name: /บันทึกการเชื่อมต่อ/ }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const [, init] = fetchMock.mock.calls[1];
    expect(init?.method).toBe('PUT');
    expect(JSON.parse(String(init?.body))).toMatchObject({
      provider: 'gemini',
      api_key: 'gemini-personal-key',
    });

    // After the save the key field is cleared; saving again must not blank the
    // stored key on the server.
    fireEvent.click(screen.getByRole('button', { name: /บันทึกการเชื่อมต่อ/ }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    const [, secondInit] = fetchMock.mock.calls[2];
    expect(JSON.parse(String(secondInit?.body)).api_key).toBeNull();
  });

  it('keeps the test button disabled until a key is saved', async () => {
    vi.spyOn(fetchWithAuthModule, 'fetchWithAuth').mockResolvedValueOnce({
      ok: true,
      json: async () => notConfigured,
    } as Response);

    render(<AISettingsCard />);

    await screen.findByLabelText('API Key');
    expect(screen.getByRole('button', { name: /ทดสอบการเชื่อมต่อ/ })).toBeDisabled();
  });
});
