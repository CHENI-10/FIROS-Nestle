import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import BatchRegistration from './pages/BatchRegistration';
import Dashboard from './pages/Dashboard';
import ActionRecommendations from './pages/ActionRecommendations';

// A simple Protected Route component wrapper
const ProtectedRoute = ({ children }) => {
  const token = sessionStorage.getItem('token');
  
  if (!token) {
    // Redirect to login if token is not authenticated
    return <Navigate to="/login" replace />;
  }

  return children;
};

// Temp placeholder component
const DashboardPlaceholder = () => (
  <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'Inter, sans-serif' }}>
    <h1 style={{ color: '#5c3a21' }}>Dashboard</h1>
    <p>Dashboard coming soon</p>
  </div>
);

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />

        {/* Protected Routes */}
        <Route 
          path="/batch-registration" 
          element={
            <ProtectedRoute>
              <BatchRegistration />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/recommendations" 
          element={
            <ProtectedRoute>
              <ActionRecommendations />
            </ProtectedRoute>
          } 
        />
        
        {/* Catch-all fallback */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
