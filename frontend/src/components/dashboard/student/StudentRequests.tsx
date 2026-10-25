import { Link } from 'react-router-dom';
import { KindGlyph } from '../../ui/vis';
import { Tooltip } from '../../ui/Tooltip';
import { CheckIcon } from './StudentIcons';
import { relativeTime, requestStatus, requestTarget, type RequestStatus } from './studentUtils';
import type { StudentJoinRequest } from '../../../types/studentDashboard';

interface StudentRequestsProps {
  requests: StudentJoinRequest[];
  error?: string;
}

function toneOf(status: RequestStatus['tone']): string {
  return status === 'plain' ? 'plain' : status;
}

/**
 * Join requests as queue marks: one mark per request, toned by its state, each
 * linking to the club or project it concerns. Pending is the only loud state and
 * the oldest pending age lives in the tooltip.
 */
export function StudentRequests({ requests, error }: StudentRequestsProps) {
  const pending = requests.filter((request) => request.status === 'pending');
  const oldestPending = pending.reduce<string | undefined>((oldest, request) => {
    if (!request.createdAt) return oldest;
    if (!oldest) return request.createdAt;
    return new Date(request.createdAt) < new Date(oldest) ? request.createdAt : oldest;
  }, undefined);
  const oldest = relativeTime(oldestPending);

  return (
    <div className="sd-signal__row">
      <span className="sd-signal__glyph" aria-hidden="true">
        <KindGlyph kind="request" size={16} />
      </span>
      <span className="sd-signal__label">Requests</span>

      <span className="sd-signal__marks">
        {!error
          ? requests.slice(0, 6).map((request) => {
              const target = requestTarget(request);
              const status = requestStatus(request.status);
              const label = `${target.kind} ${target.name}, ${status.label}`;
              const mark = <span className="sd-signal__mark" data-tone={toneOf(status.tone)} />;

              if (!target.id) {
                return (
                  <span className="sd-signal__mark-wrap" key={request._id} role="img" aria-label={label}>
                    {mark}
                  </span>
                );
              }
              return (
                <Tooltip key={request._id} label={`${target.kind} · ${target.name} · ${status.label}`}>
                  <Link
                    className="sd-signal__mark-wrap"
                    to={target.kind === 'Club' ? `/clubs/${target.id}` : `/projects/${target.id}`}
                    aria-label={label}
                  >
                    {mark}
                  </Link>
                </Tooltip>
              );
            })
          : null}
        {!error && requests.length > 6 ? (
          <span className="sd-signal__more">+{requests.length - 6}</span>
        ) : null}
      </span>

      <span className="sd-signal__num" aria-hidden="true">
        {error ? (
          <span className="sd-signal__unit">unavailable</span>
        ) : pending.length > 0 ? (
          <>
            <span className="sd-signal__n">{pending.length}</span>
            <span className="sd-signal__unit">waiting{oldest ? ` · ${oldest}` : ''}</span>
          </>
        ) : (
          <>
            <CheckIcon className="sd-signal__check" />
            <span className="sd-signal__unit">{requests.length > 0 ? 'clear' : 'none'}</span>
          </>
        )}
      </span>
    </div>
  );
}
