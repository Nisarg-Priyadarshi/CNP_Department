import { vi } from 'vitest';

/** Queries whose `matches` value a test wants to control, e.g. `{ '(hover: hover)': true }`. */
export type MediaOverrides = Record<string, boolean>;

/**
 * jsdom implements neither `matchMedia` nor the media listeners used by the
 * loader, the tooltip and the count-up hook. Install a quiet default in setup,
 * and a targeted override from a test when the media state matters.
 */
export function installMatchMedia(overrides: MediaOverrides = {}): void {
  window.matchMedia = vi.fn((query: string) => {
    const list = {
      matches: overrides[query] ?? false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    };
    return list as unknown as MediaQueryList;
  });
}
