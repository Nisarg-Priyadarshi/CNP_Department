import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { Counter, GridBg, Segments } from '../../components/ui/vis';
import { Tooltip } from '../../components/ui/Tooltip';
import {
  DashEmpty,
  DashIcon,
  DashLoadError,
  DashNotifications,
  ageInDays,
  fmtDay,
  fmtShortDay,
  parseDate,
  riseStyle,
  shortAge,
  spokenAge,
} from './StaffBits';

interface MentorDashboardProps {
  mentorProjects: any[];
  unread: number;
  loadError: string | null;
  onReload: () => void;
}

const statusTone = (status: string) => {
  if (status === 'active') return 'is-positive';
  if (status === 'completed') return 'is-accent';
  return '';
};

function initials(name: string): string {
  return (name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');
}

/**
 * Faculty mentor — the constellation. A calm, read-only field of project nodes:
 * the team leader sits on the orbit, status is a lit mark, and recency is a real
 * 14-day rail under each name. No primary button, no destructive control, one
 * slow ambient pulse on the most recently touched project.
 */
export function MentorDashboard({ mentorProjects, unread, loadError, onReload }: MentorDashboardProps) {
  const entries = mentorProjects.filter((entry) => entry && entry.project);
  const projects = entries.map((entry) => entry.project);
  const active = projects.filter((project) => project.status === 'active').length;
  const completed = projects.filter((project) => project.status === 'completed').length;
  const inactive = projects.filter((project) => project.status === 'inactive').length;
  const withLeader = projects.filter((project) => Boolean(project.teamLeaderId)).length;
  const primaryCount = entries.filter((entry) => entry.isPrimary).length;

  const since = entries
    .map((entry) => entry.assignedAt)
    .filter(Boolean)
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0];

  const latestId = useMemo(() => {
    let latest: { id: string; time: number } | null = null;
    for (const project of projects) {
      const date = parseDate(project.updatedAt);
      if (!date) continue;
      if (!latest || date.getTime() > latest.time) latest = { id: project._id, time: date.getTime() };
    }
    return latest?.id ?? null;
  }, [projects]);

  // MOCK: node recency rails plot each project's real updatedAt inside a 14-day
  // window; the payload carries no time series, so no sparkline is invented.

  const rows = [
    { key: 'active', label: 'Active', count: active },
    { key: 'completed', label: 'Completed', count: completed },
    { key: 'inactive', label: 'Inactive', count: inactive },
  ];

  return (
    <div className="dash dash--constellation">
      <header className="ui-page-head">
        <div className="ui-page-head__text">
          <h1 className="ui-title">Projects I mentor</h1>
        </div>
        <div className="ui-page-actions">
          <DashNotifications count={unread} />
          <Link to="/projects" className="ui-btn ui-btn--ghost">
            All projects
          </Link>
        </div>
      </header>

      {loadError ? <DashLoadError message={loadError} onRetry={onReload} /> : null}

      {entries.length ? (
        <>
          <section
            className="dash-const dash-rise"
            aria-label={`${projects.length} mentored projects`}
            style={riseStyle(0)}
          >
            <GridBg className="dash-const__grid" />

            <ol className="dash-const__field">
              {entries.map((entry, index) => {
                const project = entry.project;
                const leader =
                  project.teamLeaderId && typeof project.teamLeaderId === 'object'
                    ? project.teamLeaderId
                    : null;
                const updated = project.updatedAt;
                const days = ageInDays(updated);
                const position = days === null ? 1 : Math.max(0, Math.min(1, 1 - days / 14));
                return (
                  <li
                    className={`dash-node${
                      project._id === latestId ? ' dash-node--live' : ''
                    }`}
                    key={entry.assignmentId || project._id}
                    style={{ '--dash-i': index } as CSSProperties}
                  >
                    <Link
                      to={`/projects/${project._id}`}
                      className="dash-node__link"
                      aria-label={`${project.name}, ${project.status || 'status unknown'}`}
                    />

                    <span className="dash-node__orbit" aria-hidden="true">
                      <span className="dash-node__plate">
                        {project.image ? (
                          <img src={project.image} alt="" />
                        ) : (
                          initials(project.name)
                        )}
                      </span>
                      <span className={`dash-node__status ${statusTone(project.status)}`} />
                      {leader ? (
                        <span
                          className="dash-node__leader"
                          role="img"
                          aria-label={`Team led by ${leader.name}`}
                          title={`Team led by ${leader.name}`}
                        >
                          {leader.profileImage ? (
                            <img src={leader.profileImage} alt="" />
                          ) : (
                            initials(leader.name)
                          )}
                          <span className="dash-node__lead" aria-hidden="true">
                            <DashIcon name="lead" size={9} />
                          </span>
                        </span>
                      ) : (
                        <span className="dash-node__leader is-empty" title="No team leader">
                          <DashIcon name="users" size={11} />
                        </span>
                      )}
                    </span>

                    <span className="dash-node__name">{project.name}</span>

                    <span className="dash-node__tags">
                      <span className={`ui-tag dash-status ${statusTone(project.status)}`}>
                        {project.status || 'Unknown'}
                      </span>
                      <span className={`ui-tag ui-tag--plain${entry.isPrimary ? ' is-accent' : ''}`}>
                        {entry.isPrimary ? 'Primary' : 'Secondary'}
                      </span>
                    </span>

                    <Tooltip label={`Updated ${fmtDay(updated)}`}>
                      <span
                        className="dash-recency"
                        role="img"
                        aria-label={`Last update ${spokenAge(updated)}`}
                        tabIndex={0}
                      >
                        <span className="dash-recency__track" aria-hidden="true">
                          {Array.from({ length: 14 }, (_, tick) => (
                            <span className="dash-recency__tick" key={tick} />
                          ))}
                          <span
                            className="dash-recency__marker"
                            style={{ '--dash-pos': position } as CSSProperties}
                          />
                        </span>
                        <span className="dash-recency__age">{shortAge(updated)}</span>
                      </span>
                    </Tooltip>
                  </li>
                );
              })}
            </ol>
          </section>

          <section
            className="dash-status-band dash-rise"
            aria-labelledby="fm-status-title"
            style={riseStyle(1)}
          >
            <div className="dash-status-band__head">
              <h2 className="dash-region__title" id="fm-status-title">
                Status
              </h2>
              <span className="dash-region__n">
                <Counter value={projects.length} />
              </span>
              {since ? <span className="dash-at">since {fmtShortDay(since)}</span> : null}
              <span className="dash-region__spacer" />
              <Tooltip label={`${withLeader} of ${projects.length} teams have a leader`}>
                <span className="dash-status-band__leaders" tabIndex={0}>
                  <span className="dash-status-band__leaders-glyph" aria-hidden="true">
                    <DashIcon name="users" size={13} />
                  </span>
                  <Segments
                    value={withLeader}
                    total={projects.length}
                    segments={Math.max(projects.length, 3)}
                    ariaLabel={`${withLeader} of ${projects.length} teams have a leader`}
                  />
                  <span className="dash-status-band__leaders-n" aria-hidden="true">
                    {withLeader}/{projects.length}
                  </span>
                </span>
              </Tooltip>
            </div>

            {projects.length ? (
              <div
                className="dash-proportion"
                role="img"
                aria-label={`${projects.length} projects: ${active} active, ${completed} completed, ${inactive} inactive`}
              >
                {rows.map((row) =>
                  row.count > 0 ? (
                    <span
                      className="dash-proportion__block"
                      key={row.key}
                      data-status={row.key}
                      style={{ '--dash-w': row.count } as CSSProperties}
                    />
                  ) : null,
                )}
              </div>
            ) : null}

            <ul className="dash-status-key">
              {rows.map((row) => (
                <li key={row.key} className="dash-status-key__item">
                  <span className="dash-status-key__swatch" data-status={row.key} aria-hidden="true" />
                  <span className="dash-status-key__label">{row.label}</span>
                  <span className="dash-status-key__n">
                    <Counter value={row.count} />
                  </span>
                </li>
              ))}
              <li className="dash-status-key__item is-quiet">
                <span className="dash-status-key__label">Primary mentor</span>
                <span className="dash-status-key__n">
                  <Counter value={primaryCount} />
                </span>
              </li>
            </ul>
          </section>
        </>
      ) : (
        <DashEmpty
          icon="ops"
          title="No projects assigned"
          text="A project admin assigns faculty mentors."
        />
      )}
    </div>
  );
}
