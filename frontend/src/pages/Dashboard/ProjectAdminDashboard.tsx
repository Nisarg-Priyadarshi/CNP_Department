import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { Counter, Ring, Segments } from '../../components/ui/vis';
import { Tooltip } from '../../components/ui/Tooltip';
import {
  DashAvatar,
  DashIcon,
  DashQuiet,
  DashLoadError,
  DashNotifications,
  riseStyle,
  shortAge,
  spokenAge,
} from './StaffBits';

interface ProjectAdminStats {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  inactiveProjects: number;
  withTeamLeader: number;
  pendingMaterialRequests: number;
  inventoryItems: number;
}

interface ProjectAdminDashboardProps {
  stats: ProjectAdminStats | null;
  projects: any[];
  requests: any[];
  materialRequests: any[];
  inventory: any[];
  unread: number;
  loadError: string | null;
  onReload: () => void;
}

type StatusFilter = 'all' | 'active' | 'completed' | 'inactive';

const statusTone = (status: string) => {
  if (status === 'active') return 'is-positive';
  if (status === 'completed') return 'is-accent';
  if (status === 'inactive') return '';
  return '';
};

const projectIdOf = (request: any) =>
  request.projectId && typeof request.projectId === 'object'
    ? request.projectId._id
    : request.projectId;

const STAGES = ['pending', 'approved', 'rejected'] as const;

function MiniFunnel({
  counts,
  what,
}: {
  counts: { pending: number; approved: number; rejected: number };
  what: string;
}) {
  const max = Math.max(1, ...STAGES.map((stage) => counts[stage]));
  return (
    <span
      className="dash-funnel"
      role="img"
      aria-label={`${what}: ${counts.pending} pending, ${counts.approved} approved, ${counts.rejected} rejected`}
    >
      {STAGES.map((stage) => (
        <span
          className="dash-funnel__stage"
          key={stage}
          data-stage={stage}
          title={`${stage} ${counts[stage]}`}
        >
          <span className="dash-funnel__label" aria-hidden="true">
            {stage}
          </span>
          <span className="dash-funnel__track">
            <span
              className="dash-funnel__bar"
              style={{ '--dash-w': counts[stage] / max } as CSSProperties}
            />
          </span>
          <span className="dash-funnel__n" aria-hidden="true">
            {counts[stage]}
          </span>
        </span>
      ))}
    </span>
  );
}

/**
 * Project admin — the console. Portfolio status as proportional blocks that are
 * also the filter, inventory as capacity cells, and both queues as funnels with
 * stage depths. Everything is sized to read from across the room.
 */
export function ProjectAdminDashboard({
  stats,
  projects,
  requests,
  materialRequests,
  inventory,
  unread,
  loadError,
  onReload,
}: ProjectAdminDashboardProps) {
  const [filter, setFilter] = useState<StatusFilter>('all');

  const active = stats?.activeProjects ?? projects.filter((p) => p.status === 'active').length;
  const completed =
    stats?.completedProjects ?? projects.filter((p) => p.status === 'completed').length;
  const inactive =
    stats?.inactiveProjects ?? projects.filter((p) => p.status === 'inactive').length;
  const total = stats?.totalProjects ?? projects.length;
  const withLeader =
    stats?.withTeamLeader ?? projects.filter((project) => Boolean(project.teamLeaderId)).length;

  const pendingMaterials = useMemo(
    () => materialRequests.filter((request) => request.status === 'pending'),
    [materialRequests],
  );
  // MOCK: join-request stages are counted in the browser over the full payload
  const pendingJoins = useMemo(
    () => requests.filter((request) => request.status === 'pending'),
    [requests],
  );

  // MOCK: queue stage counts are client-side tallies of the two list payloads
  const materialStages = useMemo(
    () => ({
      pending: pendingMaterials.length,
      approved: materialRequests.filter((request) => request.status === 'approved').length,
      rejected: materialRequests.filter((request) => request.status === 'rejected').length,
    }),
    [materialRequests, pendingMaterials.length],
  );
  const joinStages = useMemo(
    () => ({
      pending: pendingJoins.length,
      approved: requests.filter((request) => request.status === 'approved').length,
      rejected: requests.filter((request) => request.status === 'rejected').length,
    }),
    [requests, pendingJoins.length],
  );

  const withoutLeader = Math.max(total - withLeader, 0);
  const leaderShare = total > 0 ? Math.min(withLeader / total, 1) : 0;
  const unledTone = withoutLeader > 0 ? 'warning' : 'accent';

  // MOCK: inventory totals and units on loan are summed in the browser
  const units = useMemo(
    () =>
      inventory.reduce(
        (acc, item) => {
          const itemTotal = Number(item.totalQuantity) || 0;
          const available = Number(item.availableQuantity) || 0;
          acc.total += itemTotal;
          acc.out += Math.max(itemTotal - available, 0);
          return acc;
        },
        { total: 0, out: 0 },
      ),
    [inventory],
  );

  const filters: Array<{ key: StatusFilter; label: string; count: number }> = [
    { key: 'all', label: 'All', count: projects.length },
    { key: 'active', label: 'Active', count: active },
    { key: 'completed', label: 'Completed', count: completed },
    { key: 'inactive', label: 'Inactive', count: inactive },
  ];
  // MOCK: status filtering happens over the full /projects payload
  const filtered = filter === 'all' ? projects : projects.filter((p) => p.status === filter);

  const queueCount = pendingMaterials.length + pendingJoins.length;
  const shownMaterials = pendingMaterials.slice(0, 3);
  const shownJoins = pendingJoins.slice(0, 3);
  const hiddenQueue =
    pendingMaterials.length - shownMaterials.length + (pendingJoins.length - shownJoins.length);

  /* The status band is a real proportion of the portfolio: each block's width is
     its own count. A zero-count status keeps a narrow, clickable stub so the
     filter is never lost. */
  // MOCK: block widths are proportions of the real status counts
  const bandColumns = filters
    .filter((option) => option.key !== 'all')
    .map((option) => (option.count > 0 ? `minmax(0, ${option.count}fr)` : 'minmax(58px, auto)'))
    .join(' ');

  return (
    <div className="dash dash--console">
      <header className="ui-page-head">
        <div className="ui-page-head__text">
          <h1 className="ui-title">Operations desk</h1>
        </div>
        <div className="ui-page-actions">
          <DashNotifications count={unread} />
          <Link to="/inventory" className="ui-btn ui-btn--quiet">
            Inventory
          </Link>
          <Link to="/material-requests" className="ui-btn ui-btn--primary">
            Material requests
          </Link>
        </div>
      </header>

      {loadError ? <DashLoadError message={loadError} onRetry={onReload} /> : null}

      <div className="dash-console dash-rise" style={riseStyle(0)}>
        <Link to="/material-requests" className="dash-console__cell">
          <span className="dash-console__label">Materials</span>
          <span className="dash-console__n">
            <Counter value={pendingMaterials.length} />
          </span>
          <MiniFunnel counts={materialStages} what="Material requests" />
          <span className="dash-console__go" aria-hidden="true">
            <DashIcon name="arrow" size={14} />
          </span>
        </Link>

        <Link to="/projects" className="dash-console__cell">
          <span className="dash-console__label">Joins</span>
          <span className="dash-console__n">
            <Counter value={pendingJoins.length} />
          </span>
          <MiniFunnel counts={joinStages} what="Project join requests" />
          <span className="dash-console__go" aria-hidden="true">
            <DashIcon name="arrow" size={14} />
          </span>
        </Link>

        <Link to="/inventory" className="dash-console__cell">
          <span className="dash-console__label">On loan</span>
          <span className="dash-console__n">
            <Counter value={units.out} />
          </span>
          <span className="dash-console__capacity">
            <Segments
              value={units.out}
              total={units.total}
              segments={12}
              ariaLabel={`${units.out} of ${units.total} units on loan`}
            />
            <span className="dash-console__unit" aria-hidden="true">
              {units.total}
            </span>
          </span>
          <span className="dash-console__go" aria-hidden="true">
            <DashIcon name="arrow" size={14} />
          </span>
        </Link>

        <Link to="/projects" className="dash-console__cell">
          <span className="dash-console__label">Unled teams</span>
          <span className="dash-console__n">
            <Counter value={withoutLeader} />
          </span>
          <span className="dash-console__gauge">
            <Ring
              value={leaderShare}
              size={44}
              tone={unledTone}
              label={`${withLeader}/${total}`}
            />
          </span>
          <span className="dash-console__go" aria-hidden="true">
            <DashIcon name="arrow" size={14} />
          </span>
        </Link>
      </div>

      <div className="dash-split">
        <section
          className="ui-panel dash-portfolio dash-rise"
          aria-labelledby="pa-portfolio-title"
          style={riseStyle(1)}
        >
          <header className="ui-panel__head">
            <div className="ui-panel__titles">
              <h2 className="ui-panel__title" id="pa-portfolio-title">
                Portfolio
              </h2>
              <span className="ui-panel__meta">
                <Counter value={filtered.length} />
              </span>
            </div>
            <Link to="/projects" className="ui-btn ui-btn--ghost ui-btn--sm">
              All projects
            </Link>
          </header>

          <div className="dash-band" role="group" aria-label="Filter projects by status">
            <button
              type="button"
              className="dash-band__all"
              aria-pressed={filter === 'all'}
              onClick={() => setFilter('all')}
            >
              <span className="dash-band__label">All</span>
              <span className="dash-band__n">
                <Counter value={projects.length} />
              </span>
            </button>
            <div className="dash-band__track" style={{ gridTemplateColumns: bandColumns }}>
              {filters
                .filter((option) => option.key !== 'all')
                .map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    className="dash-band__block"
                    data-status={option.key}
                    data-empty={option.count === 0 || undefined}
                    aria-pressed={filter === option.key}
                    onClick={() => setFilter(option.key)}
                  >
                    <span className="dash-band__label">{option.label}</span>
                    <span className="dash-band__n">
                      <Counter value={option.count} />
                    </span>
                  </button>
                ))}
            </div>
          </div>

          <div className="ui-panel__body ui-panel__body--flush">
            {filtered.length ? (
              <ul className="dash-proj-list">
                {filtered.map((project) => {
                  const leader =
                    project.teamLeaderId && typeof project.teamLeaderId === 'object'
                      ? project.teamLeaderId
                      : null;
                  return (
                    <li className="dash-proj" key={project._id}>
                      <Link to={`/projects/${project._id}`} className="dash-proj__link">
                        {project.name}
                      </Link>
                      <span className={`ui-tag dash-status ${statusTone(project.status)}`}>
                        {project.status || 'Unknown'}
                      </span>
                      <span className="dash-proj__leader">
                        {leader ? (
                          <Tooltip label={`Team led by ${leader.name}`}>
                            <span
                              className="dash-proj__leader-hit"
                              role="img"
                              aria-label={`Team led by ${leader.name}`}
                              tabIndex={0}
                            >
                              <DashAvatar name={leader.name} src={leader.profileImage} size="sm" />
                              <span className="dash-node__lead" aria-hidden="true">
                                <DashIcon name="lead" size={9} />
                              </span>
                            </span>
                          </Tooltip>
                        ) : (
                          <span className="dash-proj__leader-empty" title="No team leader">
                            <DashIcon name="users" size={12} />
                          </span>
                        )}
                      </span>
                      <Tooltip label={`Updated ${spokenAge(project.updatedAt)}`}>
                        <span className="dash-proj__age" tabIndex={0}>
                          {shortAge(project.updatedAt)}
                        </span>
                      </Tooltip>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="ui-panel__body">
                <DashQuiet
                  icon="ops"
                  title={`No ${filter === 'all' ? '' : filter} projects`}
                  action={
                    filter !== 'all' ? (
                      <button
                        type="button"
                        className="ui-btn ui-btn--quiet ui-btn--sm"
                        onClick={() => setFilter('all')}
                      >
                        Show all projects
                      </button>
                    ) : undefined
                  }
                />
              </div>
            )}
          </div>
        </section>

        <section
          className="ui-panel dash-waiting dash-rise"
          aria-labelledby="pa-queue-title"
          style={riseStyle(2)}
        >
          <header className="ui-panel__head">
            <div className="ui-panel__titles">
              <h2 className="ui-panel__title" id="pa-queue-title">
                Waiting on you
              </h2>
              <span className="ui-panel__meta">
                <Counter value={queueCount} />
              </span>
            </div>
          </header>

          <div className="ui-panel__body ui-panel__body--flush">
            {queueCount === 0 ? (
              <div className="ui-panel__body">
                <DashQuiet icon="check" title="Queues are clear" />
              </div>
            ) : (
              <ul className="dash-wait-list">
                {shownMaterials.map((request) => {
                  const item =
                    request.inventoryItemId?.name || request.materialName || 'Requested material';
                  const quantity = Number(request.quantity) || 0;
                  const projectName = request.projectId?.name || 'Project';
                  return (
                    <li className="dash-wait" key={request._id}>
                      <span className="dash-wait__mark" aria-hidden="true">
                        <DashIcon name="box" size={14} />
                      </span>
                      <span className="dash-wait__main">
                        <span className="dash-wait__title">
                          {item}
                          <span className="dash-wait__qty"> ×{quantity}</span>
                        </span>
                        <span className="dash-wait__meta">{projectName}</span>
                      </span>
                      <span className="dash-wait__age" title={spokenAge(request.createdAt)}>
                        {shortAge(request.createdAt)}
                      </span>
                      <Link
                        to="/material-requests"
                        className="ui-btn ui-btn--quiet ui-btn--sm dash-wait__go"
                      >
                        Review
                      </Link>
                    </li>
                  );
                })}

                {shownJoins.map((request) => {
                  const student = request.studentId;
                  const projectId = projectIdOf(request);
                  return (
                    <li className="dash-wait" key={request._id}>
                      <DashAvatar name={student?.name} src={student?.profileImage} size="sm" />
                      <span className="dash-wait__main">
                        <span className="dash-wait__title">{student?.name || 'Unknown student'}</span>
                        <span className="dash-wait__meta">
                          {request.projectId?.name || 'Project'}
                        </span>
                      </span>
                      <span className="dash-wait__age" title={spokenAge(request.createdAt)}>
                        {shortAge(request.createdAt)}
                      </span>
                      {projectId ? (
                        <Link
                          to={`/projects/${projectId}#join-requests`}
                          className="ui-btn ui-btn--quiet ui-btn--sm dash-wait__go"
                        >
                          Review
                        </Link>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {hiddenQueue > 0 ? (
            <footer className="ui-panel__foot">
              <span className="dash-at">{hiddenQueue} more in the queues</span>
              <Link to="/material-requests" className="ui-btn ui-btn--ghost ui-btn--sm">
                Open requests
              </Link>
            </footer>
          ) : null}
        </section>
      </div>

      <section
        className="ui-panel dash-inventory dash-rise"
        aria-labelledby="pa-inventory-title"
        style={riseStyle(3)}
      >
        <header className="ui-panel__head">
          <div className="ui-panel__titles">
            <h2 className="ui-panel__title" id="pa-inventory-title">
              Inventory
            </h2>
            <span className="ui-panel__meta">
              <Counter value={stats?.inventoryItems ?? inventory.length} />
            </span>
            <span className="dash-inventory__figure">
              <span className="dash-inventory__out">
                <Counter value={units.out} />
              </span>
              <span className="dash-inventory__slash" aria-hidden="true">
                /
              </span>
              <span className="dash-inventory__total">
                <Counter value={units.total} />
              </span>
              <span className="dash-inventory__unit">on loan</span>
            </span>
          </div>
          <Link to="/inventory" className="ui-btn ui-btn--ghost ui-btn--sm">
            Open inventory
          </Link>
        </header>

        {inventory.length ? (
          <div className="dash-caps">
            {inventory.map((item) => {
              const itemTotal = Number(item.totalQuantity) || 0;
              const available = Number(item.availableQuantity) || 0;
              const out = Math.max(itemTotal - available, 0);
              return (
                <Tooltip
                  key={item._id}
                  label={`${available} of ${itemTotal} available, ${out} on loan`}
                >
                  <Link to="/inventory" className="dash-cap">
                    <span className="dash-cap__name">{item.name}</span>
                    <span className="dash-cap__n">
                      <Counter value={available} />
                      <span className="dash-cap__of">/{itemTotal}</span>
                    </span>
                    <span className="dash-cap__cells">
                      <Segments
                        value={available}
                        total={itemTotal}
                        segments={10}
                        tone="ramp"
                        ariaLabel={`${available} of ${itemTotal} units available`}
                      />
                    </span>
                  </Link>
                </Tooltip>
              );
            })}
          </div>
        ) : (
          <div className="ui-panel__body">
            <DashQuiet icon="box" title="No inventory yet" />
          </div>
        )}
      </section>
    </div>
  );
}
