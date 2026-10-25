import {
  cloneElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

/* ═══════════════════════════════════════════════════════════════════════════
   Tooltip — the place a deleted sentence goes.

   Portalled to <body> and fixed-positioned, so a tip escapes any `overflow:
   auto` row, table or panel it is anchored to. Above by default, flipping below
   when there is no room, clamped to the viewport. Hover opens after 280ms;
   keyboard focus opens at once. Touch never opens it.

     <Tooltip label="42 members"><button …>42</button></Tooltip>

   The trigger keeps a real `aria-describedby` while the tip is open, so the
   text is available to assistive technology and never only on hover.
   ═══════════════════════════════════════════════════════════════════════════ */

export interface TooltipProps {
  label: ReactNode;
  /** A single element that can hold a ref (a button, an anchor, a span). */
  children: ReactElement;
  side?: 'top' | 'bottom' | 'auto';
  /** Hover delay in ms. Focus is always immediate. */
  delay?: number;
  disabled?: boolean;
}

interface TipPosition {
  top: number;
  left: number;
  below: boolean;
  stemLeft: number;
}

const GAP = 8;
const EDGE = 8;
const STEM = 5;

function hoverCapable(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return true;
  return window.matchMedia('(hover: hover)').matches;
}

export function Tooltip({ label, children, side = 'auto', delay = 280, disabled }: TooltipProps) {
  const tipId = useId();
  const triggerRef = useRef<HTMLElement | null>(null);
  const tipRef = useRef<HTMLSpanElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<TipPosition | null>(null);

  const hidden = disabled || label === null || label === undefined || label === '';

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const hide = useCallback(() => {
    clearTimer();
    setOpen(false);
    setPosition(null);
  }, [clearTimer]);

  const show = useCallback(() => {
    clearTimer();
    setOpen(true);
  }, [clearTimer]);

  const showSoon = useCallback(() => {
    if (!hoverCapable()) return;
    clearTimer();
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      setOpen(true);
    }, delay);
  }, [clearTimer, delay]);

  const place = useCallback(() => {
    const trigger = triggerRef.current;
    const tip = tipRef.current;
    if (!trigger || !tip) return;

    const rect = trigger.getBoundingClientRect();
    const box = tip.getBoundingClientRect();
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    let below = side === 'bottom';
    if (side !== 'bottom') below = rect.top - box.height - GAP < EDGE;

    const top = below ? rect.bottom + GAP : rect.top - box.height - GAP;
    const left = Math.min(
      Math.max(EDGE, rect.left + rect.width / 2 - box.width / 2),
      Math.max(EDGE, viewportW - box.width - EDGE),
    );
    const stemLeft = Math.min(
      Math.max(EDGE, rect.left + rect.width / 2 - left),
      Math.max(EDGE, box.width - EDGE),
    );

    setPosition({
      top: Math.min(Math.max(EDGE, top), Math.max(EDGE, viewportH - box.height - EDGE)),
      left,
      below,
      stemLeft,
    });
  }, [side]);

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    place();
  }, [open, place, label]);

  useEffect(() => {
    if (!open) return;

    const onViewportChange = () => hide();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') hide();
    };

    window.addEventListener('resize', onViewportChange);
    window.addEventListener('scroll', onViewportChange, true);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('scroll', onViewportChange, true);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, hide]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  const element = children as ReactElement<Record<string, unknown>>;
  const childProps = element.props;
  // React 19: ref is a regular prop, not an element field.
  const childRef = childProps.ref;
  const childDescribedBy =
    typeof childProps['aria-describedby'] === 'string'
      ? (childProps['aria-describedby'] as string)
      : undefined;

  const describedBy = [childDescribedBy, open ? tipId : null].filter(Boolean).join(' ');

  const call = (name: string, event: unknown) => {
    const handler = childProps[name];
    if (typeof handler === 'function') (handler as (event: unknown) => void)(event);
  };

  const trigger = cloneElement(element, {
    ref: (node: HTMLElement | null) => {
      triggerRef.current = node;
      if (typeof childRef === 'function') (childRef as (node: HTMLElement | null) => void)(node);
      else if (childRef && typeof childRef === 'object') {
        (childRef as { current: HTMLElement | null }).current = node;
      }
    },
    'aria-describedby': describedBy || undefined,
    onMouseEnter: (event: ReactMouseEvent) => {
      call('onMouseEnter', event);
      if (!hidden) showSoon();
    },
    onMouseLeave: (event: ReactMouseEvent) => {
      call('onMouseLeave', event);
      hide();
    },
    onFocus: (event: ReactFocusEvent) => {
      call('onFocus', event);
      if (!hidden) show();
    },
    onBlur: (event: ReactFocusEvent) => {
      call('onBlur', event);
      hide();
    },
    onKeyDown: (event: ReactKeyboardEvent) => {
      call('onKeyDown', event);
      if (event.key === 'Escape' && open) {
        event.stopPropagation();
        hide();
      }
    },
  });

  return (
    <>
      {trigger}
      {open &&
        !hidden &&
        createPortal(
          <span
            ref={tipRef}
            id={tipId}
            role="tooltip"
            className={`ui-tip chrome-tip${position?.below ? ' ui-tip--below' : ''}`}
            style={{
              top: position?.top ?? 0,
              left: position?.left ?? 0,
              visibility: position ? 'visible' : 'hidden',
            }}
          >
            <span
              className="chrome-tip__stem"
              aria-hidden="true"
              style={
                position
                  ? {
                      left: position.stemLeft,
                      [position.below ? 'bottom' : 'top']: -STEM,
                    }
                  : undefined
              }
            />
            {label}
          </span>,
          document.body,
        )}
    </>
  );
}
