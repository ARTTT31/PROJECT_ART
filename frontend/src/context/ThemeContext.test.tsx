import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider, THEME_STORAGE_KEY, useTheme } from './ThemeContext';

function Probe() {
  const { mode, accent, resolvedMode, setMode, setAccent, resetTheme } = useTheme();
  return (
    <div>
      <span data-testid="mode">{mode}</span>
      <span data-testid="accent">{accent}</span>
      <span data-testid="resolved">{resolvedMode}</span>
      <button onClick={() => setMode('dark')}>dark</button>
      <button onClick={() => setAccent('teal')}>teal</button>
      <button onClick={resetTheme}>reset</button>
    </div>
  );
}

function renderProbe() {
  return render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>,
  );
}

describe('ThemeContext', () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
    delete document.documentElement.dataset.accent;
  });

  it('defaults to following the system with the blue accent', () => {
    renderProbe();

    expect(screen.getByTestId('mode')).toHaveTextContent('system');
    expect(screen.getByTestId('accent')).toHaveTextContent('blue');
    expect(screen.getByTestId('resolved')).toHaveTextContent('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.documentElement.dataset.accent).toBe('blue');
  });

  it('switches the painted theme and remembers the choice', () => {
    renderProbe();

    fireEvent.click(screen.getByText('dark'));

    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(JSON.parse(localStorage.getItem(THEME_STORAGE_KEY) || '{}')).toMatchObject({
      mode: 'dark',
      accent: 'blue',
    });
  });

  it('applies an accent preset', () => {
    renderProbe();

    fireEvent.click(screen.getByText('teal'));

    expect(document.documentElement.dataset.accent).toBe('teal');
    expect(JSON.parse(localStorage.getItem(THEME_STORAGE_KEY) || '{}')).toMatchObject({
      accent: 'teal',
    });
  });

  it('restores a saved dark theme on mount', () => {
    localStorage.setItem(
      THEME_STORAGE_KEY,
      JSON.stringify({ mode: 'dark', accent: 'indigo' }),
    );

    renderProbe();

    expect(screen.getByTestId('mode')).toHaveTextContent('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.dataset.accent).toBe('indigo');
  });

  it('falls back to the defaults when the stored value is corrupt', () => {
    localStorage.setItem(THEME_STORAGE_KEY, '{not json');

    renderProbe();

    expect(screen.getByTestId('mode')).toHaveTextContent('system');
    expect(screen.getByTestId('accent')).toHaveTextContent('blue');
  });
});
