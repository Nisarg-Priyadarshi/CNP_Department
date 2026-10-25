import { useCallback, useEffect, useRef, useState } from 'react';

/* ═══════════════════════════════════════════════════════════════════════════
   Global keyboard shortcuts — one listener for the whole chrome layer.

   A binding is a combo string plus a run function:

     'mod+k'   ⌘K on a Mac, Ctrl+K elsewhere
     '?'       a bare character (shift is allowed: ? needs it)
     'g d'     a two-key sequence; the first key opens a 1.2s window

   `useHotkeys` also reports the sequence prefix it is waiting on, so the shell
   can teach the map with a chip instead of hiding it in a document.
   ═══════════════════════════════════════════════════════════════════════════ */

export const IS_MAC =
  typeof navigator !== 'undefined' && /mac|iphone|ipad|ipod/i.test(navigator.userAgent);

/** The modifier glyph the header and the sheets print. */
export const MOD_LABEL = IS_MAC ? '⌘' : 'Ctrl';

/** True while the caret is in a field, so typing never triggers a shortcut. */
export function isEditableTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element || typeof element.tagName !== 'string') return false;
  if (element.isContentEditable) return true;
  const tag = element.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

export interface HotkeyBinding {
  /** 'mod+k' | '?' | 'g d' */
  combo: string;
  run: (event: KeyboardEvent) => void;
  /** Fire even when focus is inside a text field. */
  allowInInputs?: boolean;
  /** Fire while the palette or the shortcuts sheet is open. */
  allowInOverlay?: boolean;
}

export interface HotkeysOptions {
  enabled?: boolean;
  /** True while a chrome overlay (palette, sheet) owns the keyboard. */
  overlayOpen?: boolean;
  /** True while a page's own dialog owns the keyboard. */
  blocked?: () => boolean;
  /** How long a one-key prefix waits for its second key. */
  sequenceMs?: number;
}

export interface HotkeysApi {
  /** The prefix currently waiting, e.g. 'g'. Null when idle. */
  prefix: string | null;
  clearPrefix: () => void;
}

const keyOf = (event: KeyboardEvent): string =>
  event.key === ' ' ? 'space' : event.key.toLowerCase();

function matchesCombo(combo: string, event: KeyboardEvent): boolean {
  const tokens = combo.toLowerCase().split('+');
  const key = tokens.pop() ?? '';
  if (!key) return false;

  const wantsMod = tokens.includes('mod');
  const wantsShift = tokens.includes('shift');
  const wantsAlt = tokens.includes('alt');

  const modPressed = IS_MAC ? event.metaKey : event.ctrlKey;
  const otherModPressed = IS_MAC ? event.ctrlKey : event.metaKey;
  if (otherModPressed) return false;

  if (tokens.length === 0) {
    // A bare character: no command/alt, and shift is whatever the glyph needs.
    if (event.metaKey || event.ctrlKey || event.altKey) return false;
    return keyOf(event) === key;
  }

  if (wantsMod !== modPressed) return false;
  if (wantsAlt !== event.altKey) return false;
  if (wantsShift !== event.shiftKey) return false;
  return keyOf(event) === key;
}

export function useHotkeys(
  bindings: HotkeyBinding[],
  options: HotkeysOptions = {},
): HotkeysApi {
  const { enabled = true, overlayOpen = false, sequenceMs = 1200 } = options;

  const [prefix, setPrefix] = useState<string | null>(null);
  const prefixRef = useRef<string | null>(null);
  const timerRef = useRef<number | null>(null);
  const bindingsRef = useRef(bindings);
  const stateRef = useRef({ enabled, overlayOpen, blocked: options.blocked });

  bindingsRef.current = bindings;
  stateRef.current = { enabled, overlayOpen, blocked: options.blocked };

  const clearPrefix = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (prefixRef.current !== null) {
      prefixRef.current = null;
      setPrefix(null);
    }
  }, []);

  const startPrefix = useCallback(
    (next: string) => {
      clearPrefix();
      prefixRef.current = next;
      setPrefix(next);
      timerRef.current = window.setTimeout(() => {
        prefixRef.current = null;
        setPrefix(null);
        timerRef.current = null;
      }, sequenceMs);
    },
    [clearPrefix, sequenceMs],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!stateRef.current.enabled) return;
      if (event.defaultPrevented) return;
      if (event.key === 'Meta' || event.key === 'Control' || event.key === 'Alt') return;

      const current = stateRef.current;
      if (current.blocked?.()) {
        clearPrefix();
        return;
      }
      const typing = isEditableTarget(event.target);
      const list = bindingsRef.current;
      const key = keyOf(event);

      // A waiting prefix always gets first refusal.
      if (prefixRef.current) {
        const combo = `${prefixRef.current} ${key}`;
        const next = list.find((binding) => binding.combo === combo);
        if (next && (!typing || next.allowInInputs) && (!current.overlayOpen || next.allowInOverlay)) {
          clearPrefix();
          if (next.allowInInputs && typing) event.preventDefault();
          next.run(event);
          return;
        }
        clearPrefix();
      }

      for (const binding of list) {
        const parts = binding.combo.split(' ');
        if (parts.length === 2) {
          // Only the first key starts a sequence; the second is matched above.
          if (!matchesCombo(parts[0], event)) continue;
          if (typing && !binding.allowInInputs) continue;
          if (current.overlayOpen && !binding.allowInOverlay) continue;
          event.preventDefault();
          startPrefix(parts[0]);
          return;
        }

        if (!matchesCombo(binding.combo, event)) continue;
        if (typing && !binding.allowInInputs) continue;
        if (current.overlayOpen && !binding.allowInOverlay) continue;
        event.preventDefault();
        binding.run(event);
        return;
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, [clearPrefix, startPrefix]);

  return { prefix, clearPrefix };
}
