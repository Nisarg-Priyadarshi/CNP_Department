import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { CommandPalette } from './CommandPalette';
import { Shortcuts } from './Shortcuts';

/* ═══════════════════════════════════════════════════════════════════════════
   Chrome — the product layer that floats above every signed-in route.

   The provider owns the two overlays (command palette, shortcuts sheet) and the
   registry of contextual commands. It is mounted once in the shell, outside the
   keyed route wrapper, so opening an overlay never remounts a page and a route
   change never closes the chrome by accident.

   Only one overlay can be open at a time.
   ═══════════════════════════════════════════════════════════════════════════ */

/** A command another area can contribute to the palette. */
export interface ChromeCommand {
  /** Stable, unique id: `club:new`, `event:new`, … */
  id: string;
  label: string;
  /** Right-hand hint: the route, the shortcut, a count. */
  meta?: string;
  /** Extra words the search should match (kept out of the visible label). */
  keywords?: string;
  /** A NAV_ICON_PATHS key, or one of 'keys' | 'search' | 'recent'. */
  icon?: string;
  /** Runs after the palette has closed. */
  run: () => void;
}

export interface ChromeApi {
  paletteOpen: boolean;
  shortcutsOpen: boolean;
  openPalette: () => void;
  closePalette: () => void;
  openShortcuts: () => void;
  closeShortcuts: () => void;
  /** Contribute commands for as long as the returned function is not called. */
  registerCommands: (commands: ChromeCommand[]) => () => void;
  /** The live list of contributed commands. */
  commands: ChromeCommand[];
}

const ChromeContext = createContext<ChromeApi | undefined>(undefined);

export function useChrome(): ChromeApi {
  const context = useContext(ChromeContext);
  if (!context) throw new Error('useChrome must be used inside <ChromeProvider>');
  return context;
}

export function ChromeProvider({ children }: { children: ReactNode }) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [commands, setCommands] = useState<ChromeCommand[]>([]);

  // Registrations are keyed so an unmount (or a re-render) cannot duplicate them.
  const registry = useRef(new Map<string, ChromeCommand[]>());
  const sequence = useRef(0);

  const openPalette = useCallback(() => {
    setShortcutsOpen(false);
    setPaletteOpen(true);
  }, []);

  const closePalette = useCallback(() => setPaletteOpen(false), []);

  const openShortcuts = useCallback(() => {
    setPaletteOpen(false);
    setShortcutsOpen(true);
  }, []);

  const closeShortcuts = useCallback(() => setShortcutsOpen(false), []);

  const registerCommands = useCallback((next: ChromeCommand[]) => {
    const key = `area-${(sequence.current += 1)}`;
    registry.current.set(key, next);
    setCommands(Array.from(registry.current.values()).flat());
    return () => {
      registry.current.delete(key);
      setCommands(Array.from(registry.current.values()).flat());
    };
  }, []);

  const value = useMemo<ChromeApi>(
    () => ({
      paletteOpen,
      shortcutsOpen,
      openPalette,
      closePalette,
      openShortcuts,
      closeShortcuts,
      registerCommands,
      commands,
    }),
    [
      paletteOpen,
      shortcutsOpen,
      openPalette,
      closePalette,
      openShortcuts,
      closeShortcuts,
      registerCommands,
      commands,
    ],
  );

  return (
    <ChromeContext.Provider value={value}>
      {children}
      <CommandPalette />
      <Shortcuts />
    </ChromeContext.Provider>
  );
}
