import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { Counter } from '../../ui/vis';
import { prefersReducedMotion } from '../../ui/useCountUp';
import { Tooltip } from '../../ui/Tooltip';
import { DashboardSection, PanelError } from './DashboardSection';
import { CoreMark, MemberMark } from './StudentIcons';
import { initialsOf, membershipRole } from './studentUtils';
import type { StudentClubMembership } from '../../../types/studentDashboard';

interface StudentMembershipsProps {
  clubs: StudentClubMembership[];
  error?: string;
  /** How many of these memberships are core-team seats — derived on the page. */
  coreCount?: number;
}

/**
 * A club is a crest, a composition bar and your role in it. The member count is
 * a numeral, the core/regular split is a bar, and the coordinator and your
 * position are a hover away. No row describes what it is.
 */
export function StudentMemberships({ clubs, error, coreCount = 0 }: StudentMembershipsProps) {
  /* One frame after mount, so the composition bars have an empty state to grow
     from. Reduced motion starts ready and paints the final split immediately. */
  const [entered, setEntered] = useState<boolean>(() => prefersReducedMotion());

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <DashboardSection
      id="sd-clubs"
      title="Clubs"
      meta={
        clubs.length > 0 ? (
          <>
            {clubs.length}
            {coreCount > 0 ? <span className="sd-region__note"> · {coreCount} core</span> : null}
          </>
        ) : undefined
      }
      actionLabel="All clubs"
      actionTo="/clubs"
      className="sd-clubs"
    >
      {error ? <PanelError message={error} /> : null}

      {clubs.length > 0 ? (
        <ul className="sd-crests">
          {clubs.map(({ club, membership }) => {
            const role = membershipRole(membership);
            const members = club.totalMembers ?? club.memberCount;
            const core = club.coreTeamCount;
            // MOCK: the composition bar divides two counts on the club payload
            // (coreTeamCount ÷ totalMembers); no endpoint returns a ratio.
            const share =
              typeof members === 'number' && members > 0 && typeof core === 'number'
                ? Math.min(1, core / members)
                : null;
            const coordinator =
              club.facultyCoordinatorId && typeof club.facultyCoordinatorId === 'object'
                ? club.facultyCoordinatorId.name?.trim() || null
                : null;

            const facts = [
              role.core && role.label !== 'Core team' ? `You · ${role.label}` : null,
              typeof members === 'number' ? `${members} ${members === 1 ? 'member' : 'members'}` : null,
              typeof core === 'number' && typeof members === 'number'
                ? `${core} core · ${Math.max(0, members - core)} regular`
                : null,
              coordinator ? `Coordinator ${coordinator}` : null,
            ].filter(Boolean);

            const label = [
              club.name,
              role.core ? 'core team' : 'member',
              role.core && role.label !== 'Core team' ? role.label : null,
              typeof members === 'number' ? `${members} ${members === 1 ? 'member' : 'members'}` : null,
              coordinator ? `coordinator ${coordinator}` : null,
            ]
              .filter(Boolean)
              .join(', ');

            return (
              <li key={club._id}>
                <Tooltip label={facts.join(' · ')}>
                  <Link className="sd-crest" to={`/clubs/${club._id}`} aria-label={label}>
                    <span className="sd-crest__plate" aria-hidden="true">
                      {club.logo ? <img src={club.logo} alt="" /> : initialsOf(club.name)}
                    </span>

                    <span className="sd-crest__main">
                      <span className="sd-crest__name">{club.name}</span>
                      {share !== null ? (
                        <span
                          className={`sd-comp${entered ? ' is-ready' : ''}`}
                          role="img"
                          aria-label={`${core} of ${members} in the core team`}
                          title={`${core} core of ${members} members`}
                        >
                          <span
                            className="sd-comp__core"
                            style={{ '--sd-f': share } as CSSProperties}
                          />
                        </span>
                      ) : null}
                    </span>

                    <span className="sd-crest__role" data-core={role.core || undefined}>
                      {role.core ? (
                        <CoreMark className="sd-icon sd-icon--xs" />
                      ) : (
                        <MemberMark className="sd-icon sd-icon--xs" />
                      )}
                      <span>{role.core ? 'Core' : 'Member'}</span>
                    </span>

                    <span className="sd-crest__count" aria-hidden="true">
                      {typeof members === 'number' ? <Counter value={members} /> : '—'}
                    </span>
                  </Link>
                </Tooltip>
              </li>
            );
          })}
        </ul>
      ) : !error ? (
        <div className="sd-region__state">
          <p className="sd-region__empty">No clubs yet.</p>
          <Link className="ui-btn ui-btn--quiet ui-btn--sm" to="/clubs">
            Find a club
          </Link>
        </div>
      ) : null}
    </DashboardSection>
  );
}
