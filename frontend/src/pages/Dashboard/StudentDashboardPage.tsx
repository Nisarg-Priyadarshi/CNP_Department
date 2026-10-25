import { useNavigate } from 'react-router-dom';
import type { User } from '../../types';
import { useStudentDashboardData } from '../../hooks/useStudentDashboardData';
import { DashboardSkeleton } from '../../components/dashboard/student/DashboardSkeleton';
import { StudentDashboardHeader } from '../../components/dashboard/student/StudentDashboardHeader';
import { StudentTermStrip } from '../../components/dashboard/student/StudentTermStrip';
import { StudentMemberships } from '../../components/dashboard/student/StudentMemberships';
import { StudentOverview, countPendingRequests } from '../../components/dashboard/student/StudentOverview';
import { StudentProjects } from '../../components/dashboard/student/StudentProjects';
import { StudentUpcomingEvents } from '../../components/dashboard/student/StudentUpcomingEvents';
import {
  asEvent,
  calendarDaysUntil,
  refId,
  sortEvents,
  type StudentEvent,
} from '../../components/dashboard/student/studentUtils';
import './student-dash.css';

interface StudentDashboardPageProps {
  user: User;
}

/**
 * Student dashboard — "your term".
 *
 * The page answers what the term looks like before it answers what is on a list:
 * a six-week strip with the real events on it, the next event as a ticket, clubs
 * as crests with a composition bar, projects as status rails, and the inbox as a
 * signal strip. Regions are open — one rule, one label — and the ticket is the
 * only framed object on the page.
 */
export function StudentDashboardPage({ user }: StudentDashboardPageProps) {
  const navigate = useNavigate();
  const data = useStudentDashboardData(user);

  if (data.loading) return <DashboardSkeleton />;

  const events = sortEvents(
    data.upcomingEvents.map(asEvent).filter((event): event is StudentEvent => event !== null)
  );
  const nextEvent = events[0] ?? null;
  // Derived here on purpose: `GET /dashboard/summary` also returns `daysUntil` and
  // `eventsAhead`, but the term strip already holds the event list, so the same
  // numbers fall out of it without a second request.
  const nextEventInDays = nextEvent?.eventDate ? calendarDaysUntil(nextEvent.eventDate) : null;

  const coreTeamCount = data.clubs.filter(({ membership }) => membership.membershipType === 'core_team').length;
  const teamLeadCount = data.projects.filter((project) => refId(project.teamLeaderId) === user._id).length;

  const pendingProjectIds = new Set(
    data.joinRequests
      .filter((request) => request.status === 'pending' && request.projectId)
      .map((request) => refId(request.projectId))
      .filter((id): id is string => Boolean(id))
  );

  const pendingRequests = countPendingRequests(data.joinRequests);
  const firstError =
    data.errors.clubs ??
    data.errors.projects ??
    data.errors.events ??
    data.errors.requests ??
    data.errors.notifications;

  return (
    <div className="sd-dash">
      <StudentDashboardHeader
        user={user}
        nextEventInDays={data.errors.events ? null : nextEventInDays}
        upcomingCount={data.errors.events ? null : events.length}
        nextEventTitle={data.errors.events ? null : nextEvent?.title ?? null}
        onExploreClubs={() => navigate('/clubs')}
        onExploreProjects={() => navigate('/projects')}
      />

      {firstError ? (
        <div className="ui-notice ui-notice--error sd-notice" role="status">
          <span className="sd-notice__text">Some details could not be refreshed.</span>
          <button type="button" className="ui-btn ui-btn--quiet ui-btn--sm" onClick={() => void data.refetch()}>
            Try again
          </button>
        </div>
      ) : null}

      <div className="sd-compose">
        {data.errors.events ? null : (
          <StudentTermStrip events={events} error={data.errors.events} />
        )}

        <StudentUpcomingEvents events={events} error={data.errors.events} />

        <StudentMemberships
          clubs={data.clubs}
          error={data.errors.clubs}
          coreCount={data.errors.clubs ? 0 : coreTeamCount}
        />

        <StudentProjects
          projects={data.projects}
          currentUserId={user._id}
          pendingProjectIds={pendingProjectIds}
          error={data.errors.projects}
          leadCount={data.errors.projects ? 0 : teamLeadCount}
        />

        <StudentOverview
          requests={data.joinRequests}
          notifications={data.notifications}
          unreadCount={data.unreadCount}
          pendingCount={pendingRequests}
          requestsError={data.errors.requests}
          notificationsError={data.errors.notifications}
        />
      </div>
    </div>
  );
}
