import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isEventPast, localDayStartIso, partitionEvents, useLocalDay } from './eventDate';

/** Local October 2026 timestamps; the suite's "today" is 24 Oct 2026, 12:00 local. */
const oct = (day: number, hour = 12, minute = 0) => new Date(2026, 9, day, hour, minute, 0, 0);

describe('isEventPast()', () => {
  it('is false for an empty or invalid value', () => {
    expect(isEventPast(null, oct(24))).toBe(false);
    expect(isEventPast(undefined, oct(24))).toBe(false);
    expect(isEventPast('', oct(24))).toBe(false);
    expect(isEventPast('definitely-not-a-date', oct(24))).toBe(false);
  });

  it('is true for any time on a day that has ended', () => {
    expect(isEventPast(oct(23, 23, 59), oct(24, 0, 0))).toBe(true);
    expect(isEventPast(oct(23, 0, 0), oct(24, 23, 59))).toBe(true);
  });

  it('is false for any time today, including midnight and 23:59', () => {
    expect(isEventPast(oct(24, 0, 0), oct(24, 0, 0))).toBe(false);
    expect(isEventPast(oct(24, 23, 59), oct(24, 0, 0))).toBe(false);
  });

  it('accepts a Date and an ISO string for the same instant', () => {
    const value = oct(22, 15);
    expect(isEventPast(value, oct(24))).toBe(true);
    expect(isEventPast(value.toISOString(), oct(24))).toBe(true);
  });
});

describe('partitionEvents()', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(oct(24, 12));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns empty groups for an empty list', () => {
    expect(partitionEvents([])).toEqual({ upcoming: [], past: [] });
  });

  it('splits on the local calendar day and sorts each group deterministically', () => {
    const events = [
      { id: 'future-late', eventDate: oct(28).toISOString() },
      { id: 'today-early', eventDate: oct(24, 0).toISOString() },
      { id: 'past-old', date: oct(10).toISOString() },
      { id: 'today-late', eventDate: oct(24, 23).toISOString() },
      { id: 'past-recent', eventDate: oct(23, 23).toISOString() },
      { id: 'future-soon', eventDate: oct(26).toISOString() },
    ];

    const { upcoming, past } = partitionEvents(events);

    expect(upcoming.map((event) => event.id)).toEqual([
      'today-early',
      'today-late',
      'future-soon',
      'future-late',
    ]);
    expect(past.map((event) => event.id)).toEqual(['past-recent', 'past-old']);
  });

  it('keeps events exactly on today as upcoming (the boundary is day-based)', () => {
    const { upcoming, past } = partitionEvents([
      { id: 'midnight', eventDate: oct(24, 0, 0).toISOString() },
      { id: 'last-minute', eventDate: oct(24, 23, 59).toISOString() },
      { id: 'yesterday', eventDate: oct(23, 23, 59).toISOString() },
    ]);

    expect(upcoming.map((event) => event.id)).toEqual(['midnight', 'last-minute']);
    expect(past.map((event) => event.id)).toEqual(['yesterday']);
  });

  it('reads the `date` field when `eventDate` is absent', () => {
    const { upcoming, past } = partitionEvents([
      { id: 'future', date: oct(25).toISOString() },
      { id: 'past', date: oct(1).toISOString() },
    ]);

    expect(upcoming.map((event) => event.id)).toEqual(['future']);
    expect(past.map((event) => event.id)).toEqual(['past']);
  });

  it('does not mutate the input order', () => {
    const events = [
      { id: 'c', eventDate: oct(27).toISOString() },
      { id: 'a', eventDate: oct(26).toISOString() },
      { id: 'b', eventDate: oct(25).toISOString() },
    ];

    partitionEvents(events);

    expect(events.map((event) => event.id)).toEqual(['c', 'a', 'b']);
  });

  it('puts an event with no usable date in past, after the dated ones', () => {
    // An undated event has no day to arrive on, so it cannot be upcoming. It
    // sorts to the end of the past group instead of sitting behind a NaN.
    const { upcoming, past } = partitionEvents([
      { id: 'no-date' },
      { id: 'invalid', eventDate: 'not-a-date' },
      { id: 'later', eventDate: oct(20).toISOString() },
      { id: 'dated', eventDate: oct(25).toISOString() },
    ]);

    expect(upcoming.map((event) => event.id)).toEqual(['dated']);
    expect(past.map((event) => event.id)).toEqual(['later', 'no-date', 'invalid']);
  });
});

describe('localDayStartIso()', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(oct(24, 12));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns local midnight as an ISO timestamp', () => {
    expect(localDayStartIso()).toBe(new Date(2026, 9, 24, 0, 0, 0, 0).toISOString());
  });

  it('round-trips to local midnight, not UTC midnight', () => {
    const start = new Date(localDayStartIso());
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(start.getDate()).toBe(24);
  });
});

describe('useLocalDay()', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(oct(24, 23, 59));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with today and rolls over just after local midnight', () => {
    const { result } = renderHook(() => useLocalDay());
    expect(result.current).toBe(oct(24).toDateString());

    // 23:59:00 → 00:00:01 next day is the 60s wait plus the 50ms margin.
    act(() => {
      vi.advanceTimersByTime(61_000);
    });

    expect(result.current).toBe(oct(25).toDateString());
  });
});
