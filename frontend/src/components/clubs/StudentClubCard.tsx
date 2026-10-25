import { useState } from 'react';
import { AvatarStack, Counter, Ring, Segments } from '../ui/vis';
import { Tooltip } from '../ui/Tooltip';
import { Crest } from './Crest';
import { RoleMark, type RoleKind } from './RoleMark';
import '../../pages/Clubs/clubs.css';

interface RosterPreviewMember {
  name: string;
  image?: string | null;
  core?: boolean;
  position?: string | null;
}

interface StudentClubCardProps {
  club: {
    _id: string;
    name: string;
    description?: string;
    logo?: string | null;
    coverImage?: string | null;
    images?: string[];
    facultyCoordinatorId?: {
      _id?: string;
      name?: string;
      department?: string;
      profileImage?: string | null;
    } | null;
    totalMembers?: number;
    memberCount?: number;
    coreTeamCount?: number;
    /** The roster the directory already fetched: real names, never invented. */
    rosterPreview?: RosterPreviewMember[];
  };
  membership?: {
    membershipType: string;
    position?: string | null;
  } | null;
  /** A join request is waiting on the coordinator. */
  pending?: boolean;
  /** Overrides the membership tag, e.g. "Admin" or "Coordinator". */
  tag?: string;
  /** The single emphasised club on a directory page. */
  lead?: boolean;
  onClick: () => void;
}

const ArrowRight = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M4 12h15M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const VoidMark = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="clubs-void__mark">
    <path d="M5 19 19 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    <rect x="4.5" y="4.5" width="15" height="15" rx="2" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2.4 2.6" />
  </svg>
);

/**
 * A club as a crest: the lead plate on a directory page, a ruled entry otherwise.
 * Names are the only prose; members are a stack, composition is a scale, and the
 * viewer's own standing is a mark. Description and coordinator live in the crest's
 * inspector.
 */
export function StudentClubCard({
  club,
  membership = null,
  pending = false,
  tag,
  lead = false,
  onClick,
}: StudentClubCardProps) {
  const [coordImgError, setCoordImgError] = useState(false);

  const isCoreTeam = membership?.membershipType === 'core_team';
  const position =
    isCoreTeam && membership?.position && membership.position.toLowerCase() !== 'member'
      ? membership.position
      : null;

  const coordinator =
    typeof club.facultyCoordinatorId === 'object' && club.facultyCoordinatorId !== null
      ? club.facultyCoordinatorId
      : null;

  const coordInitial = coordinator?.name
    ? coordinator.name
        .replace(/^Dr\.\s*/i, '')
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((p) => p[0])
        .join('')
        .toUpperCase() || 'C'
    : 'C';

  const clubImage = club.logo || club.coverImage || (club.images && club.images.length > 0 ? club.images[0] : null);

  const members = club.memberCount ?? club.totalMembers;
  const coreTeam = club.coreTeamCount ?? null;
  const coreShare = members && coreTeam != null && members > 0 ? Math.min(1, coreTeam / members) : null;

  const roster = club.rosterPreview ?? [];
  const coreRoster = roster.filter((p) => p.core);
  const stack = (coreRoster.length ? coreRoster : roster).slice(0, lead ? 6 : 4).map((p) => ({
    name: p.name,
    image: p.image ?? undefined,
  }));

  const state: { role: RoleKind; label: string } | null = tag
    ? { role: tag === 'Admin' ? 'admin' : 'coordinator', label: tag }
    : pending
      ? { role: 'pending', label: 'Request pending' }
      : isCoreTeam
        ? { role: 'core', label: position ? `Core team · ${position}` : 'Core team' }
        : membership
          ? { role: 'member', label: 'Member' }
          : null;

  const inspector = [
    club.description ? club.description.trim() : null,
    coordinator?.name
      ? `Faculty coordinator ${coordinator.name}${coordinator.department ? `, ${coordinator.department}` : ''}`
      : 'No faculty coordinator assigned',
  ]
    .filter(Boolean)
    .join(' · ');

  const ariaName = [
    club.name,
    typeof members === 'number' ? `${members} ${members === 1 ? 'member' : 'members'}` : null,
    state ? state.label : null,
  ]
    .filter(Boolean)
    .join(', ');

  const ring = coreShare != null ? (
    <Ring
      value={coreShare}
      size={68}
      label={members ? `${coreTeam}/${members}` : '0/0'}
      caption="core"
      tone="accent"
    />
  ) : null;

  const rowActions = (
    <span className="clubs-open">
      {lead ? 'Open club' : 'Open'}
      <ArrowRight />
    </span>
  );

  const crest = (
    <Tooltip label={inspector}>
      <span className={lead ? 'clubs-lead__crest' : 'clubs-row__crest'}>
        <Crest
          name={club.name}
          image={clubImage}
          size={lead ? 84 : 40}
          lit={Boolean(membership)}
        />
      </span>
    </Tooltip>
  );

  if (lead) {
    return (
      <article
        className="clubs-lead"
        role="button"
        tabIndex={0}
        aria-label={ariaName}
        data-club-id={club._id}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
          }
        }}
      >
        {crest}

        <div className="clubs-lead__id">
          <div className="clubs-lead__title-row">
            <h3 className="clubs-lead__name">{club.name}</h3>
            {state ? (
              <span className="clubs-lead__state">
                <RoleMark role={state.role} label={state.label} quiet size={14} />
                <span>{state.label}</span>
              </span>
            ) : null}
          </div>

          <div className="clubs-lead__facts">
            {coordinator?.name ? (
              <span className="clubs-chip" aria-label={`Faculty coordinator ${coordinator.name}`}>
                {coordinator.profileImage && !coordImgError ? (
                  <img
                    src={coordinator.profileImage}
                    alt=""
                    onError={() => setCoordImgError(true)}
                    className="clubs-chip__face"
                  />
                ) : (
                  <span className="clubs-chip__face" aria-hidden="true">{coordInitial}</span>
                )}
                <span className="clubs-chip__name">{coordinator.name}</span>
                {coordinator.department ? (
                  <span className="clubs-chip__dept">{coordinator.department}</span>
                ) : null}
              </span>
            ) : (
              <Tooltip label="No faculty coordinator assigned">
                <span className="clubs-chip clubs-chip--void" aria-label="No faculty coordinator">
                  <VoidMark />
                </span>
              </Tooltip>
            )}

            {stack.length > 0 ? <AvatarStack people={stack} max={lead ? 5 : 4} size="sm" /> : null}

            {typeof members === 'number' ? (
              <span className="clubs-lead__count">
                <Counter value={members} className="clubs-lead__n" />
                <span>{members === 1 ? 'member' : 'members'}</span>
              </span>
            ) : null}
          </div>
        </div>

        {ring ? <span className="clubs-lead__gauge">{ring}</span> : null}

        {rowActions}
      </article>
    );
  }

  return (
    <article
      className="clubs-row"
      role="button"
      tabIndex={0}
      aria-label={ariaName}
      data-club-id={club._id}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {crest}

      <span className="clubs-row__name">{club.name}</span>

      {stack.length > 0 ? (
        <span className="clubs-row__stack">
          <AvatarStack people={stack} max={4} size="sm" />
        </span>
      ) : null}

      <span className="clubs-row__bar">
        {members ? (
          <Tooltip
            label={`${coreTeam ?? 0} of ${members} in the core team · ${
              Math.max(0, members - (coreTeam ?? 0))
            } regular`}
          >
            <span className="clubs-row__bar-track">
              <Segments
                value={coreTeam ?? 0}
                total={members}
                segments={8}
                tone="ramp"
                ariaLabel={`${coreTeam ?? 0} of ${members} in the core team`}
              />
            </span>
          </Tooltip>
        ) : (
          <span className="clubs-hatch" aria-hidden="true" />
        )}
      </span>

      <span className="clubs-row__count" aria-hidden="true">
        {typeof members === 'number' ? members : '—'}
      </span>

      {state ? <RoleMark role={state.role} label={state.label} quiet size={16} /> : <span className="clubs-row__mark-gap" aria-hidden="true" />}

      {rowActions}
    </article>
  );
}
