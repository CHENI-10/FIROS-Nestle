import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import BatchRegistration from './pages/BatchRegistration';
import Dashboard from './pages/Dashboard';
import ActionRecommendations from './pages/ActionRecommendations';
import Alerts from './pages/Alerts';
import BatchDetail from './pages/BatchDetail';
import DispatchCertificates from './pages/DispatchCertificates';
import ReturnIntelligence from './pages/ReturnIntelligence';
import ClearanceRecommendations from './pages/ClearanceRecommendations';

// A simple Protected Route component wrapper
const ProtectedRoute = ({ children }) => {
  const token = sessionStorage.getItem('token');
  
  if (!token) {
    // Redirect to login if token is not authenticated
    return <Navigate to="/login" replace />;
  }

  return children;
};

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
        <Route 
          path="/alerts" 
          element={
            <ProtectedRoute>
              <Alerts />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/batch-detail/:batchId" 
          element={
            <ProtectedRoute>
              <BatchDetail />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/certificates" 
          element={
            <ProtectedRoute>
              <DispatchCertificates />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/returns" 
          element={
            <ProtectedRoute>
              <ReturnIntelligence />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/clearance" 
          element={
            <ProtectedRoute>
              <ClearanceRecommendations />
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
