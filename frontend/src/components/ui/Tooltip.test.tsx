import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { Tooltip } from './Tooltip';
import { installMatchMedia } from '../../test/dom';

function renderTooltip(props: { label?: ReactNode; disabled?: boolean; describedBy?: string } = {}) {
  const { disabled, describedBy } = props;
  const label: ReactNode = 'label' in props ? props.label : '42 members';
  return render(
    <Tooltip label={label} disabled={disabled}>
      <button type="button" aria-describedby={describedBy}>
        42
      </button>
    </Tooltip>,
  );
}

afterEach(() => {
  vi.useRealTimers();
});

describe('Tooltip', () => {
  it('opens immediately on keyboard focus and wires aria-describedby', async () => {
    const user = userEvent.setup();
    renderTooltip();

    const trigger = screen.getByRole('button', { name: '42' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(trigger).not.toHaveAttribute('aria-describedby');

    await user.tab();

    const tip = await screen.findByRole('tooltip');
    expect(tip).toHaveTextContent('42 members');
    expect(trigger).toHaveFocus();
    expect(trigger.getAttribute('aria-describedby')).toBe(tip.id);
    expect(tip).toHaveAttribute('id', trigger.getAttribute('aria-describedby'));
  });

  it('opens on hover only after the delay', () => {
    installMatchMedia({ '(hover: hover)': true });
    vi.useFakeTimers();
    renderTooltip();

    const trigger = screen.getByRole('button', { name: '42' });
    fireEvent.mouseOver(trigger);

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(279);
    });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByRole('tooltip')).toHaveTextContent('42 members');
  });

  it('never opens on hover for a touch device, but still opens on focus', () => {
    installMatchMedia({ '(hover: hover)': false });
    vi.useFakeTimers();
    renderTooltip();

    const trigger = screen.getByRole('button', { name: '42' });
    fireEvent.mouseOver(trigger);
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    act(() => {
      trigger.focus();
    });
    expect(screen.getByRole('tooltip')).toHaveTextContent('42 members');
  });

  it('cancels a pending hover open when the pointer leaves first', () => {
    installMatchMedia({ '(hover: hover)': true });
    vi.useFakeTimers();
    renderTooltip();

    const trigger = screen.getByRole('button', { name: '42' });
    fireEvent.mouseOver(trigger);
    fireEvent.mouseOut(trigger);

    act(() => {
      vi.advanceTimersByTime(1_000);
    });

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('closes on mouse leave', () => {
    installMatchMedia({ '(hover: hover)': true });
    vi.useFakeTimers();
    renderTooltip();

    const trigger = screen.getByRole('button', { name: '42' });
    fireEvent.mouseOver(trigger);
    act(() => {
      vi.advanceTimersByTime(280);
    });
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    fireEvent.mouseOut(trigger);

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('closes on Escape, keeps focus on the trigger and drops aria-describedby', async () => {
    const user = userEvent.setup();
    renderTooltip();

    const trigger = screen.getByRole('button', { name: '42' });
    await user.tab();
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(trigger).not.toHaveAttribute('aria-describedby');
  });

  it('closes on blur', async () => {
    const user = userEvent.setup();
    renderTooltip();

    await user.tab();
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    await user.tab();

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('does nothing when disabled', async () => {
    const user = userEvent.setup();
    renderTooltip({ disabled: true });

    const trigger = screen.getByRole('button', { name: '42' });
    await user.hover(trigger);
    await user.tab();

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(trigger).not.toHaveAttribute('aria-describedby');
  });

  it.each([
    ['empty string', ''],
    ['null', null],
    ['undefined', undefined],
  ])('does nothing for an empty label (%s)', async (_case, label) => {
    const user = userEvent.setup();
    renderTooltip({ label });

    await user.tab();

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('preserves an existing aria-describedby and appends its own while open', async () => {
    const user = userEvent.setup();
    renderTooltip({ describedBy: 'field-hint' });

    const trigger = screen.getByRole('button', { name: '42' });
    expect(trigger).toHaveAttribute('aria-describedby', 'field-hint');

    await user.tab();

    const tip = screen.getByRole('tooltip');
    expect(trigger.getAttribute('aria-describedby')).toBe(`field-hint ${tip.id}`);
  });
});
