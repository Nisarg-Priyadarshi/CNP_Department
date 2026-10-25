import { DashboardSection } from './DashboardSection';
import { StudentNotificationSummary } from './StudentNotificationSummary';
import { StudentRequests } from './StudentRequests';
import type { StudentJoinRequest, StudentNotificationItem } from '../../../types/studentDashboard';

interface StudentOverviewProps {
  requests: StudentJoinRequest[];
  notifications: StudentNotificationItem[];
  unreadCount: number;
  /** Pending join requests, derived on the page by `countPendingRequests`. */
  pendingCount?: number;
  requestsError?: string;
  notificationsError?: string;
}

/**
 * The inbox as a signal strip: unread notices and pending join requests as two
 * rows of marks with a count, not as two lists of headlines. This is the only
 * region on the page without a plotted visual, so it stays deliberately quiet.
 */
export function StudentOverview({
  requests,
  notifications,
  unreadCount,
  pendingCount = 0,
  requestsError,
  notificationsError,
}: StudentOverviewProps) {
  return (
    <DashboardSection
      id="sd-signal"
      title="Inbox"
      meta={
        requestsError && notificationsError
          ? undefined
          : pendingCount > 0
            ? `${pendingCount} waiting`
            : notifications.length > 0
              ? `${notifications.length} notices`
              : undefined
      }
      actionLabel="Open"
      actionTo="/notifications"
      className="sd-signal-region"
    >
      <div className="sd-signal">
        <StudentNotificationSummary
          unreadCount={unreadCount}
          notifications={notifications}
          error={notificationsError}
        />
        <StudentRequests requests={requests} error={requestsError} />
      </div>
    </DashboardSection>
  );
}

export function countPendingRequests(requests: StudentJoinRequest[]): number {
  return requests.filter((request) => request.status === 'pending').length;
}
