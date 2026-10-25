import { Link } from 'react-router-dom';
import { Counter, KindGlyph } from '../../ui/vis';
import { Tooltip } from '../../ui/Tooltip';
import { CheckIcon } from './StudentIcons';
import { relativeTime } from './studentUtils';
import type { StudentNotificationItem } from '../../../types/studentDashboard';

interface StudentNotificationSummaryProps {
  unreadCount: number;
  notifications: StudentNotificationItem[];
  error?: string;
}

/**
 * Unread notices as a row of marks rather than a list of headlines: one mark per
 * recent notice, filled while unread, with the count and the titles on hover.
 */
export function StudentNotificationSummary({
  unreadCount,
  notifications,
  error,
}: StudentNotificationSummaryProps) {
  const recent = notifications.slice(0, 6);
  const tip = notifications
    .slice(0, 3)
    .map((item) => {
      const time = relativeTime(item.createdAt);
      return `${item.isRead ? '' : 'Unread · '}${item.title}${time ? ` (${time})` : ''}`;
    })
    .join(' · ');

  const aria = error
    ? 'Notices unavailable'
    : `${unreadCount} unread ${unreadCount === 1 ? 'notice' : 'notices'} of ${notifications.length}${
        notifications.length ? `. Open the inbox.` : ''
      }`;

  const body = (
    <>
      <span className="sd-signal__glyph" aria-hidden="true">
        <KindGlyph kind="notification" size={16} />
      </span>
      <span className="sd-signal__label">Notices</span>

      <span className="sd-signal__marks" aria-hidden="true">
        {recent.map((item) => (
          <span className="sd-signal__mark" data-unread={!item.isRead || undefined} key={item._id} />
        ))}
        {notifications.length > recent.length ? (
          <span className="sd-signal__more">+{notifications.length - recent.length}</span>
        ) : null}
      </span>

      <span className="sd-signal__num" aria-hidden="true">
        {error ? (
          <span className="sd-signal__unit">unavailable</span>
        ) : unreadCount > 0 ? (
          <>
            <Counter value={unreadCount} />
            <span className="sd-signal__unit">unread</span>
          </>
        ) : (
          <>
            <CheckIcon className="sd-signal__check" />
            <span className="sd-signal__unit">{notifications.length > 0 ? 'all read' : 'none'}</span>
          </>
        )}
      </span>
    </>
  );

  if (error) {
    return <div className="sd-signal__row">{body}</div>;
  }

  return (
    <Tooltip label={tip || 'No notices'}>
      <Link className="sd-signal__row" to="/notifications" aria-label={aria}>
        {body}
      </Link>
    </Tooltip>
  );
}
