import React, { useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { UserProvider, useUser } from './context/UserContext';

import Sidebar from './components/Sidebar';
import Header from './components/Header';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Clubs from './pages/Clubs';
import ClubProfile from './pages/ClubProfile';
import Events from './pages/Events';
import Projects from './pages/Projects';
import Calendar from './pages/Calendar';
import Approvals from './pages/Approvals';
import Inventory from './pages/Inventory';
import StudentProfile from './pages/StudentProfile';

// Route Guard component
const RequireAuth = ({ children }) => {
  const { currentUser } = useUser();
  const location = useLocation();

  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

// Layout Wrapper
const MainLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
  const location = useLocation();
  const isLoginPage = location.pathname === '/login';

  if (isLoginPage) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
      </Routes>
    );
  }

  return (
    <RequireAuth>
      <div className="app-container">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        
        <main className="main-content">
          <Header onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/clubs" element={<Clubs />} />
            <Route path="/club/:clubId" element={<ClubProfile />} />
            <Route path="/events" element={<Events />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/approvals" element={<Approvals />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/profile" element={<StudentProfile />} />
            <Route path="/profile/:studentId" element={<StudentProfile />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </RequireAuth>
  );
};

function App() {
  return (
    <UserProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/*" element={<MainLayout />} />
      </Routes>
    </UserProvider>
  );
}

export default App;
