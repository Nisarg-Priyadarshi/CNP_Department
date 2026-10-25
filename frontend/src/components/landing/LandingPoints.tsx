import { useState } from 'react';

export interface LandingPoint {
  title: string;
  text: string;
}

interface LandingPointsProps {
  points: LandingPoint[];
}

/**
 * A ruled list whose detail sits under the row until the row is hovered, focused or
 * tapped. One row stays open, so the list never collapses to bare titles.
 */
export function LandingPoints({ points }: LandingPointsProps) {
  const [active, setActive] = useState(0);

  return (
    <ul className="landing-points">
      {points.map((point, i) => {
        const open = i === active;
        return (
          <li
            key={point.title}
            className={`landing-point${open ? ' is-open' : ''}`}
            onMouseEnter={() => setActive(i)}
          >
            <h3 className="landing-point-title">
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setActive(i)}
                onFocus={() => setActive(i)}
              >
                <span className="landing-point-name">{point.title}</span>
                <span className="landing-point-mark" aria-hidden="true" />
              </button>
            </h3>
            <div className="landing-point-body">
              <div>
                <p>{point.text}</p>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
