/**
 * useCountUp — the one animated number in the app.
 *
 * Counts from the previous resting value to `value` with requestAnimationFrame,
 * eased with easeOutCubic. It animates **once per value change** and never on an
 * unrelated re-render, so a dashboard that re-renders on a filter change does not
 * restart its numerals.
 *
 * Reduced motion: the final value is returned immediately (no rAF at all).
 * The initial paint is already at the target under reduced motion, so there is no
 * flash of zero on the way in.
 */

import { useEffect, useRef, useState } from 'react';

/** True when the user has asked the OS for less motion. Safe on the server. */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * @param value    target number
 * @param duration milliseconds for the count; 480 is the house default (400–600)
 * @returns the number to paint right now
 */
export function useCountUp(value: number, duration = 480): number {
  const target = Number.isFinite(value) ? value : 0;

  const [shown, setShown] = useState<number>(() =>
    duration <= 0 || prefersReducedMotion() ? target : 0,
  );

  const shownRef = useRef<number>(shown);

  useEffect(() => {
    const from = shownRef.current;

    if (from === target) return;

    if (duration <= 0 || prefersReducedMotion()) {
      shownRef.current = target;
      setShown(target);
      return;
    }

    let raf = 0;
    let start = 0;

    const tick = (now: number) => {
      if (!start) start = now;
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = from + (target - from) * eased;
      shownRef.current = next;
      setShown(next);
      if (t < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return shown;
}
