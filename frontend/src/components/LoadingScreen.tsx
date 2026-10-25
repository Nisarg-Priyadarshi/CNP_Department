import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

export interface LoadingScreenProps {
  /**
   * If true, signals that the destination's data has arrived: the fourth tick of
   * the progress hairline can close and the route is shown.
   */
  isReady?: boolean;
  /**
   * Callback fired once the loader has finished and may be unmounted.
   */
  onComplete?: () => void;
  /**
   * Caption text displayed under the progress hairline.
   */
  caption?: string;
  /**
   * Whether to render as fixed full-screen overlay (true by default).
   */
  fullScreen?: boolean;
  /** Fade the whole scene out (used while the app mounts underneath it). */
  leaving?: boolean;
}

const ROUTE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  clubs: 'Clubs',
  projects: 'Projects',
  events: 'Events',
  notifications: 'Notifications',
  inventory: 'Inventory',
  'material-requests': 'Material requests',
  profile: 'Profile',
  login: 'Sign in',
  register: 'Create account',
};

const TOTAL_STEPS = 4;

/** The route being loaded, taken from the URL rather than a prop. */
function routeLabel(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean);
  const root = segments[0];
  if (!root) return 'CNP Department';
  if (segments.length > 1) {
    if (root === 'clubs') return 'Club details';
    if (root === 'projects') return 'Project details';
  }
  return ROUTE_LABELS[root] ?? root.charAt(0).toUpperCase() + root.slice(1).replace(/-/g, ' ');
}

function prefersReducedMotionNow(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Boot loader — the register opens.
 *
 * A closed cobalt cover stands over a ruled page; it swings back on its spine and
 * the page underneath is what actually reports progress: the route, a four-tick
 * hairline, and an honest caption. The cover is a real 3D leaf (front and inside
 * faces), so the hinge reads at any width; under reduced motion it simply starts
 * open.
 *
 * The fourth tick is the only one that waits: it closes when the caller says the
 * page is ready, never on a timer.
 */
export default function LoadingScreen({
  isReady = true,
  onComplete,
  caption,
  fullScreen = true,
  leaving = false,
}: LoadingScreenProps) {
  const location = useLocation();
  const [step, setStep] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(prefersReducedMotionNow);
  const [complete, setComplete] = useState(false);

  const isReadyRef = useRef(isReady);
  isReadyRef.current = isReady;
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const firedRef = useRef(false);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(media.matches);
    const listener = (event: MediaQueryListEvent) => setReducedMotion(event.matches);
    media.addEventListener?.('change', listener);
    return () => media.removeEventListener?.('change', listener);
  }, []);

  const finish = useCallback(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    setComplete(true);
    onCompleteRef.current?.();
  }, []);

  /* Ticks one to three on a fixed cadence: snappy if the data is already there. */
  useEffect(() => {
    if (reducedMotion) return;
    const cadence = isReadyRef.current ? 70 : 200;
    const timers = [1, 2, 3].map((index) =>
      window.setTimeout(() => setStep((current) => Math.max(current, index)), cadence * index),
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [reducedMotion]);

  /* The fourth tick is the honest one: it only closes when the page says it is ready. */
  useEffect(() => {
    if (reducedMotion) {
      setStep(TOTAL_STEPS);
      if (!isReady) return;
      const timer = window.setTimeout(finish, 220);
      return () => window.clearTimeout(timer);
    }

    if (step < 3) return;
    if (!isReady) return;

    if (step === 3) {
      const timer = window.setTimeout(() => setStep(TOTAL_STEPS), 110);
      return () => window.clearTimeout(timer);
    }

    const timer = window.setTimeout(finish, 280);
    return () => window.clearTimeout(timer);
  }, [step, isReady, reducedMotion, finish]);

  /* The loader never unmounts itself: its owner owns the exit. It reports
     `onComplete` and the caller decides when the scene is gone (the boot gate
     fades it over the incoming page). */

  /* Never outstay the route. */
  useEffect(() => {
    if (complete) return;
    const timer = window.setTimeout(finish, 2600);
    return () => window.clearTimeout(timer);
  }, [complete, finish]);

  const label = routeLabel(location.pathname);
  // The fourth tick is held open while the page is still working: say so honestly.
  const progress = isReady ? step : Math.min(step, TOTAL_STEPS - 1);
  const resolvedCaption =
    caption ??
    (isReady && step >= TOTAL_STEPS
      ? 'Ready.'
      : step >= 3 && !isReady
        ? 'Waiting for this page to finish loading…'
        : `Opening ${label.toLowerCase()}…`);

  return (
    <div
      className={`shell-loader${fullScreen ? '' : ' shell-loader--inline'}${leaving ? ' is-leaving' : ''}`}
      role="status"
      aria-live="polite"
      aria-busy={!isReady}
      aria-label="Loading workspace"
    >
      <div className="shell-loader__inner">
        <div className="shell-book">
          {/* The page: what the report is printed on, revealed by the cover. */}
          <div className="shell-book__page">
            <div className="shell-loader__plate">
              <span className="shell-book__mark shell-mark" aria-hidden="true">C</span>

              <p className="shell-loader__route">{label}</p>

              <div
                className="shell-loader__track"
                role="progressbar"
                aria-label="Loading progress"
                aria-valuemin={0}
                aria-valuemax={TOTAL_STEPS}
                aria-valuenow={progress}
                aria-valuetext={`${progress} of ${TOTAL_STEPS}`}
              >
                {Array.from({ length: TOTAL_STEPS }, (_, index) => {
                  const isOn = index < step;
                  const isWaiting = index === 3 && step >= 3 && !isReady && !reducedMotion;
                  return (
                    <span
                      key={index}
                      className={`shell-loader__seg${isOn ? ' is-on' : ''}${isWaiting ? ' is-waiting' : ''}`}
                    >
                      <span className="shell-loader__fill" />
                    </span>
                  );
                })}
              </div>

              <p className="shell-loader__caption">{resolvedCaption}</p>
            </div>
          </div>

          {/* The cover: a leaf hinged on the spine, with an outside and an inside. */}
          <div className="shell-book__leaf" aria-hidden="true">
            <span className="shell-book__face shell-book__face--out">
              <span className="shell-book__frame" />
            </span>
            <span className="shell-book__face shell-book__face--in">
              <span className="shell-book__endpaper" />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
