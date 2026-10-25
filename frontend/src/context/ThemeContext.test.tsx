import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { ThemeProvider, useTheme } from './ThemeContext';

function Probe() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button type="button" onClick={toggleTheme}>
      theme:{theme}
    </button>
  );
}

function renderProbe() {
  return render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>,
  );
}

afterEach(() => {
  window.localStorage.clear();
  delete document.documentElement.dataset.theme;
  document.documentElement.style.colorScheme = '';
});

describe('ThemeProvider', () => {
  it('starts light, never from the device preference', () => {
    renderProbe();

    expect(screen.getByRole('button')).toHaveTextContent('theme:light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('reads the stored choice', () => {
    window.localStorage.setItem('cnp_theme', 'dark');

    renderProbe();

    expect(screen.getByRole('button')).toHaveTextContent('theme:dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
  });

  it('toggles, paints the document and remembers the answer', async () => {
    const user = userEvent.setup();
    renderProbe();

    await user.click(screen.getByRole('button'));

    expect(screen.getByRole('button')).toHaveTextContent('theme:dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(window.localStorage.getItem('cnp_theme')).toBe('dark');

    await user.click(screen.getByRole('button'));

    expect(document.documentElement.dataset.theme).toBe('light');
    expect(window.localStorage.getItem('cnp_theme')).toBe('light');
  });
});
