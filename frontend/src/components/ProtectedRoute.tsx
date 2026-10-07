import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function ProtectedRoute() {
  const { user, loading } = useAuth();

  if (loading) return <div className="empty-state"><div className="spinner"></div><p>Loading...</p></div>;
  if (!user) return <Navigate to="/login" replace />;

  return <Outlet />;
}

export function RoleProtectedRoute({ allowedRoles }: { allowedRoles: string[] }) {
  const { user, loading } = useAuth();

  if (loading) return <div className="empty-state"><div className="spinner"></div><p>Loading...</p></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!allowedRoles.includes(user.role)) {
    return <div className="empty-state"><h2>403 Forbidden</h2><p>You do not have permission to view this page.</p></div>;
  }

  return <Outlet />;
}
