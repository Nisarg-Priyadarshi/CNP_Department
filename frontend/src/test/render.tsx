import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactElement } from 'react';

type RouterRenderOptions = Omit<RenderOptions, 'wrapper'> & { route?: string };

/** Render a tree that reads router state (guards, login) at a chosen URL. */
export function renderWithRouter(
  ui: ReactElement,
  { route = '/', ...options }: RouterRenderOptions = {},
): RenderResult {
  return render(<MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>, options);
}
