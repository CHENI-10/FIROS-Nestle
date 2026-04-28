import React, { useState } from 'react';
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
import SalesRepLogin from './pages/SalesRepLogin';
import MarketIntelligence from './pages/MarketIntelligence';
import MarketIntelligenceReports from './pages/MarketIntelligenceReports';
import MarketIntelligenceReportDetail from './pages/MarketIntelligenceReportDetail';
import DistributorScorecard from './pages/DistributorScorecard';
import DistributorScorecardDetail from './pages/DistributorScorecardDetail';

// A simple Protected Route component wrapper
const ProtectedRoute = ({ children, allowedRoles }) => {
  const token = sessionStorage.getItem('token');
  const role = sessionStorage.getItem('role');
  
  if (!token) {
    // Redirect to login if token is not authenticated
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && (!role || !allowedRoles.includes(role))) {
    // Redirect if user does not have permission
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

const App = () => {
  // State for Sales Rep memory-only JWT
  const [salesRepToken, setSalesRepToken] = useState(null);
  const [salesRepUser, setSalesRepUser] = useState(null);

  const handleSalesRepLogin = (token, user) => {
    setSalesRepToken(token);
    setSalesRepUser(user);
  };

  const handleSalesRepLogout = () => {
    setSalesRepToken(null);
    setSalesRepUser(null);
  };

  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />

        {/* Sales Rep Routes */}
        <Route 
          path="/salesrep" 
          element={
            salesRepToken 
              ? <Navigate to="/market-intelligence" replace /> 
              : <SalesRepLogin onLoginSuccess={handleSalesRepLogin} />
          } 
        />
        <Route 
          path="/market-intelligence" 
          element={
            salesRepToken 
              ? <MarketIntelligence token={salesRepToken} user={salesRepUser} onLogout={handleSalesRepLogout} /> 
              : <Navigate to="/salesrep" replace />
          } 
        />

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
          path="/dashboard/market-intelligence" 
          element={
            <ProtectedRoute allowedRoles={['admin', 'manager', 'warehouse_manager']}>
              <MarketIntelligenceReports />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/dashboard/market-intelligence/:id" 
          element={
            <ProtectedRoute allowedRoles={['admin', 'manager', 'warehouse_manager']}>
              <MarketIntelligenceReportDetail />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/dashboard/scorecard" 
          element={
            <ProtectedRoute allowedRoles={['admin', 'manager', 'warehouse_manager']}>
              <DistributorScorecard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/dashboard/scorecard/:distributorId" 
          element={
            <ProtectedRoute allowedRoles={['admin', 'manager', 'warehouse_manager']}>
              <DistributorScorecardDetail />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/recommendations" 
          element={
            <ProtectedRoute allowedRoles={['admin', 'manager']}>
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
            <ProtectedRoute allowedRoles={['admin', 'manager']}>
              <ReturnIntelligence />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/clearance" 
          element={
            <ProtectedRoute allowedRoles={['admin', 'manager']}>
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
