import { useEffect, useRef, useState, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth, isProfileComplete } from './context/AuthContext';
import { LoadingProvider, usePageLoading } from './context/LoadingContext';
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute, RoleProtectedRoute } from './components/ProtectedRoute';

// Pages
import Dashboard from './pages/Dashboard/Dashboard';
import Clubs from './pages/Clubs/Clubs';
import ClubDetails from './pages/Clubs/ClubDetails';
import Projects from './pages/Projects/Projects';
import ProjectDetails from './pages/Projects/ProjectDetails';
import Events from './pages/Events/Events';
import Notifications from './pages/Notifications/Notifications';
import Profile from './pages/Profile/Profile';
import Login from './pages/Auth/Login';
import Register from './pages/Auth/Register';
import MaterialRequests from './pages/MaterialRequests/MaterialRequests';
import Inventory from './pages/Inventory/Inventory';
import Landing from './pages/Landing/Landing';
import LoadingScreen from './components/LoadingScreen';

/**
 * In-app navigation is a route swap, not a page load. The shell stays mounted;
 * this hairline is the only global affordance. It trickles while the destination
 * is still fetching and closes the moment the page says it is ready.
 */
function RouteProgress() {
  const { pathname } = useLocation();
  const { isPageReady } = usePageLoading();
  const [phase, setPhase] = useState<'idle' | 'running' | 'done'>('idle');
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setPhase('running');
    // Ceiling: never hold the rail open for a page that forgets to report.
    const timer = window.setTimeout(() => {
      setPhase((current) => (current === 'running' ? 'done' : current));
    }, 900);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  useEffect(() => {
    if (phase !== 'running' || !isPageReady) return;
    const timer = window.setTimeout(() => setPhase('done'), 110);
    return () => window.clearTimeout(timer);
  }, [phase, isPageReady]);

  useEffect(() => {
    if (phase !== 'done') return;
    const timer = window.setTimeout(() => setPhase('idle'), 340);
    return () => window.clearTimeout(timer);
  }, [phase]);

  return (
    <div
      className={`route-rail${phase !== 'idle' ? ' is-live' : ''}${phase === 'done' ? ' is-done' : ''}`}
      aria-hidden="true"
    >
      <span className="route-rail__fill" />
    </div>
  );
}

/** New route, new document: the scroll container goes back to the top. */
function ScrollReset() {
  const { pathname } = useLocation();
  useEffect(() => {
    const scroller = document.querySelector('.shell-content');
    if (scroller) scroller.scrollTop = 0;
    else window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function AuthGuard() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen isReady={!loading} />;
  if (user) {
    return <Navigate to={isProfileComplete(user) ? '/dashboard' : '/profile'} replace />;
  }
  return <Login />;
}

function AuthRegisterGuard() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen isReady={!loading} />;
  if (user) {
    return <Navigate to={isProfileComplete(user) ? '/dashboard' : '/profile'} replace />;
  }
  return <Register />;
}

/**
 * The boot hold.
 *
 * Authentication usually resolves in a few milliseconds, which would cut the
 * loader away before its cover finished opening. On a cold start the scene is
 * held for a beat, the app is mounted underneath it, and the book then fades.
 * A slow bootstrap is unaffected: the hold only pads, never truncates.
 *
 * The public page is exempt — it needs no identity, so it paints immediately.
 */
const BOOT_HOLD_MS = 700;
const BOOT_LEAVE_MS = 280;

function BootGate({ children }: { children: ReactNode }) {
  const { loading } = useAuth();
  const { pathname } = useLocation();
  const isPublic = pathname === '/';
  const startedAt = useRef(Date.now());
  const [phase, setPhase] = useState<'hold' | 'leave' | 'done'>('hold');

  useEffect(() => {
    if (isPublic || loading || phase !== 'hold') return;
    const elapsed = Date.now() - startedAt.current;
    const open = window.setTimeout(
      () => setPhase('leave'),
      Math.max(0, BOOT_HOLD_MS - elapsed),
    );
    return () => window.clearTimeout(open);
  }, [isPublic, loading, phase]);

  useEffect(() => {
    if (phase !== 'leave') return;
    const gone = window.setTimeout(() => setPhase('done'), BOOT_LEAVE_MS);
    return () => window.clearTimeout(gone);
  }, [phase]);

  if (isPublic) return <>{children}</>;

  /* The loader keeps its position in the tree across the hand-off: remounting it
     would start the cover from closed again. */
  return (
    <>
      {phase === 'hold' ? null : children}
      {phase === 'done' ? null : <LoadingScreen isReady={!loading} leaving={phase === 'leave'} />}
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <LoadingProvider>
        <BrowserRouter>
          <BootGate>
            <Routes>
            <Route path="/login" element={<AuthGuard />} />
            <Route path="/register" element={<AuthRegisterGuard />} />
            <Route path="/" element={<Landing />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="clubs" element={<Clubs />} />
                <Route path="clubs/:id" element={<ClubDetails />} />
                <Route path="projects" element={<Projects />} />
                <Route path="projects/:id" element={<ProjectDetails />} />
                <Route path="events" element={<Events />} />
                <Route path="notifications" element={<Notifications />} />
                <Route path="profile" element={<Profile />} />
                <Route element={<RoleProtectedRoute allowedRoles={['project_admin']} />}>
                  <Route path="material-requests" element={<MaterialRequests />} />
                  <Route path="inventory" element={<Inventory />} />
                </Route>
              </Route>
            </Route>
            </Routes>
          </BootGate>
          <RouteProgress />
          <ScrollReset />
        </BrowserRouter>
      </LoadingProvider>
    </AuthProvider>
  );
}
