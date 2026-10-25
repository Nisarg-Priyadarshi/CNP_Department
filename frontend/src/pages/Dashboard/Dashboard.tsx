import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { StudentDashboardPage } from './StudentDashboardPage';
import { partitionEvents, useLocalDay } from '../../eventDate';
import { usePageLoading } from '../../context/LoadingContext';
import { CoordinatorDashboard } from './CoordinatorDashboard';
import { ClubAdminDashboard } from './ClubAdminDashboard';
import { MentorDashboard } from './MentorDashboard';
import { ProjectAdminDashboard } from './ProjectAdminDashboard';
import { DashSkeleton } from './StaffBits';
import './staff-dash.css';

/**
 * The dashboard is a router: it owns the fetches for the four staff roles and
 * hands each role its own screen. Students keep their own page untouched.
 */
export default function Dashboard() {
  const { user } = useAuth();
  const { setPageLoading } = usePageLoading();
  const today = useLocalDay();

  // Faculty coordinator & club admin state
  const [coordinatorClubs, setCoordinatorClubs] = useState<any[]>([]);
  const [coordinatorError, setCoordinatorError] = useState<string | null>(null);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  const [pastEvents, setPastEvents] = useState<any[]>([]);
  const [allClubsList, setAllClubsList] = useState<any[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  // Faculty mentor state
  const [mentorProjects, setMentorProjects] = useState<any[]>([]);

  // Club admin state
  const [clubAdminStats, setClubAdminStats] = useState<any>(null);
  const [clubAdminRequests, setClubAdminRequests] = useState<any[]>([]);

  // Project admin state
  const [projectAdminStats, setProjectAdminStats] = useState<any>(null);
  const [projectAdminRequests, setProjectAdminRequests] = useState<any[]>([]);
  const [projectAdminProjects, setProjectAdminProjects] = useState<any[]>([]);
  const [projectAdminMaterials, setProjectAdminMaterials] = useState<any[]>([]);
  const [projectAdminInventory, setProjectAdminInventory] = useState<any[]>([]);

  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = async () => {
    setPageLoading(true);
    setLoadError(null);
    try {
      if (user?.role === 'faculty_coordinator') {
        setCoordinatorError(null);
        let assignedClubs: any[] = [];
        try {
          const res = await api<any>('GET', `/clubs?coordinatorId=${user._id}`);
          assignedClubs = res.data || [];
        } catch (err: any) {
          console.error('Failed to load coordinator clubs:', err);
          setCoordinatorError(err.message || 'Failed to load assigned clubs.');
          assignedClubs = [];
        }
        setCoordinatorClubs(assignedClubs);
        setAllClubsList(assignedClubs);

        const reqPromises = assignedClubs.map((c: any) =>
          api<any>('GET', `/join-requests/club/${c._id}`).then(res => res.data).catch(() => [])
        );

        const [reqResults, allEvts, notifs] = await Promise.all([
          Promise.all(reqPromises),
          api<any>('GET', '/events').then(res => res.data).catch(() => []),
          api<any>('GET', '/notifications').then(res => res.data).catch(() => [])
        ]);

        const allPendingReqs = reqResults.flat().filter((r: any) => r.status === 'pending');
        setPendingRequests(allPendingReqs);

        const { upcoming, past } = partitionEvents(allEvts);

        setUpcomingEvents(upcoming);
        setPastEvents(past);
        setUnreadNotifications(notifs.filter((n: any) => !n.isRead).length);

      } else if (user?.role === 'club_admin') {
        const [allClubs, notifs, reqs, allEvts] = await Promise.all([
          api<any>('GET', '/clubs').then(res => res.data).catch(() => []),
          api<any>('GET', '/notifications').then(res => res.data).catch(() => []),
          api<any>('GET', '/join-requests/club/all').then(res => res.data).catch(() => []),
          api<any>('GET', '/events').then(res => res.data).catch(() => [])
        ]);
        setAllClubsList(allClubs);

        setClubAdminRequests(reqs.filter((r: any) => r.status === 'pending'));
        setClubAdminStats({
          totalClubs: allClubs.length,
          withCoordinator: allClubs.filter((c: any) => c.facultyCoordinatorId).length,
          withoutCoordinator: allClubs.filter((c: any) => !c.facultyCoordinatorId).length,
        });

        const { upcoming, past } = partitionEvents(allEvts);

        setUpcomingEvents(upcoming);
        setPastEvents(past);
        setUnreadNotifications(notifs.filter((n: any) => !n.isRead).length);
      } else if (user?.role === 'faculty_mentor') {
        const mProjects = await api<any>('GET', `/mentors/${user._id}/projects`).then(res => res.data);
        setMentorProjects(mProjects);

        const notifs = await api<any>('GET', '/notifications').then(res => res.data);
        setUnreadNotifications(notifs.filter((n: any) => !n.isRead).length);
      } else if (user?.role === 'project_admin') {
        const [projects, matReqs, inventory, notifs, reqs] = await Promise.all([
          api<any>('GET', '/projects').then(res => res.data),
          api<any>('GET', '/material-requests').then(res => res.data).catch(() => []),
          api<any>('GET', '/inventory').then(res => res.data).catch(() => []),
          api<any>('GET', '/notifications').then(res => res.data).catch(() => []),
          api<any>('GET', '/join-requests/project/all').then(res => res.data).catch(() => [])
        ]);

        setProjectAdminProjects(projects);
        setProjectAdminMaterials(matReqs);
        setProjectAdminInventory(inventory);
        setProjectAdminStats({
          totalProjects: projects.length,
          activeProjects: projects.filter((p: any) => p.status === 'active').length,
          completedProjects: projects.filter((p: any) => p.status === 'completed').length,
          inactiveProjects: projects.filter((p: any) => p.status === 'inactive').length,
          withTeamLeader: projects.filter((p: any) => p.teamLeaderId).length,
          pendingMaterialRequests: matReqs.filter((r: any) => r.status === 'pending').length,
          inventoryItems: inventory.length
        });
        setProjectAdminRequests(reqs);
        setUnreadNotifications(notifs.filter((n: any) => !n.isRead).length);
      }
    } catch (e: any) {
      console.error(e);
      setLoadError(e?.message || 'The dashboard could not be refreshed.');
    } finally {
      setReady(true);
      setPageLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role !== 'student') void load();
  }, [user, today]);

  if (user?.role === 'student') return <StudentDashboardPage user={user} />;

  if (!user) return null;

  /* First paint is the role's own composition, not a full-screen loader. On a
     refresh the page stays mounted and the shell's route rail carries the
     global loading affordance. */
  if (!ready) return <DashSkeleton role={user.role} />;

  const deleteEvent = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this event?')) return;
    try {
      await api('DELETE', `/events/${id}`);
      setUpcomingEvents(prev => prev.filter(x => x._id !== id));
      setPastEvents(prev => prev.filter(x => x._id !== id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete event');
    }
  };

  if (user.role === 'faculty_coordinator') {
    return (
      <CoordinatorDashboard
        clubs={coordinatorClubs}
        clubsError={coordinatorError}
        requests={pendingRequests}
        upcomingEvents={upcomingEvents}
        pastEvents={pastEvents}
        unread={unreadNotifications}
        loadError={loadError}
        onReload={load}
        onDeleteEvent={deleteEvent}
      />
    );
  }

  if (user.role === 'club_admin') {
    return (
      <ClubAdminDashboard
        clubs={allClubsList}
        stats={clubAdminStats}
        requests={clubAdminRequests}
        upcomingEvents={upcomingEvents}
        pastEvents={pastEvents}
        unread={unreadNotifications}
        loadError={loadError}
        onReload={load}
        onDeleteEvent={deleteEvent}
      />
    );
  }

  if (user.role === 'faculty_mentor') {
    return (
      <MentorDashboard
        mentorProjects={mentorProjects}
        unread={unreadNotifications}
        loadError={loadError}
        onReload={load}
      />
    );
  }

  if (user.role === 'project_admin') {
    return (
      <ProjectAdminDashboard
        stats={projectAdminStats}
        projects={projectAdminProjects}
        requests={projectAdminRequests}
        materialRequests={projectAdminMaterials}
        inventory={projectAdminInventory}
        unread={unreadNotifications}
        loadError={loadError}
        onReload={load}
      />
    );
  }

  return null;
}
