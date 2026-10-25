import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import { installMatchMedia } from './dom';

/* jsdom gaps that the core modules touch. */
Element.prototype.scrollIntoView = () => {};
window.scrollTo = () => {};

beforeEach(() => {
  localStorage.clear();
  installMatchMedia();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  localStorage.clear();
});
