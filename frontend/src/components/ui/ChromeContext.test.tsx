import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, useState, type ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ChromeProvider, useChrome, type ChromeCommand } from './ChromeContext';

/* The context is the unit under test; the two overlays are separate surfaces. */
vi.mock('./CommandPalette', () => ({ CommandPalette: () => null }));
vi.mock('./Shortcuts', () => ({ Shortcuts: () => null }));

function StateProbe() {
  const chrome = useChrome();
  return (
    <div>
      <p data-testid="state">{`palette:${chrome.paletteOpen} shortcuts:${chrome.shortcutsOpen}`}</p>
      <button onClick={chrome.openPalette}>open palette</button>
      <button onClick={chrome.closePalette}>close palette</button>
      <button onClick={chrome.openShortcuts}>open shortcuts</button>
      <button onClick={chrome.closeShortcuts}>close shortcuts</button>
    </div>
  );
}

function renderChrome(ui: ReactElement) {
  return render(<ChromeProvider>{ui}</ChromeProvider>);
}

const COMMANDS: ChromeCommand[] = [
  { id: 'club:new', label: 'New club', run: () => {} },
  { id: 'event:new', label: 'New event', meta: '/events', run: () => {} },
];

function Registry({ active }: { active: boolean }) {
  const { commands, registerCommands } = useChrome();

  useEffect(() => {
    if (!active) return;
    return registerCommands(COMMANDS);
  }, [active, registerCommands]);

  return (
    <ul aria-label="commands">
      {commands.map((command) => (
        <li key={command.id}>{command.label}</li>
      ))}
    </ul>
  );
}

describe('ChromeProvider', () => {
  it('only ever allows one overlay open at a time', async () => {
    const user = userEvent.setup();
    renderChrome(<StateProbe />);

    expect(screen.getByTestId('state')).toHaveTextContent('palette:false shortcuts:false');

    await user.click(screen.getByRole('button', { name: 'open shortcuts' }));
    expect(screen.getByTestId('state')).toHaveTextContent('palette:false shortcuts:true');

    await user.click(screen.getByRole('button', { name: 'open palette' }));
    expect(screen.getByTestId('state')).toHaveTextContent('palette:true shortcuts:false');

    await user.click(screen.getByRole('button', { name: 'open shortcuts' }));
    expect(screen.getByTestId('state')).toHaveTextContent('palette:false shortcuts:true');

    await user.click(screen.getByRole('button', { name: 'close shortcuts' }));
    expect(screen.getByTestId('state')).toHaveTextContent('palette:false shortcuts:false');
  });

  it('closes the palette independently', async () => {
    const user = userEvent.setup();
    renderChrome(<StateProbe />);

    await user.click(screen.getByRole('button', { name: 'open palette' }));
    await user.click(screen.getByRole('button', { name: 'close palette' }));

    expect(screen.getByTestId('state')).toHaveTextContent('palette:false shortcuts:false');
  });

  it('registers contributed commands and removes them when the area unmounts', async () => {
    const user = userEvent.setup();

    function Harness() {
      const [active, setActive] = useState(true);
      return (
        <ChromeProvider>
          <button onClick={() => setActive(false)}>unregister</button>
          <Registry active={active} />
        </ChromeProvider>
      );
    }

    render(<Harness />);

    expect(screen.getByRole('list', { name: 'commands' })).toHaveTextContent('New club');
    expect(screen.getByRole('list', { name: 'commands' })).toHaveTextContent('New event');

    await user.click(screen.getByRole('button', { name: 'unregister' }));

    expect(screen.queryByText('New club')).not.toBeInTheDocument();
    expect(screen.queryByText('New event')).not.toBeInTheDocument();
  });
});

describe('useChrome()', () => {
  it('throws outside a ChromeProvider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<StateProbe />)).toThrow('useChrome must be used inside <ChromeProvider>');

    consoleError.mockRestore();
  });
});
