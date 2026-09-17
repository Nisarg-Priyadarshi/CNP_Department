import React, { createContext, useContext, useState, useEffect } from 'react';
import { mockStudents } from '../data/mockData';

const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('cnp_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  const [activeRole, setActiveRole] = useState(() => {
    return localStorage.getItem('cnp_active_role') || 'Student';
  });

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('cnp_user', JSON.stringify(currentUser));
      localStorage.setItem('cnp_active_role', activeRole);
    } else {
      localStorage.removeItem('cnp_user');
      localStorage.removeItem('cnp_active_role');
    }
  }, [currentUser, activeRole]);

  const login = (email, password) => {
    // Basic mock authentication
    const user = mockStudents.find(
      (s) => s.email.toLowerCase() === email.toLowerCase()
    );
    if (user) {
      setCurrentUser(user);
      setActiveRole(user.role);
      return { success: true, user };
    }
    return { success: false, message: "Invalid email credentials (use any email from mock students, e.g., 'vedant@college.edu' or 'priya.patel@college.edu')" };
  };

  const logout = () => {
    setCurrentUser(null);
    setActiveRole('Student');
  };

  const changeActiveRole = (newRole) => {
    setActiveRole(newRole);
  };

  return (
    <UserContext.Provider value={{ currentUser, activeRole, login, logout, changeActiveRole }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};
