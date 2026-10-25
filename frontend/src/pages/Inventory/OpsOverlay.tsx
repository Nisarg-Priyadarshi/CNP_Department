import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';

interface OpsOverlayProps {
  className?: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * The console's modal backdrop, mounted on <body>.
 *
 * The shell's route wrapper keeps a transform on `.route-enter`, which makes a
 * fixed overlay position itself against the page content instead of the
 * viewport — a modal opened on a tall screen lands below the fold. Portalling
 * out of that subtree restores true viewport centring; the `.ops-page` wrapper
 * keeps the area's field/label repairs and reduced-motion guard applying.
 */
export function OpsOverlay({ className, onClose, children }: OpsOverlayProps) {
  return createPortal(
    <div className="ops-page ops-portal">
      <div
        className={`ui-overlay${className ? ` ${className}` : ''}`}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
