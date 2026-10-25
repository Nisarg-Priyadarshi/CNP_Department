import { useEffect, useState } from 'react';

/** True after the event's local calendar day has ended. */
export function isEventPast(value: string | Date | null | undefined, today = new Date()): boolean {
  if (!value) return false;
  const eventDate = new Date(value);
  if (Number.isNaN(eventDate.getTime())) return false;
  return new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate()).getTime()
    < new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
}

type EventDateRecord = { eventDate?: string | Date | null; date?: string | Date | null };

/** Milliseconds, or null when the record carries no usable date. */
function eventTime(record: EventDateRecord): number | null {
  const value = record.eventDate || record.date;
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

/**
 * Split events by local calendar day.
 *
 * An event with no usable date cannot be "upcoming" — there is no day for it to
 * arrive on — so it lands in the past group and sorts to the end of it, rather
 * than sitting in Upcoming forever behind a NaN comparator.
 */
export function partitionEvents<T extends EventDateRecord>(events: T[]) {
  const upcoming: T[] = [];
  const past: T[] = [];

  for (const event of events) {
    const time = eventTime(event);
    if (time === null || isEventPast(event.eventDate || event.date)) {
      past.push(event);
    } else {
      upcoming.push(event);
    }
  }

  // Dated first, undated last, then chronological in each direction.
  upcoming.sort((a, b) => (eventTime(a) as number) - (eventTime(b) as number));
  past.sort((a, b) => (eventTime(b) ?? -Infinity) - (eventTime(a) ?? -Infinity));

  return { upcoming, past };
}

/** A stable local-date key that updates automatically just after local midnight. */
export function useLocalDay(): string {
  const [day, setDay] = useState(() => new Date().toDateString());

  useEffect(() => {
    const now = new Date();
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const timer = window.setTimeout(() => setDay(new Date().toDateString()), nextMidnight.getTime() - now.getTime() + 50);
    return () => window.clearTimeout(timer);
  }, [day]);

  return day;
}

/** Start of today's local day as an ISO timestamp, for timezone-safe API filtering. */
export function localDayStartIso(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
}
