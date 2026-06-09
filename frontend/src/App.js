import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
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
import IdentityVerification from './pages/IdentityVerification';
import RepRegionalIntelligence from './pages/RepRegionalIntelligence';
import RootCauseAnalytics from './pages/RootCauseAnalytics';
import MyDistributors from './pages/MyDistributors';

// A simple Protected Route component wrapper
const ProtectedRoute = ({ children, allowedRoles, hideSidebar = false }) => {
  const token = sessionStorage.getItem('token');
  const role = sessionStorage.getItem('role');
  const [theme, setTheme] = useState(sessionStorage.getItem('theme') || 'light');

  React.useEffect(() => {
    const handleThemeChange = () => {
      setTheme(sessionStorage.getItem('theme') || 'light');
    };
    window.addEventListener('theme-changed', handleThemeChange);
    return () => window.removeEventListener('theme-changed', handleThemeChange);
  }, []);
  
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && (!role || !allowedRoles.includes(role))) {
    return <Navigate to="/dashboard" replace />;
  }

  const bgColor = theme === 'dark' ? '#0f172a' : '#faf7f2';

  return (
    <>
      <div style={{ 
        position: 'fixed', 
        top: 0, left: 0, right: 0, bottom: 0, 
        backgroundColor: bgColor, 
        zIndex: -1,
        transition: 'background-color 0.3s ease'
      }} />
      {!hideSidebar && <Sidebar />}
      <div style={{ marginLeft: hideSidebar ? '0' : '300px', minHeight: '100vh', position: 'relative' }}>
        {children}
      </div>
    </>
  );
};

const App = () => {
  // State for Sales Rep memory-only JWT and Verification
  const [salesRepToken, setSalesRepToken] = useState(null);
  const [salesRepUser, setSalesRepUser] = useState(null);
  const [verifiedRep, setVerifiedRep] = useState(null);
  // Controls whether the Regional Intelligence screen has been seen
  const [repPassedIntelligence, setRepPassedIntelligence] = useState(false);

  const handleSalesRepLogin = (token, user) => {
    setSalesRepToken(token);
    setSalesRepUser(user);
    setVerifiedRep(null);
    setRepPassedIntelligence(false); // Reset on new login
  };

  const handleSalesRepLogout = () => {
    setSalesRepToken(null);
    setSalesRepUser(null);
    setVerifiedRep(null);
    setRepPassedIntelligence(false);
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
            (() => {
              // 1. Must be logged in
              if (!salesRepToken) {
                return <Navigate to="/salesrep" replace />;
              }
              
              // 2. Must verify identity (Work ID)
              if (!verifiedRep) {
                return (
                  <IdentityVerification
                    token={salesRepToken}
                    onVerified={(rep) => { 
                      setVerifiedRep(rep); 
                      setRepPassedIntelligence(false); 
                    }}
                    onLogout={handleSalesRepLogout}
                  />
                );
              }
              
              // 3. Must see Regional Intelligence
              if (!repPassedIntelligence) {
                return (
                  <RepRegionalIntelligence
                    token={salesRepToken}
                    verifiedRep={verifiedRep}
                    onProceed={() => setRepPassedIntelligence(true)}
                    onLogout={handleSalesRepLogout}
                  />
                );
              }
              
              // 4. Finally, the actual Form
              return (
                <MarketIntelligence
                  token={salesRepToken}
                  user={salesRepUser}
                  verifiedRep={verifiedRep}
                  onLogout={handleSalesRepLogout}
                />
              );
            })()
          } 
        />

        {/* Protected Routes */}
        <Route 
          path="/batch-registration" 
          element={
            <ProtectedRoute hideSidebar={true}>
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
        <Route 
          path="/dashboard/root-cause" 
          element={
            <ProtectedRoute allowedRoles={['manager']}>
              <RootCauseAnalytics />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/dashboard/my-distributors" 
          element={
            <ProtectedRoute allowedRoles={['manager', 'admin']}>
              <MyDistributors />
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
