import { useCallback, useEffect, useState } from 'react';
import { localDayStartIso, useLocalDay } from '../eventDate';
import { api } from '../services/api';
import { usePageLoading } from '../context/LoadingContext';
import type { User } from '../types';
import type {
  StudentClubMembership,
  StudentDashboardData,
  StudentJoinRequest,
  ProjectMentorAssignment,
  ClubMembershipRecord,
  StudentNotificationItem,
  StudentProjectWithMentors,
} from '../types/studentDashboard';

type ApiList<T> = { success?: boolean; data?: T };

/**
 * The student's clubs, in one request.
 *
 * `scope=joined` filters on the server and every club carries its own
 * `myMembership`, so the browser no longer fetches the whole directory and then
 * one roster per club just to find out which ones this student belongs to.
 */
async function resolveClubMemberships(): Promise<{
  clubs: StudentClubMembership[];
  error?: string;
}> {
  try {
    const res = await api<ApiList<(StudentClubMembership['club'] & {
      myMembership?: ClubMembershipRecord | null;
    })[]>>('GET', '/clubs?scope=joined');
    const joined = res.data ?? [];

    return {
      clubs: joined.flatMap((club) =>
        club.myMembership ? [{ club, membership: club.myMembership }] : []
      ),
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Could not load club memberships.';
    return { clubs: [], error: message };
  }
}

async function resolveProjects(userId: string): Promise<{
  projects: StudentProjectWithMentors[];
  error?: string;
}> {
  try {
    const res = await api<ApiList<{ project?: Omit<StudentProjectWithMentors, 'mentors'> | null }[]>>(
      'GET',
      `/users/${userId}/projects`
    );
    const items = res.data ?? [];

    const projects = await Promise.all(
      items.map(async (item) => {
        const p = item.project;
        if (!p?._id) return null;
        try {
          const mentorsRes = await api<ApiList<ProjectMentorAssignment[]>>(
            'GET',
            `/projects/${p._id}/mentors`
          );
          return { ...p, mentors: mentorsRes.data ?? [] } as StudentProjectWithMentors;
        } catch {
          return { ...p, mentors: [] } as StudentProjectWithMentors;
        }
      })
    );

    return { projects: projects.filter(Boolean) as StudentProjectWithMentors[] };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Could not load projects.';
    return { projects: [], error: message };
  }
}

export function useStudentDashboardData(user: User): StudentDashboardData {
  const { setPageLoading } = usePageLoading();
  const today = useLocalDay();
  const [clubs, setClubs] = useState<StudentClubMembership[]>([]);
  const [projects, setProjects] = useState<StudentProjectWithMentors[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<unknown[]>([]);
  const [joinRequests, setJoinRequests] = useState<StudentJoinRequest[]>([]);
  const [notifications, setNotifications] = useState<StudentNotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<StudentDashboardData['errors']>({});

  const load = useCallback(async () => {
    setLoading(true);
    setPageLoading(true);
    setErrors({});

    try {
      const [clubResult, projectResult, eventsResult, requestsResult, notifResult, countResult] =
        await Promise.all([
          resolveClubMemberships(),
          resolveProjects(user._id),
          api<ApiList<unknown[]>>('GET', `/events/upcoming?from=${encodeURIComponent(localDayStartIso())}`).catch((e: Error) => ({ error: e.message })),
          api<{ data?: StudentJoinRequest[] }>('GET', '/join-requests/student').catch((e: Error) => ({
            error: e.message,
          })),
          api<{ data?: StudentNotificationItem[] }>('GET', '/notifications?limit=5').catch((e: Error) => ({
            error: e.message,
          })),
          api<{ count?: number }>('GET', '/notifications/unread-count').catch((e: Error) => ({ error: e.message })),
        ]);

      setClubs(clubResult.clubs);
      setProjects(projectResult.projects);

      const nextErrors: StudentDashboardData['errors'] = {};
      if (clubResult.error) nextErrors.clubs = clubResult.error;
      if (projectResult.error) nextErrors.projects = projectResult.error;

      if ('error' in eventsResult) {
        nextErrors.events = eventsResult.error as string;
        setUpcomingEvents([]);
      } else {
        setUpcomingEvents(eventsResult.data ?? []);
      }

      if ('error' in requestsResult) {
        nextErrors.requests = requestsResult.error as string;
        setJoinRequests([]);
      } else {
        setJoinRequests(requestsResult.data ?? []);
      }

      if ('error' in notifResult) {
        nextErrors.notifications = notifResult.error as string;
        setNotifications([]);
      } else {
        setNotifications(notifResult.data ?? []);
      }

      if ('error' in countResult) {
        nextErrors.notifications = nextErrors.notifications || countResult.error;
      }
      setUnreadCount('count' in countResult && typeof countResult.count === 'number' ? countResult.count : 0);
      setErrors(nextErrors);
    } finally {
      setLoading(false);
      setPageLoading(false);
    }
  }, [user, today, setPageLoading]);

  useEffect(() => {
    load();
  }, [load]);

  return {
    user,
    clubs,
    projects,
    upcomingEvents,
    joinRequests,
    notifications,
    unreadCount,
    loading,
    errors,
    refetch: load,
  };
}
